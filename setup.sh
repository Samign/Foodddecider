#!/bin/bash
set -e

echo "========================================="
echo "Recipe Parser Infrastructure Setup"
echo "========================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check for NVIDIA GPU and docker runtime
if command -v nvidia-smi &> /dev/null; then
    echo "✅ NVIDIA GPU detected"
    if ! docker run --rm --gpus all nvidia/cuda:12.0.0-base-ubuntu22.04 nvidia-smi &> /dev/null; then
        echo "⚠️  NVIDIA Docker runtime not properly configured"
        echo "   Please install nvidia-docker2: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html"
        exit 1
    fi
    echo "✅ NVIDIA Docker runtime configured"
else
    echo "⚠️  No NVIDIA GPU detected - will run in CPU mode (slower)"
    echo "   Consider using a machine with NVIDIA GPU for better performance"
    # Modify docker-compose to remove GPU requirements
    sed -i 's/deploy:/# deploy:/g; s/resources:/# resources:/g; s/reservations:/# reservations:/g; s/devices:/# devices:/g; s/driver:/# driver:/g; s/count:/# count:/g; s/capabilities:/# capabilities:/g' docker-compose.yml
fi

# echo ""
# echo "📦 Starting infrastructure services..."
# docker-compose up -d db redis

# echo ""
# echo "⏳ Waiting for services to be healthy..."
# sleep 10

echo ""
echo "🤖 Starting Ollama service..."
docker-compose up -d ollama

echo ""
echo "⏳ Waiting for Ollama to be ready..."
sleep 15

echo ""
echo "📥 Pulling Llama 3.1 8B model (this may take several minutes)..."
docker exec recipe_ollama ollama pull llama3.1:8b-instruct-q4_0

echo ""
echo "🚀 Starting API service..."
docker-compose up -d api

echo ""
echo "📊 Starting monitoring services..."
docker-compose up -d prometheus grafana

echo ""
echo "========================================="
echo "✅ Setup Complete!"
echo "========================================="
echo ""
echo "Services available at:"
echo "  • API:        http://localhost:8001"
echo "  • API Docs:   http://localhost:8001/docs"
echo "  • Grafana:    http://localhost:3000 (admin/admin)"
echo "  • Prometheus: http://localhost:9090"
echo ""
echo "Test the API with:"
echo '  curl -X POST "http://localhost:8001/parse" \'
echo '       -H "Content-Type: application/json" \'
echo '       -d '"'"'{"url": "https://example.com/recipe"}'"'"
echo ""
echo "View logs:"
echo "  docker-compose logs -f api"
echo ""
echo "To stop all services:"
echo "  docker-compose down"
echo ""
