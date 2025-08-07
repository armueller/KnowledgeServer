#!/bin/bash

# Script to tail AWS Fargate logs for Knowledge Server application
# Usage: ./scripts/tail-logs.sh [environment] [aws-logs-options]
# Examples:
#   ./scripts/tail-logs.sh                    # defaults to staging
#   ./scripts/tail-logs.sh staging            # explicitly staging
#   ./scripts/tail-logs.sh production         # production logs
#   ./scripts/tail-logs.sh staging --since 1h # with additional options

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Set AWS profile
export AWS_PROFILE=knowledge-server

# Parse environment argument
ENV="${1:-staging}"
shift || true  # Remove first argument if it exists

# Validate environment
if [[ "$ENV" != "staging" && "$ENV" != "production" ]]; then
    echo -e "${RED}Error: Invalid environment '$ENV'. Use 'staging' or 'production'.${NC}"
    exit 1
fi

# Set environment-specific variables
if [[ "$ENV" == "staging" ]]; then
    ENV_PREFIX="knowledge-server-staging"
    SUBDOMAIN="knowledge-server-dev"
else
    ENV_PREFIX="knowledge-server-production"
    SUBDOMAIN="knowledge-server"
fi

echo -e "${BLUE}🔍 Finding ECS resources for ${ENV} environment...${NC}"

# Find ECS cluster
CLUSTER=$(aws ecs list-clusters --query "clusterArns[?contains(@, '${ENV_PREFIX}')] | [0]" --output text)

if [[ -z "$CLUSTER" ]]; then
    echo -e "${RED}Error: No ECS cluster found for environment '${ENV}'${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Found cluster: ${CLUSTER##*/}${NC}"

# Find ECS service
SERVICE=$(aws ecs list-services --cluster "$CLUSTER" --query "serviceArns[0]" --output text)

if [[ -z "$SERVICE" ]]; then
    echo -e "${RED}Error: No ECS service found in cluster${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Found service: ${SERVICE##*/}${NC}"

# Get task definition from service
TASK_DEF=$(aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" --query "services[0].taskDefinition" --output text)

if [[ -z "$TASK_DEF" ]]; then
    echo -e "${RED}Error: Could not get task definition from service${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Found task definition: ${TASK_DEF##*/}${NC}"

# Get log group from task definition
LOG_GROUP=$(aws ecs describe-task-definition --task-definition "$TASK_DEF" --query "taskDefinition.containerDefinitions[0].logConfiguration.options.\"awslogs-group\"" --output text)

if [[ -z "$LOG_GROUP" || "$LOG_GROUP" == "None" ]]; then
    echo -e "${RED}Error: Could not find log group in task definition${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Found log group: $LOG_GROUP${NC}"

# Check if there are active tasks
TASK_COUNT=$(aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" --query "services[0].runningCount" --output text)

if [[ "$TASK_COUNT" == "0" ]]; then
    echo -e "${YELLOW}⚠️  Warning: No running tasks found. Logs may be from previous runs.${NC}"
fi

# Get the most recent log stream
LATEST_STREAM=$(aws logs describe-log-streams --log-group-name "$LOG_GROUP" --order-by LastEventTime --descending --max-items 1 --query "logStreams[0].logStreamName" --output text)

if [[ -n "$LATEST_STREAM" && "$LATEST_STREAM" != "None" ]]; then
    echo -e "${GREEN}✓ Latest log stream: $LATEST_STREAM${NC}"
fi

# Start tailing logs
echo -e "${BLUE}📋 Tailing logs from $LOG_GROUP...${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

# Default to --since 30m if no options provided
if [[ $# -eq 0 ]]; then
    aws logs tail "$LOG_GROUP" --since 30m --follow
else
    aws logs tail "$LOG_GROUP" "$@"
fi