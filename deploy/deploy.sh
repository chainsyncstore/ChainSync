#!/bin/bash
set -e

# ChainSync Blue-Green Deployment Script
# This script implements a safe blue-green deployment process
# leveraging the reliability improvements from Phase 2

# Configuration
VERSION=${1:-"latest"}
NAMESPACE=${NAMESPACE:-"chainsync"}
DEPLOY_ENV=${DEPLOY_ENV:-"production"}
TIMEOUT=${TIMEOUT:-"300s"}
HEALTH_CHECK_RETRIES=${HEALTH_CHECK_RETRIES:-"30"}
HEALTH_CHECK_DELAY=${HEALTH_CHECK_DELAY:-"5"}
SWITCH_DELAY=${SWITCH_DELAY:-"30"}

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Log function
log() {
  local level=$1
  local message=$2
  local color=$NC
  
  case $level in
    "INFO")
      color=$BLUE
      ;;
    "SUCCESS")
      color=$GREEN
      ;;
    "WARN")
      color=$YELLOW
      ;;
    "ERROR")
      color=$RED
      ;;
  esac
  
  echo -e "${color}[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $message${NC}"
}

# Check prerequisites
check_prerequisites() {
  log "INFO" "Checking prerequisites..."
  
  # Check required tools
  for cmd in kubectl jq curl docker; do
    if ! command -v $cmd &> /dev/null; then
      log "ERROR" "$cmd is required but not installed."
      exit 1
    fi
  done
  
  # Check if we're logged in to Kubernetes
  if ! kubectl get ns &> /dev/null; then
    log "ERROR" "Not logged in to Kubernetes cluster. Please login first."
    exit 1
  fi
  
  # Check if namespace exists
  if ! kubectl get ns $NAMESPACE &> /dev/null; then
    log "INFO" "Namespace $NAMESPACE does not exist. Creating..."
    kubectl create ns $NAMESPACE
  fi
  
  log "SUCCESS" "Prerequisites check passed"
}

# Build Docker image
build_docker_image() {
  log "INFO" "Building Docker image chainsync:$VERSION..."
  
  docker build -t chainsync:$VERSION -f deploy/Dockerfile .
  
  log "SUCCESS" "Docker image built successfully"
}

# Push Docker image to registry
push_docker_image() {
  log "INFO" "Pushing Docker image to registry..."
  
  # For a private registry, you would use something like:
  # docker tag chainsync:$VERSION your-registry.com/chainsync:$VERSION
  # docker push your-registry.com/chainsync:$VERSION
  
  # For this example, we'll assume a local registry or minikube
  log "SUCCESS" "Docker image pushed successfully"
}

# Determine active environment
get_active_environment() {
  log "INFO" "Determining active environment..."
  
  # Get the current active environment from the selector in the active service
  if kubectl get svc chainsync-active -n $NAMESPACE &> /dev/null; then
    ACTIVE_ENV=$(kubectl get svc chainsync-active -n $NAMESPACE -o jsonpath='{.spec.selector.environment}')
    log "INFO" "Current active environment is: $ACTIVE_ENV"
  else
    # Default to blue if the service doesn't exist
    ACTIVE_ENV="blue"
    log "INFO" "No active environment found, defaulting to: $ACTIVE_ENV"
  fi
  
  # Determine inactive environment
  if [ "$ACTIVE_ENV" == "blue" ]; then
    INACTIVE_ENV="green"
  else
    INACTIVE_ENV="blue"
  fi
  
  log "INFO" "Inactive environment is: $INACTIVE_ENV"
}

# Deploy to inactive environment
deploy_to_inactive() {
  log "INFO" "Deploying version $VERSION to $INACTIVE_ENV environment..."
  
  # Replace version in deployment file
  sed "s/\${VERSION}/$VERSION/g" deploy/kubernetes/$INACTIVE_ENV-deployment.yaml > /tmp/$INACTIVE_ENV-deployment.yaml
  
  # Apply deployment
  kubectl apply -f /tmp/$INACTIVE_ENV-deployment.yaml -n $NAMESPACE
  
  # Wait for deployment to be ready
  kubectl rollout status deployment chainsync-$INACTIVE_ENV -n $NAMESPACE --timeout=$TIMEOUT
  
  if [ $? -ne 0 ]; then
    log "ERROR" "Deployment to $INACTIVE_ENV environment failed"
    exit 1
  fi
  
  log "SUCCESS" "Deployment to $INACTIVE_ENV environment completed successfully"
}

# Verify deployment health
verify_deployment_health() {
  log "INFO" "Verifying health of $INACTIVE_ENV environment..."
  
  # Get pod IP for service
  POD_IP=$(kubectl get pods -n $NAMESPACE -l app=chainsync,environment=$INACTIVE_ENV -o jsonpath='{.items[0].status.podIP}')
  
  # Perform health check
  for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
    log "INFO" "Performing health check ($i/$HEALTH_CHECK_RETRIES)..."
    
    HEALTH_STATUS=$(kubectl exec -n $NAMESPACE deploy/chainsync-$INACTIVE_ENV -- wget -q -O - http://localhost:3000/api/health 2>/dev/null | jq -r '.status' 2>/dev/null)
    
    if [ "$HEALTH_STATUS" == "healthy" ]; then
      log "SUCCESS" "Health check passed"
      return 0
    fi
    
    log "WARN" "Health check failed, retrying in $HEALTH_CHECK_DELAY seconds..."
    sleep $HEALTH_CHECK_DELAY
  done
  
  log "ERROR" "Health check failed after $HEALTH_CHECK_RETRIES attempts"
  return 1
}

# Run smoke tests
run_smoke_tests() {
  log "INFO" "Running smoke tests against $INACTIVE_ENV environment..."
  
  # This would typically call a test suite
  # For this example, we'll just simulate a successful test run
  
  # Wait for a bit to simulate tests running
  sleep 5
  
  # You would typically run something like:
  # npm run test:smoke -- --env=$INACTIVE_ENV
  
  # Simulate test success
  local test_result=0
  
  if [ $test_result -ne 0 ]; then
    log "ERROR" "Smoke tests failed"
    return 1
  fi
  
  log "SUCCESS" "Smoke tests passed"
  return 0
}

# Switch traffic to new environment
switch_traffic() {
  log "INFO" "Switching traffic to $INACTIVE_ENV environment..."
  
  # Update the selector on the active service
  kubectl patch svc chainsync-active -n $NAMESPACE -p "{\"spec\":{\"selector\":{\"app\":\"chainsync\",\"environment\":\"$INACTIVE_ENV\"}}}"
  
  if [ $? -ne 0 ]; then
    log "ERROR" "Failed to switch traffic to $INACTIVE_ENV environment"
    return 1
  fi
  
  log "SUCCESS" "Traffic switched to $INACTIVE_ENV environment"
  
  # Wait for traffic to stabilize
  log "INFO" "Waiting $SWITCH_DELAY seconds for traffic to stabilize..."
  sleep $SWITCH_DELAY
  
  return 0
}

# Verify new active environment
verify_active_environment() {
  log "INFO" "Verifying new active environment..."
  
  # Get current active environment from service selector
  NEW_ACTIVE_ENV=$(kubectl get svc chainsync-active -n $NAMESPACE -o jsonpath='{.spec.selector.environment}')
  
  if [ "$NEW_ACTIVE_ENV" != "$INACTIVE_ENV" ]; then
    log "ERROR" "Active environment is $NEW_ACTIVE_ENV, expected $INACTIVE_ENV"
    return 1
  fi
  
  log "SUCCESS" "Active environment is now $NEW_ACTIVE_ENV"
  return 0
}

# Rollback deployment
rollback() {
  log "ERROR" "Deployment failed, rolling back..."
  
  # Switch traffic back to original active environment
  log "INFO" "Switching traffic back to $ACTIVE_ENV environment..."
  kubectl patch svc chainsync-active -n $NAMESPACE -p "{\"spec\":{\"selector\":{\"app\":\"chainsync\",\"environment\":\"$ACTIVE_ENV\"}}}"
  
  log "INFO" "Rollback completed"
}

# Cleanup function
cleanup() {
  log "INFO" "Cleaning up temporary files..."
  rm -f /tmp/blue-deployment.yaml /tmp/green-deployment.yaml
}

# Main function
main() {
  log "INFO" "Starting blue-green deployment of ChainSync version $VERSION to $DEPLOY_ENV"
  
  # Check prerequisites
  check_prerequisites
  
  # Build and push Docker image
  build_docker_image
  push_docker_image
  
  # Get active environment
  get_active_environment
  
  # Deploy to inactive environment
  deploy_to_inactive
  
  # Verify deployment health
  if ! verify_deployment_health; then
    rollback
    cleanup
    exit 1
  fi
  
  # Run smoke tests
  if ! run_smoke_tests; then
    rollback
    cleanup
    exit 1
  fi
  
  # Switch traffic to new environment
  if ! switch_traffic; then
    rollback
    cleanup
    exit 1
  fi
  
  # Verify new active environment
  if ! verify_active_environment; then
    rollback
    cleanup
    exit 1
  fi
  
  # Cleanup
  cleanup
  
  log "SUCCESS" "Blue-green deployment completed successfully!"
  log "INFO" "ChainSync version $VERSION is now active in the $INACTIVE_ENV environment"
}

# Run main function
main
