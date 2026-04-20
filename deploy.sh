#!/bin/bash
set -e

echo "=== ClipReach Production Deploy ==="

# Check .env exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Copy .env.example to .env and fill in real values:"
    echo "  cp .env.example .env"
    echo "  nano .env"
    exit 1
fi

# Check for default passwords
if grep -q "CHANGE_ME" .env; then
    echo "ERROR: Update all CHANGE_ME values in .env before deploying!"
    exit 1
fi

echo ">> Pulling latest code..."
git pull origin main 2>/dev/null || echo "(skipping git pull)"

echo ">> Building and starting containers..."
docker compose -f docker-compose.prod.yml up -d --build

echo ">> Waiting for services to start..."
sleep 5

echo ">> Service status:"
docker compose -f docker-compose.prod.yml ps

echo ""
echo "=== Deploy complete! ==="
echo "Your site should be live at https://app.clipreach.org"
echo ""
echo "Useful commands:"
echo "  docker compose -f docker-compose.prod.yml logs -f        # View logs"
echo "  docker compose -f docker-compose.prod.yml restart api     # Restart API"
echo "  docker compose -f docker-compose.prod.yml down            # Stop all"
