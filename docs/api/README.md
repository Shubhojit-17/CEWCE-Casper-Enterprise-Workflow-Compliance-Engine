# API Documentation

This directory contains API specifications for the CEWCE backend services.

## API Overview

The CEWCE backend exposes a REST API for:
- Workflow template management
- Workflow instance operations
- User and role management
- Audit log queries
- Blockchain transaction status

## Authentication

All API endpoints (except health checks) require authentication via JWT tokens.
Tokens are obtained through the authentication endpoint after wallet signature verification.

## Base URL

- Development: `http://localhost:3001/api/v1`
- Production: `<PROVIDED_AT_DEPLOYMENT>`

## Endpoints

Detailed endpoint documentation will be generated from OpenAPI specifications
as implementation progresses.
