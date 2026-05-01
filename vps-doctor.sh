#!/bin/bash
# Reusable Tool: VPS Infrastructure Health Check
echo "--- [ORCHESTRATION HEALTH CHECK] ---"

# 1. Check if containers are running
echo "[1/3] Container Status:"
docker ps --format "table {{.Names}}\t{{.Status}}"

# 2. Check Tunnel Connection to Cloudflare
echo -e "\n[2/3] Cloudflare Tunnel Logs (Last 5 lines):"
docker logs tunnel --tail 5

# 3. Internal Network Handshake
echo -e "\n[3/3] Testing Internal Handshake (Tunnel -> Nginx):"
if docker exec tunnel wget -qO- http://global_nginx:80 > /dev/null; then
    echo "SUCCESS: Internal routing is active (200 OK)."
else
    echo "FAILED: Tunnel container cannot see global_nginx."
    echo "ACTION: Check if both containers are in the same docker-compose file."
fi
