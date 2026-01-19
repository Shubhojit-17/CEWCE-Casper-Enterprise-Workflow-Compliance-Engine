# =============================================================================
# CEWCE Frontend Dockerfile
# =============================================================================
# Multi-stage build with nginx for production
# =============================================================================

# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Accept build-time environment variables
# For Railway: Set VITE_API_URL to your backend Railway URL (e.g., https://your-backend.up.railway.app/api/v1)
ARG VITE_API_URL=/api/v1
ARG VITE_CASPER_NODE_URL=https://testnet.cspr.live/rpc
ARG VITE_CASPER_NETWORK_NAME=casper-test
ARG VITE_CASPER_CHAIN_NAME=casper-test
ARG VITE_CASPER_EXPLORER_URL=https://testnet.cspr.live
ARG VITE_WORKFLOW_CONTRACT_HASH=hash-f050d3d06be9c182d46ef6edc261daa836e9612b2b42dbbdb25325e682f4a515
ARG VITE_WORKFLOW_CONTRACT_PACKAGE_HASH=hash-9c9b2da90a07c81b4a8671acbe68c744b0828d9c85437b74eafc639795e46054

# Set environment variables for build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_CASPER_NODE_URL=$VITE_CASPER_NODE_URL
ENV VITE_CASPER_NETWORK_NAME=$VITE_CASPER_NETWORK_NAME
ENV VITE_CASPER_CHAIN_NAME=$VITE_CASPER_CHAIN_NAME
ENV VITE_CASPER_EXPLORER_URL=$VITE_CASPER_EXPLORER_URL
ENV VITE_WORKFLOW_CONTRACT_HASH=$VITE_WORKFLOW_CONTRACT_HASH
ENV VITE_WORKFLOW_CONTRACT_PACKAGE_HASH=$VITE_WORKFLOW_CONTRACT_PACKAGE_HASH

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build for production
RUN npm run build

# Stage 2: Production with Nginx
FROM nginx:alpine AS production

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Create non-root user
RUN adduser -D -g '' nginxuser && \
    chown -R nginxuser:nginxuser /usr/share/nginx/html && \
    chown -R nginxuser:nginxuser /var/cache/nginx && \
    chown -R nginxuser:nginxuser /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginxuser:nginxuser /var/run/nginx.pid

# Switch to non-root user
USER nginxuser

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80 || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
