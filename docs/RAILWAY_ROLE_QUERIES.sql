-- =============================================================================
-- CEWCE Role Management SQL Queries for Railway Data Tab
-- =============================================================================
-- Copy and paste these queries into Railway's "Data" tab -> "Query" section
-- =============================================================================

-- ============================================
-- 1. VIEW ALL ROLES AND THEIR IDs
-- ============================================
SELECT 
  id,
  name,
  description,
  bitmask,
  "isSystem"
FROM roles 
ORDER BY name;

-- ============================================
-- 2. VIEW ALL USERS WITH THEIR ROLES
-- ============================================
SELECT 
  u.id AS user_id,
  u.email,
  u."displayName",
  STRING_AGG(r.name, ', ') AS roles
FROM users u
LEFT JOIN user_roles ur ON u.id = ur."userId"
LEFT JOIN roles r ON ur."roleId" = r.id
GROUP BY u.id, u.email, u."displayName"
ORDER BY u.email;

-- ============================================
-- 3. ADD A ROLE TO A USER
-- ============================================
-- Replace <USER_ID> and <ROLE_ID> with actual values
-- You can get these from queries 1 and 2 above

-- Example: Give user the ADMIN role
-- INSERT INTO user_roles (id, "userId", "roleId", "grantedAt")
-- VALUES (gen_random_uuid()::text, '<USER_ID>', '<ROLE_ID>', NOW());

-- ============================================
-- 4. REMOVE A ROLE FROM A USER
-- ============================================
-- DELETE FROM user_roles 
-- WHERE "userId" = '<USER_ID>' AND "roleId" = '<ROLE_ID>';

-- ============================================
-- 5. MAKE A USER AN ADMIN (Quick Version)
-- ============================================
-- Replace <USER_EMAIL> with the user's email
-- INSERT INTO user_roles (id, "userId", "roleId", "grantedAt")
-- SELECT 
--   gen_random_uuid()::text,
--   u.id,
--   r.id,
--   NOW()
-- FROM users u, roles r
-- WHERE u.email = '<USER_EMAIL>' AND r.name = 'ADMIN'
-- ON CONFLICT DO NOTHING;

-- ============================================
-- 6. VIEW A SPECIFIC USER'S ROLES
-- ============================================
-- Replace <USER_EMAIL> with the user's email
-- SELECT 
--   u.email,
--   r.name AS role_name,
--   r.description,
--   ur."grantedAt"
-- FROM users u
-- JOIN user_roles ur ON u.id = ur."userId"
-- JOIN roles r ON ur."roleId" = r.id
-- WHERE u.email = '<USER_EMAIL>';

-- ============================================
-- 7. CREATE A NEW USER WITH ROLES
-- ============================================
-- This is a multi-step process:
-- Step 1: Create the user
-- INSERT INTO users (id, email, "displayName", "isActive", "emailVerified", "createdAt", "updatedAt")
-- VALUES (gen_random_uuid()::text, 'newuser@example.com', 'New User', true, false, NOW(), NOW());

-- Step 2: Add roles to the user
-- INSERT INTO user_roles (id, "userId", "roleId", "grantedAt")
-- SELECT 
--   gen_random_uuid()::text,
--   u.id,
--   r.id,
--   NOW()
-- FROM users u, roles r
-- WHERE u.email = 'newuser@example.com' AND r.name IN ('USER', 'REQUESTER');

-- ============================================
-- 8. QUICK ROLE LOOKUP BY NAME
-- ============================================
-- Get a specific role's ID:
-- SELECT id FROM roles WHERE name = 'ADMIN';
-- SELECT id FROM roles WHERE name = 'APPROVER';
-- SELECT id FROM roles WHERE name = 'REQUESTER';
-- SELECT id FROM roles WHERE name = 'USER';
-- SELECT id FROM roles WHERE name = 'CUSTOMER';
-- SELECT id FROM roles WHERE name = 'MANAGER';
