#!/bin/bash
echo "--- Orchestration Health Check ---"
echo "[1/3] Docker Containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo -e "\n[2/3] Nginx Configuration:"
docker exec global_nginx nginx -t

echo -e "\n[3/3] Network Connectivity:"
if docker exec tunnel ping -c 1 global_nginx &> /dev/null
then
    echo "SUCCESS: Tunnel can reach Nginx."
else
    echo "ERROR: Tunnel cannot reach Nginx. Check Docker Networks."
fi
