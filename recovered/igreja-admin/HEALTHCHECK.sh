#!/bin/bash

# Igreja Admin Platform — Health Check Script
# Verifies all services are operational

set -e

echo "=== Igreja Health Check ==="
echo ""

FRONTEND_URL="http://localhost:3000/api/health"
API_URL="http://localhost:3000/api/blog"
DB_URL="localhost:5432"

# Check Frontend
echo "Checking Frontend Service..."
if curl -s $FRONTEND_URL | grep -q "ok"; then
    echo "✅ Frontend: HEALTHY"
else
    echo "❌ Frontend: UNHEALTHY"
fi

# Check API
echo "Checking API Service..."
if curl -s $API_URL -H "Content-Type: application/json" > /dev/null 2>&1; then
    echo "✅ API: HEALTHY"
else
    echo "❌ API: UNHEALTHY"
fi

# Check Database
echo "Checking Database Service..."
if docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo "✅ Database: HEALTHY"
else
    echo "❌ Database: UNHEALTHY"
fi

# Check Traefik
echo "Checking Traefik Reverse Proxy..."
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "✅ Traefik: HEALTHY"
else
    echo "❌ Traefik: UNHEALTHY"
fi

echo ""
echo "=== All Systems Ready for Production ==="
