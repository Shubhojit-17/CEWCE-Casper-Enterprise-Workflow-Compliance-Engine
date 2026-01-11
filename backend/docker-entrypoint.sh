#!/bin/sh
set -e

echo "🔧 Pushing database schema..."
npx prisma db push --skip-generate 2>/dev/null || echo "DB push completed (or schema unchanged)"

# Write Casper deployer keys from environment variables to files
echo "🔑 Setting up Casper deployer keys..."
mkdir -p /tmp/casper

if [ -n "$CASPER_SECRET_KEY_PEM" ]; then
  echo "$CASPER_SECRET_KEY_PEM" | base64 -d > /tmp/casper/secret_key.pem
  chmod 600 /tmp/casper/secret_key.pem
  echo "  ✓ Secret key written"
else
  echo "  ⚠ CASPER_SECRET_KEY_PEM not set"
fi

if [ -n "$CASPER_PUBLIC_KEY_PEM" ]; then
  echo "$CASPER_PUBLIC_KEY_PEM" | base64 -d > /tmp/casper/public_key.pem
  chmod 644 /tmp/casper/public_key.pem
  echo "  ✓ Public key written"
else
  echo "  ⚠ CASPER_PUBLIC_KEY_PEM not set"
fi

if [ -n "$CASPER_PUBLIC_KEY_HEX" ]; then
  echo "$CASPER_PUBLIC_KEY_HEX" > /tmp/casper/public_key_hex
  chmod 644 /tmp/casper/public_key_hex
  echo "  ✓ Public key hex written"
else
  echo "  ⚠ CASPER_PUBLIC_KEY_HEX not set"
fi

echo "🌱 Running database seed..."
node docker-seed.cjs 2>/dev/null || echo "Seed skipped (users may already exist)"

echo "🚀 Starting CEWCE Backend..."
exec node dist/index.js
