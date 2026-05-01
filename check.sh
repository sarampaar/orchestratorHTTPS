#!/bin/bash
echo "--- CONTAINERS ---"
docker ps --format "table {{.Names}}\t{{.Status}}"
echo -e "\n--- TUNNEL LOGS ---"
docker logs tunnel --tail 5
echo -e "\n--- HANDSHAKE TEST ---"
docker exec tunnel wget -qO- http://global_nginx:80 | grep "200 OK"
