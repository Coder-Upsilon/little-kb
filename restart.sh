#!/bin/bash

# Little KB - Restart All Services Script
echo "🔄 Restarting Little KB Services..."

# Stop all services
echo "🛑 Stopping services..."
./stop.sh

# Wait a moment for clean shutdown
echo "⏳ Waiting for clean shutdown..."
sleep 3

# Start all services
echo "🚀 Starting services..."
./start.sh

echo ""
echo "✅ Little KB services have been restarted!"
echo ""
echo "📊 Service URLs:"
echo "   Frontend:     http://localhost:3000"
echo "   Backend API:  http://localhost:8000"
echo "   API Docs:     http://localhost:8000/docs"
echo ""
echo "🔧 MCP Server Information:"
echo "   Port Range:   8100-8199 (auto-assigned when created)"
echo "   Management:   http://localhost:3000 → 'MCP Servers' tab"
echo "   Status:       Use './dev.sh mcp-status' to check active servers"
