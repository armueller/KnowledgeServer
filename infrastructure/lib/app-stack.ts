import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';

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

    // CRITICAL: Completely separate SSM parameter paths for each environment
    // This prevents any interference between staging and prod
    const apiKeysPrefix = `/knowledge-server${props.envName === 'prod' ? '' : '-dev'}/api-keys`;

    // Each environment gets its own set of SSM parameters
    // These will be created independently and won't conflict
    const neo4jUri = new ssm.StringParameter(this, `${props.envName}Neo4jUri`, {
      parameterName: `${apiKeysPrefix}/neo4j-uri`,
      stringValue: 'PLACEHOLDER_VALUE', // Replace this with actual value after deployment
      description: `Neo4j database URI for ${props.envName}`,
    });

    const neo4jUsername = new ssm.StringParameter(this, `${props.envName}Neo4jUsername`, {
      parameterName: `${apiKeysPrefix}/neo4j-username`,
      stringValue: 'PLACEHOLDER_VALUE', // Replace this with actual value after deployment
      description: `Neo4j database username for ${props.envName}`,
    });

    const neo4jPassword = new ssm.StringParameter(this, `${props.envName}Neo4jPassword`, {
      parameterName: `${apiKeysPrefix}/neo4j-password`,
      stringValue: 'PLACEHOLDER_VALUE', // Replace this with actual value after deployment
      description: `Neo4j database password for ${props.envName}`,
    });

    // Create VPC - each environment gets its own VPC
    const vpc = new ec2.Vpc(this, `${APP_NAME}${props.envName}Vpc`, {
      maxAzs: props.config.vpc.maxAzs,
      natGateways: props.config.vpc.natGateways,
    });

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
          NODE_ENV: props.envName,
        },
        secrets: {
          NEO4J_URI: ecs.Secret.fromSsmParameter(neo4jUri),
          NEO4J_USERNAME: ecs.Secret.fromSsmParameter(neo4jUsername),
          NEO4J_PASSWORD: ecs.Secret.fromSsmParameter(neo4jPassword),
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
  }
}