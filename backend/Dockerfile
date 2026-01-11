# =============================================================================
# CEWCE Backend Dockerfile
# =============================================================================
# Multi-stage build for optimized production image
# =============================================================================

# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:18-alpine AS production

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S cewce -u 1001

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm ci --omit=dev && \
    npx prisma generate && \
    npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Set ownership
RUN chown -R cewce:nodejs /app

# Switch to non-root user
USER cewce

# Railway injects PORT dynamically - don't hardcode
# EXPOSE is just documentation, Railway uses PORT env var
EXPOSE 4000

# Health check - use correct path /api/v1/health
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-4000}/api/v1/health || exit 1

# Start application with migrations
ENTRYPOINT ["./docker-entrypoint.sh"]
