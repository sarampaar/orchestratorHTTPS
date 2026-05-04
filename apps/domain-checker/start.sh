#!/bin/sh
# This script runs every time the Docker container starts

# Wait a moment for PostgreSQL to be fully ready
sleep 5

# Automatically push the Prisma schema to the database
echo "Pushing Prisma schema to database..."
npx prisma db push --accept-data-loss

# 2. Start the Node.js background worker
echo "Starting domain checker worker..."
npm start
