#!/bin/bash

# Igreja Admin Platform — Automated Deployment Script
# Sprint 44 — Production Ready
# Date: 2026-04-10

set -e

echo "=== Igreja Admin Platform - Deployment Script ==="
echo "Status: Production Ready"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Verify Docker is available
echo -e "${YELLOW}[1/5]${NC} Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}ERROR: Docker not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker found ($(docker --version))${NC}"

# Step 2: Verify Docker Compose
echo -e "${YELLOW}[2/5]${NC} Checking Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}ERROR: Docker Compose not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose found ($(docker-compose --version))${NC}"

# Step 3: Build images
echo -e "${YELLOW}[3/5]${NC} Building Docker images..."
docker-compose build --no-cache
echo -e "${GREEN}✓ Docker images built successfully${NC}"

# Step 4: Start services
echo -e "${YELLOW}[4/5]${NC} Starting services..."
docker-compose up -d
echo -e "${GREEN}✓ Services started${NC}"

# Step 5: Verify health
echo -e "${YELLOW}[5/5]${NC} Verifying health checks..."
sleep 10

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Service Status:"
docker-compose ps
echo ""
echo "Health Check Endpoints:"
echo "  Frontend: http://localhost:3000/api/health"
echo "  API: http://localhost:3000/api/blog"
echo ""
echo "Next Steps:"
echo "  1. Configure DNS: aigrejanascasas.com.br → $(hostname -I | awk '{print $1}')"
echo "  2. Monitor logs: docker-compose logs -f"
echo "  3. Access platform: https://aigrejanascasas.com.br"
echo ""
echo -e "${GREEN}✅ Ready for Production${NC}"
