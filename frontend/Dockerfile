# =============================================================================
# CEWCE Frontend Dockerfile
# =============================================================================
# Multi-stage build with nginx for production
# =============================================================================

# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Build-time arguments for environment variables
ARG VITE_API_URL
ARG VITE_CASPER_NODE_URL=https://rpc.testnet.casperlabs.io/rpc
ARG VITE_CASPER_CHAIN_NAME=casper-test
ARG VITE_CASPER_EXPLORER_URL=https://testnet.cspr.live
ARG VITE_WORKFLOW_CONTRACT_HASH
ARG VITE_WORKFLOW_CONTRACT_PACKAGE_HASH

# Set environment variables for build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_CASPER_NODE_URL=$VITE_CASPER_NODE_URL
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
