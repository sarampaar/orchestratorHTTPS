#!/bin/bash
# ====================================================================
#      🗑️ VS Code (code-server) Uninstallation Script
# ====================================================================
# This script will stop and remove the code-server docker container,
# remove the docker image, and optionally clean up persistent folders.

set -e

CONTAINER_NAME="code-server"
IMAGE="codercom/code-server:latest"
PROJECTS_DIR="$HOME/projects"
CONFIG_DIR="$HOME/.config/code-server"

echo "================================================="
echo "       🗑️ Uninstalling VS Code (code-server)    "
echo "================================================="

# 1. Stop and remove the Docker container
echo "[1/3] Checking for active container..."
if [ "$(docker ps -a -q -f name=^/${CONTAINER_NAME}$)" ]; then
  echo "🛑 Stopping and removing container '$CONTAINER_NAME'..."
  docker stop $CONTAINER_NAME 2>/dev/null || true
  docker rm   $CONTAINER_NAME 2>/dev/null || true
  echo "✅ Container '$CONTAINER_NAME' has been stopped and deleted."
else
  echo "ℹ️ Container '$CONTAINER_NAME' is not active or already deleted."
fi

# 2. Clean up Docker image
echo "[2/3] Cleaning up Docker image ($IMAGE)..."
docker rmi $IMAGE 2>/dev/null || true
echo "✅ Image cleaned."

# 3. Clean up user data with interactive prompt
echo "[3/3] Handling persistent user directories..."
echo "Do you want to delete your editor settings and ALL project files?"
echo "📂 Settings path: $CONFIG_DIR"
echo "📂 Projects path: $PROJECTS_DIR"
read -p "⚠️ WARNING: This action is permanent. Delete all data? (y/N): " confirm

if [[ "$confirm" =~ ^[Yy]$ ]]; then
  echo "🗑️ Deleting data folders..."
  rm -rf "$CONFIG_DIR"
  rm -rf "$PROJECTS_DIR"
  echo "✅ All configurations and user projects have been deleted permanently."
else
  echo "🔒 Keeping data directories. Your files remain untouched."
  echo "  📂 Preserved Projects: $PROJECTS_DIR"
  echo "  📂 Preserved Config:   $CONFIG_DIR"
fi

echo ""
echo "================================================="
echo "🎉 VS Code (code-server) uninstallation complete!"
echo "================================================="
