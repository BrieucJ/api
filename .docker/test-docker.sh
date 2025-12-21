#!/bin/bash
# Test script for Docker images in monorepo setup

set -e

echo "=== Testing Docker Images for Monorepo Setup ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_build() {
    local dockerfile=$1
    local image_name=$2
    local description=$3
    
    echo -e "${YELLOW}Testing: ${description}${NC}"
    echo "  Dockerfile: ${dockerfile}"
    echo "  Image: ${image_name}"
    
    if docker build -t "${image_name}" -f "${dockerfile}" . > /tmp/docker-build.log 2>&1; then
        echo -e "  ${GREEN}✓ Build successful${NC}"
        return 0
    else
        echo -e "  ${RED}✗ Build failed${NC}"
        echo "  Last 20 lines of build output:"
        tail -20 /tmp/docker-build.log | sed 's/^/    /'
        return 1
    fi
}

# Test Lambda images can be inspected
test_lambda_image() {
    local image_name=$1
    local description=$2
    
    echo -e "${YELLOW}Testing Lambda image: ${description}${NC}"
    
    # Create container to inspect
    container_id=$(docker create "${image_name}" 2>&1)
    if [ $? -ne 0 ]; then
        echo -e "  ${RED}✗ Failed to create container${NC}"
        return 1
    fi
    
    # Check if lambda.js exists
    if docker cp "${container_id}:/var/task/lambda.js" - > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓ lambda.js found${NC}"
        
        # Check file size (should be > 0)
        file_size=$(docker cp "${container_id}:/var/task/lambda.js" - | wc -c)
        if [ "${file_size}" -gt 1000 ]; then
            echo -e "  ${GREEN}✓ lambda.js has content (${file_size} bytes)${NC}"
        else
            echo -e "  ${RED}✗ lambda.js seems too small${NC}"
            docker rm "${container_id}" > /dev/null 2>&1
            return 1
        fi
    else
        echo -e "  ${RED}✗ lambda.js not found${NC}"
        docker rm "${container_id}" > /dev/null 2>&1
        return 1
    fi
    
    docker rm "${container_id}" > /dev/null 2>&1
    return 0
}

# Test ECS image
test_ecs_image() {
    local image_name=$1
    
    echo -e "${YELLOW}Testing ECS image${NC}"
    
    # Create container to inspect
    container_id=$(docker create "${image_name}" 2>&1)
    if [ $? -ne 0 ]; then
        echo -e "  ${RED}✗ Failed to create container${NC}"
        return 1
    fi
    
    # Check if http.js exists
    if docker cp "${container_id}:/app/dist/src/servers/http.js" - > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓ http.js found${NC}"
        
        # Check file size
        file_size=$(docker cp "${container_id}:/app/dist/src/servers/http.js" - | wc -c)
        if [ "${file_size}" -gt 1000 ]; then
            echo -e "  ${GREEN}✓ http.js has content (${file_size} bytes)${NC}"
        else
            echo -e "  ${RED}✗ http.js seems too small${NC}"
            docker rm "${container_id}" > /dev/null 2>&1
            return 1
        fi
    else
        echo -e "  ${RED}✗ http.js not found${NC}"
        docker rm "${container_id}" > /dev/null 2>&1
        return 1
    fi
    
    # Check if node_modules exists
    if docker exec "${container_id}" test -d /app/node_modules > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓ node_modules directory exists${NC}"
    else
        echo -e "  ${YELLOW}⚠ node_modules directory not found (may be expected for bundled builds)${NC}"
    fi
    
    docker rm "${container_id}" > /dev/null 2>&1
    return 0
}

# Main test execution
echo "Step 1: Testing Dockerfile builds..."
echo ""

failed=0

# Test Lambda (Backend)
if ! test_build ".docker/Dockerfile.lambda" "test-lambda" "Backend Lambda"; then
    failed=$((failed + 1))
fi
echo ""

# Test Worker Lambda
if ! test_build ".docker/Dockerfile.worker" "test-worker" "Worker Lambda"; then
    failed=$((failed + 1))
fi
echo ""

# Test ECS
if ! test_build ".docker/Dockerfile.ecs" "test-ecs" "Backend ECS"; then
    failed=$((failed + 1))
fi
echo ""

echo "Step 2: Testing image contents..."
echo ""

# Test Lambda images
if ! test_lambda_image "test-lambda" "Backend Lambda"; then
    failed=$((failed + 1))
fi
echo ""

if ! test_lambda_image "test-worker" "Worker Lambda"; then
    failed=$((failed + 1))
fi
echo ""

# Test ECS image
if ! test_ecs_image "test-ecs"; then
    failed=$((failed + 1))
fi
echo ""

# Summary
echo "=== Test Summary ==="
if [ $failed -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}${failed} test(s) failed${NC}"
    exit 1
fi

