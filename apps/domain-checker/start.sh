#!/bin/sh
# This script runs every time the Docker container starts

# 1. Automatically push the Prisma schema to the database to create/update tables
echo "Pushing Prisma schema to database..."
npx prisma db push

# 2. Start the Node.js background worker
echo "Starting domain checker worker..."
npm start
