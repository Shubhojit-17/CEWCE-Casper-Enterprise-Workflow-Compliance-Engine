#!/bin/sh
set -e

echo "🔧 Running database migrations..."
npx prisma migrate deploy

echo "🚀 Starting CEWCE Backend..."
exec node dist/index.js
