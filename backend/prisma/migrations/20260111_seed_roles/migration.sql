-- =============================================================================
-- Seed Default Roles Migration
-- =============================================================================
-- This migration ensures all required roles exist in the database.
-- Safe to run multiple times (uses ON CONFLICT DO UPDATE).
-- =============================================================================

-- Insert or update default roles
INSERT INTO roles (id, name, description, permissions, bitmask, "isSystem", "createdAt", "updatedAt")
VALUES 
  (gen_random_uuid()::text, 'ADMIN', 'Full system administrator access', '["*"]'::jsonb, 8, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'AUDITOR', 'Can view audit logs and verify compliance', '["audit:read", "audit:export", "workflow:read"]'::jsonb, 16, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'SENIOR_APPROVER', 'Can approve escalated workflows', '["workflow:approve", "workflow:reject", "workflow:read"]'::jsonb, 4, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'APPROVER', 'Can approve or reject workflows', '["workflow:approve", "workflow:reject", "workflow:read"]'::jsonb, 2, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'USER', 'Regular user with basic permissions', '["workflow:read", "workflow:create"]'::jsonb, 1, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'REQUESTER', 'Can create workflow instances', '["workflow:create", "workflow:read"]'::jsonb, 1, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'CUSTOMER', 'External customer - can view assigned workflows and upload documents', '["workflow:read", "document:upload"]'::jsonb, 128, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'MANAGER', 'Can assign approvers and manage workflow assignments', '["template:create", "workflow:manage", "workflow:assign", "user:read"]'::jsonb, 0, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'VIEWER', 'View-only access to workflows', '["workflow:read"]'::jsonb, 32, true, NOW(), NOW())
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  bitmask = EXCLUDED.bitmask,
  "isSystem" = EXCLUDED."isSystem",
  "updatedAt" = NOW();

-- Create default organization if it doesn't exist
INSERT INTO organizations (id, name, slug, description, "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'Default Organization', 'default', 'Default organization', NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;
