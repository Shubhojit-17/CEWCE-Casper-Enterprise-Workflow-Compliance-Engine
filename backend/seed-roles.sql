-- Insert CUSTOMER role (new bitmask 128 to avoid conflict with VIEWER at 32)
INSERT INTO roles (id, name, permissions, bitmask, "isSystem", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'CUSTOMER', '["workflow:read", "document:upload"]'::jsonb, 128, false, NOW(), NOW())
ON CONFLICT (name) DO UPDATE SET
  permissions = EXCLUDED.permissions,
  bitmask = EXCLUDED.bitmask,
  "updatedAt" = NOW();

-- Update existing MANAGER role to include assignment capability
UPDATE roles SET
  permissions = '["template:create", "workflow:manage", "workflow:assign", "user:read"]'::jsonb,
  "updatedAt" = NOW()
WHERE name = 'MANAGER';

-- Verify roles
SELECT name, permissions, bitmask FROM roles ORDER BY bitmask;
