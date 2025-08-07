import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as neptune from '@aws-cdk/aws-neptune-alpha';

import dotenvFlow from 'dotenv-flow';

// Define stronger typing for configuration
interface VpcConfig {
  maxAzs: number;
  natGateways: number;
}

interface EcsConfig {
  containerPort: number;
  cpu: number;
  memoryLimitMiB: number;
  desiredCount: number;
  minCapacity: number;
  maxCapacity: number;
}

interface DnsConfig {
  domainName: string;
  hostedZoneId: string;
}

interface AppConfig {
  vpc: VpcConfig;
  ecs: EcsConfig;
  dns: DnsConfig;
}

interface AppStackProps extends cdk.StackProps {
  envName: string;
  config: AppConfig;
}

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    // Purposefully omit the .env.local file
    const envVars = dotenvFlow.config({ files: [process.env.NODE_ENV === 'production' ? '.env.production' : '.env.staging'] });
    if (envVars.error) {
      throw envVars.error;
    }
    
    const APP_NAME = 'knowledge-server';
    // Different subdomain for staging vs prod
    const APP_SUBDOMAIN = props.envName === 'prod' ? 'knowledge-server' : 'knowledge-server-dev';

    // ========== CREATE COGNITO RESOURCES ==========
    const { userPool, userPoolClient } = this.createCognitoResources(APP_SUBDOMAIN);

    // CRITICAL: Completely separate SSM parameter paths for each environment
    // This prevents any interference between staging and prod
    const apiKeysPrefix = `/knowledge-server${props.envName === 'prod' ? '' : '-dev'}/api-keys`;

    // Create VPC - each environment gets its own VPC
    const vpc = new ec2.Vpc(this, `${APP_NAME}${props.envName}Vpc`, {
      maxAzs: props.config.vpc.maxAzs,
      natGateways: props.config.vpc.natGateways,
    });

    // ========== CREATE NEPTUNE RESOURCES ==========
    const { neptuneCluster, neptuneEndpoint, neptuneReadEndpoint, neptunePort } = this.createNeptuneResources(APP_SUBDOMAIN, props.envName, apiKeysPrefix, vpc);

    // Create ECS Cluster - each environment gets its own cluster
    const cluster = new ecs.Cluster(this, `${APP_NAME}${props.envName}EcsCluster`, {
      vpc: vpc,
    });

    // Look up existing hosted zone (this is shared between environments)
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, `${APP_NAME}${props.envName}HostedZone`, {
      hostedZoneId: props.config.dns.hostedZoneId,
      zoneName: props.config.dns.domainName,
    });

    // Create ACM certificate - each environment gets its own certificate for its subdomain
    const certificate = new certificatemanager.Certificate(this, `${APP_NAME}${props.envName}Certificate`, {
      domainName: `${APP_SUBDOMAIN}.${props.config.dns.domainName}`,
      validation: certificatemanager.CertificateValidation.fromDns(hostedZone),
    });

    // Create Fargate Service with Load Balancer - completely isolated per environment
    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, `${APP_NAME}${props.envName}FargateService`, {
      cluster: cluster,
      cpu: props.config.ecs.cpu,
      memoryLimitMiB: props.config.ecs.memoryLimitMiB,
      desiredCount: props.config.ecs.desiredCount,
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset('.', {
          // Using your existing Dockerfile
          buildArgs: {
            ENVIRONMENT: props.envName,
          },
        }),
        containerPort: props.config.ecs.containerPort,
        environment: {
          ...envVars.parsed,
          USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
          USER_POOL_ID: userPool.userPoolId,
          NODE_ENV: props.envName,
        },
        secrets: {
          NEPTUNE_ENDPOINT: ecs.Secret.fromSsmParameter(neptuneEndpoint),
          NEPTUNE_READ_ENDPOINT: ecs.Secret.fromSsmParameter(neptuneReadEndpoint),
          NEPTUNE_PORT: ecs.Secret.fromSsmParameter(neptunePort),
        },
      },
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
      healthCheckGracePeriod: cdk.Duration.seconds(60),
      // Set up a healthcheck for the container itself (this runs inside the container)
      healthCheck: {
        // use wget here because curl is not available in the default image
        command: ['CMD-SHELL', 'wget -q --spider http://localhost:3000/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
      },
      publicLoadBalancer: true,
      certificate: certificate,
      domainName: `${APP_SUBDOMAIN}.${props.config.dns.domainName}`,
      domainZone: hostedZone,
    });

    // Set up healthcheck for the target group (this runs on the load balancer)
    fargateService.targetGroup.configureHealthCheck({
      path: '/health',
      port: `${props.config.ecs.containerPort}`,
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 5,
      timeout: cdk.Duration.seconds(20),
      interval: cdk.Duration.seconds(60),
    });

    // Allow our containers to access secrets manager and therefore secrets values
    fargateService.taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
        resources: [
          // You can specify exact secrets ARNs for better security
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:*`,
        ],
      })
    );

    // Allow our containers to access SSM parameters - scoped to this environment only
    fargateService.taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ssm:GetParameter', 'ssm:GetParameters', 'ssm:GetParametersByPath'],
        resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter${apiKeysPrefix}/*`],
      })
    );

    // Set up auto scaling
    const scaling = fargateService.service.autoScaleTaskCount({
      minCapacity: props.config.ecs.minCapacity,
      maxCapacity: props.config.ecs.maxCapacity,
    });

    scaling.scaleOnCpuUtilization(`${APP_NAME}${props.envName}CpuScaling`, {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Output the load balancer URL and domain
    new cdk.CfnOutput(this, `${APP_NAME}${props.envName}LoadBalancerDNS`, {
      value: fargateService.loadBalancer.loadBalancerDnsName,
    });

    new cdk.CfnOutput(this, `${APP_NAME}${props.envName}DomainURL`, {
      value: `https://${APP_SUBDOMAIN}.${props.config.dns.domainName}`,
    });
    
    new cdk.CfnOutput(this, `${props.envName}UserPoolId`, {
      value: userPool.userPoolId,
    });
    
    new cdk.CfnOutput(this, `${props.envName}UserPoolClientId`, {
      value: userPoolClient.userPoolClientId,
    });
  }

  // ========== HELPER FUNCTIONS ==========

  /**
   * Creates Cognito user pool and client with all necessary configuration
   */
  private createCognitoResources(appSubdomain: string) {
    // User pool
    const userPool = new cognito.UserPool(this, 'userpool', {
      userPoolName: `${appSubdomain}-user-pool`,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      customAttributes: {
        country: new cognito.StringAttribute({ mutable: true }),
        city: new cognito.StringAttribute({ mutable: true }),
        isAdmin: new cognito.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireDigits: true,
        requireUppercase: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const cfnUserPool = userPool.node.defaultChild as cognito.CfnUserPool;
    cfnUserPool.emailConfiguration = {
      emailSendingAccount: 'COGNITO_DEFAULT',
    };

    // User Pool Client attributes
    const standardCognitoAttributes = {
      givenName: true,
      familyName: true,
      email: true,
      emailVerified: true,
      address: true,
      birthdate: true,
      gender: true,
      locale: true,
      middleName: true,
      fullname: true,
      nickname: true,
      phoneNumber: true,
      phoneNumberVerified: true,
      profilePicture: true,
      preferredUsername: true,
      profilePage: true,
      timezone: true,
      lastUpdateTime: true,
      website: true,
    };
    
    const clientReadAttributes = new cognito.ClientAttributes()
      .withStandardAttributes(standardCognitoAttributes)
      .withCustomAttributes(...['country', 'city', 'isAdmin']);

    const clientWriteAttributes = new cognito.ClientAttributes()
      .withStandardAttributes({
        ...standardCognitoAttributes,
        emailVerified: false,
        phoneNumberVerified: false,
      })
      .withCustomAttributes(...['country', 'city']);

    // User Pool Client
    const userPoolClient = new cognito.UserPoolClient(this, `${appSubdomain}-userpool-client`, {
      userPool,
      authFlows: {
        userPassword: true,
        adminUserPassword: true,
      },
      accessTokenValidity: cdk.Duration.days(1),
      refreshTokenValidity: cdk.Duration.days(1),
      idTokenValidity: cdk.Duration.days(1),
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
      readAttributes: clientReadAttributes,
      writeAttributes: clientWriteAttributes,
    });

    return {
      userPool,
      userPoolClient,
    };
  }

  /**
   * Creates Neptune cluster with proper VPC configuration for graph database
   */
  private createNeptuneResources(appSubdomain: string, envName: string, apiKeysPrefix: string, vpc: ec2.Vpc) {
    // Use the same VPC as the main application for simpler networking
    const neptuneVpc = vpc;

    // Create Neptune-specific parameter groups for optimization
    const clusterParams = new neptune.ClusterParameterGroup(this, `${appSubdomain}-NeptuneClusterParams`, {
      description: `Neptune cluster parameters for ${appSubdomain}`,
      family: neptune.ParameterGroupFamily.NEPTUNE_1_4, // Use Neptune 1.4 family
      parameters: {
        neptune_enable_audit_log: '1', // Enable audit logging
        neptune_query_timeout: '120000', // 2 minute query timeout
        neptune_result_cache: '1', // Enable result caching
      },
    });

    const dbParams = new neptune.ParameterGroup(this, `${appSubdomain}-NeptuneDbParams`, {
      description: `Neptune database parameters for ${appSubdomain}`,
      family: neptune.ParameterGroupFamily.NEPTUNE_1_4, // Use Neptune 1.4 family
      parameters: {
        neptune_query_timeout: '120000',
        neptune_dfe_query_engine: 'viaQueryHint', // Use DFE query engine
      },
    });

    // Create Neptune cluster
    const neptuneCluster = new neptune.DatabaseCluster(this, `${appSubdomain}-NeptuneCluster`, {
      dbClusterName: `${appSubdomain}-knowledge-graph`,
      vpc: neptuneVpc,
      vpcSubnets: { subnets: neptuneVpc.privateSubnets },
      instanceType: neptune.InstanceType.T3_MEDIUM, // Smallest instance for development (t3.medium is the minimum for Neptune)
      clusterParameterGroup: clusterParams,
      parameterGroup: dbParams,
      // Development settings - adjust for production
      deletionProtection: envName === 'prod',
      removalPolicy: envName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      backupRetention: cdk.Duration.days(envName === 'prod' ? 30 : 7),
    });

    // Create SSM parameters for Neptune endpoints
    const neptuneEndpoint = new ssm.StringParameter(this, `${envName}NeptuneEndpointParam`, {
      parameterName: `${apiKeysPrefix}/neptune-endpoint`,
      stringValue: neptuneCluster.clusterEndpoint.hostname,
      description: `Neptune cluster endpoint for ${envName}`,
    });

    const neptuneReadEndpoint = new ssm.StringParameter(this, `${envName}NeptuneReadEndpointParam`, {
      parameterName: `${apiKeysPrefix}/neptune-read-endpoint`,
      stringValue: neptuneCluster.clusterReadEndpoint.hostname,
      description: `Neptune read endpoint for ${envName}`,
    });

    const neptunePort = new ssm.StringParameter(this, `${envName}NeptunePortParam`, {
      parameterName: `${apiKeysPrefix}/neptune-port`,
      stringValue: '8182', // Neptune Gremlin port
      description: `Neptune port for ${envName}`,
    });

    // Output Neptune connection details
    new cdk.CfnOutput(this, `${envName}NeptuneClusterEndpointOutput`, {
      value: neptuneCluster.clusterEndpoint.hostname,
      description: 'Neptune cluster write endpoint',
    });

    new cdk.CfnOutput(this, `${envName}NeptuneReadEndpointOutput`, {
      value: neptuneCluster.clusterReadEndpoint.hostname,
      description: 'Neptune cluster read endpoint',
    });

    // Allow ECS service to connect to Neptune
    neptuneCluster.connections.allowDefaultPortFromAnyIpv4('Allow ECS connection to Neptune');

    return {
      neptuneCluster,
      neptuneVpc,
      neptuneEndpoint,
      neptuneReadEndpoint,
      neptunePort,
    };
  }
}