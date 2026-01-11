-- =============================================================================
-- Seed Default Roles Migration
-- =============================================================================
-- This migration:
-- 1. Adds missing columns to roles table (bitmask) if they don't exist
-- 2. Alters permissions column from TEXT[] to JSONB if needed
-- 3. Seeds default roles
-- Note: Uses snake_case column names to match 0001_initial migration
-- =============================================================================

-- Add bitmask column if it doesn't exist
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "bitmask" INTEGER DEFAULT 0;

-- Update any NULL bitmasks
UPDATE "roles" SET "bitmask" = 0 WHERE "bitmask" IS NULL;

-- Alter permissions column type from TEXT[] to JSONB if it's currently TEXT[]
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'roles' 
    AND column_name = 'permissions' 
    AND data_type = 'ARRAY'
  ) THEN
    ALTER TABLE "roles" ALTER COLUMN "permissions" TYPE JSONB USING to_jsonb(permissions);
  END IF;
END $$;

-- Insert or update default roles (using snake_case column names from initial migration)
INSERT INTO roles (id, name, description, permissions, bitmask, "is_system", "created_at", "updated_at")
VALUES 
  (gen_random_uuid()::text, 'ADMIN', 'Full system administrator access', '["*"]'::jsonb, 8, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'AUDITOR', 'Can view audit logs and verify compliance', '["audit:read", "audit:export", "workflow:read"]'::jsonb, 16, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'SENIOR_APPROVER', 'Can approve escalated workflows', '["workflow:approve", "workflow:reject", "workflow:read"]'::jsonb, 4, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'APPROVER', 'Can approve or reject workflows', '["workflow:approve", "workflow:reject", "workflow:read"]'::jsonb, 2, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'USER', 'Regular user with basic permissions', '["workflow:read", "workflow:create"]'::jsonb, 1, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'REQUESTER', 'Can create workflow instances', '["workflow:create", "workflow:read"]'::jsonb, 1, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'CUSTOMER', 'External customer - can view assigned workflows and upload documents', '["workflow:read", "document:upload"]'::jsonb, 128, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'MANAGER', 'Can assign approvers and manage workflow assignments', '["template:create", "workflow:manage", "workflow:assign", "user:read"]'::jsonb, 64, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'VIEWER', 'View-only access to workflows', '["workflow:read"]'::jsonb, 32, true, NOW(), NOW())
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  bitmask = EXCLUDED.bitmask,
  "is_system" = EXCLUDED."is_system",
  "updated_at" = NOW();

-- Create default organization if it doesn't exist (using snake_case column names)
INSERT INTO organizations (id, name, slug, description, "created_at", "updated_at")
VALUES (gen_random_uuid()::text, 'Default Organization', 'default', 'Default organization', NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;
