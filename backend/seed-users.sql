-- Create single-role test accounts
-- Get role IDs
DO $$
DECLARE
  user_role_id TEXT;
  requester_role_id TEXT;
  approver_role_id TEXT;
  org_id TEXT;
  new_user_id TEXT;
BEGIN
  SELECT id INTO user_role_id FROM roles WHERE name = 'USER';
  SELECT id INTO requester_role_id FROM roles WHERE name = 'REQUESTER';
  SELECT id INTO approver_role_id FROM roles WHERE name = 'APPROVER';
  SELECT id INTO org_id FROM organizations WHERE slug = 'default';

  -- User-only account
  IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'user@cewce.local') THEN
    new_user_id := gen_random_uuid()::text;
    INSERT INTO users (id, email, "passwordHash", "displayName", "firstName", "lastName", "emailVerified", "isActive", "createdAt", "updatedAt")
    VALUES (new_user_id, 'user@cewce.local', '47a43d5288e72e65129aaff355e334d4:8cddf172f129b0b6e77db4681d35724480c25777122575489b0607b77e15e7fb7b49f73394b2b87e6d40bac8f1356eae47920340b7ff6cd3012e4252ff51fbda', 'Test User', 'Test', 'User', true, true, NOW(), NOW());
    INSERT INTO user_roles (id, "userId", "roleId", "grantedAt") VALUES (gen_random_uuid()::text, new_user_id, user_role_id, NOW());
    INSERT INTO organization_users (id, "userId", "orgId", role) VALUES (gen_random_uuid()::text, new_user_id, org_id, 'MEMBER');
    RAISE NOTICE 'Created user@cewce.local';
  END IF;

  -- Requester-only account
  IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'requester@cewce.local') THEN
    new_user_id := gen_random_uuid()::text;
    INSERT INTO users (id, email, "passwordHash", "displayName", "firstName", "lastName", "emailVerified", "isActive", "createdAt", "updatedAt")
    VALUES (new_user_id, 'requester@cewce.local', '7bfa66501e374ad2365b9b0416a9754d:bc2aa4d3e9e8c9c854dbdee23fa14505be7e55c2833d1edc6fdddcf4ee7b518fb96717fb67dd665f7295b442578cdacfd88aec2e8eaefdf15fee8cbbef08c53e', 'Test Requester', 'Test', 'Requester', true, true, NOW(), NOW());
    INSERT INTO user_roles (id, "userId", "roleId", "grantedAt") VALUES (gen_random_uuid()::text, new_user_id, requester_role_id, NOW());
    INSERT INTO organization_users (id, "userId", "orgId", role) VALUES (gen_random_uuid()::text, new_user_id, org_id, 'MEMBER');
    RAISE NOTICE 'Created requester@cewce.local';
  END IF;

  -- Approver-only account
  IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'approver@cewce.local') THEN
    new_user_id := gen_random_uuid()::text;
    INSERT INTO users (id, email, "passwordHash", "displayName", "firstName", "lastName", "emailVerified", "isActive", "createdAt", "updatedAt")
    VALUES (new_user_id, 'approver@cewce.local', 'c14ea3bafab8a15a0f5fd58d004f380c:830a423a72270d726aadcd64d65b53526ffc42f27371928363a286bc0c1f626a36937e439f932f798716a719071bba797ed86fd9172dc621ebc2b75a50e0a6cd', 'Test Approver', 'Test', 'Approver', true, true, NOW(), NOW());
    INSERT INTO user_roles (id, "userId", "roleId", "grantedAt") VALUES (gen_random_uuid()::text, new_user_id, approver_role_id, NOW());
    INSERT INTO organization_users (id, "userId", "orgId", role) VALUES (gen_random_uuid()::text, new_user_id, org_id, 'MEMBER');
    RAISE NOTICE 'Created approver@cewce.local';
  END IF;
END $$;

-- Verify
SELECT u.email, array_agg(r.name) as roles
FROM users u
JOIN user_roles ur ON ur."userId" = u.id
JOIN roles r ON r.id = ur."roleId"
GROUP BY u.email
ORDER BY u.email;
