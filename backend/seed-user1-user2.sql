-- Create user1 and user2 accounts with USER role
DO $$
DECLARE
  user_role_id TEXT;
  org_id TEXT;
  new_user_id TEXT;
BEGIN
  SELECT id INTO user_role_id FROM roles WHERE name = 'USER';
  SELECT id INTO org_id FROM organizations WHERE slug = 'default';

  -- User1 account
  IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'user1@cewce.local') THEN
    new_user_id := gen_random_uuid()::text;
    INSERT INTO users (id, email, "passwordHash", "displayName", "firstName", "lastName", "emailVerified", "isActive", "createdAt", "updatedAt")
    VALUES (new_user_id, 'user1@cewce.local', '16a88c3d553fc6d11fcc7f6ef217c491:d8bd6c61e2478d588576d052ca831468a1875378863a5a920bf49c9a9691486de0ad0e026be5ec0750af39789922547679034709bde560ba99c8da1aa212e77a', 'User One', 'User', 'One', true, true, NOW(), NOW());
    INSERT INTO user_roles (id, "userId", "roleId", "grantedAt") VALUES (gen_random_uuid()::text, new_user_id, user_role_id, NOW());
    INSERT INTO organization_users (id, "userId", "orgId", role) VALUES (gen_random_uuid()::text, new_user_id, org_id, 'MEMBER');
    RAISE NOTICE 'Created user1@cewce.local';
  END IF;

  -- User2 account
  IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'user2@cewce.local') THEN
    new_user_id := gen_random_uuid()::text;
    INSERT INTO users (id, email, "passwordHash", "displayName", "firstName", "lastName", "emailVerified", "isActive", "createdAt", "updatedAt")
    VALUES (new_user_id, 'user2@cewce.local', '78f9f5ca89b37a0f0f6e59aef32cc3cc:4f8e8cf52ec16cb2259d18bb6391800d32387965faa81336e4d87e0b61a13d4928ebdcc03775d1a309cae562b7773edb65556386de534c024ff5a1eb49316e31', 'User Two', 'User', 'Two', true, true, NOW(), NOW());
    INSERT INTO user_roles (id, "userId", "roleId", "grantedAt") VALUES (gen_random_uuid()::text, new_user_id, user_role_id, NOW());
    INSERT INTO organization_users (id, "userId", "orgId", role) VALUES (gen_random_uuid()::text, new_user_id, org_id, 'MEMBER');
    RAISE NOTICE 'Created user2@cewce.local';
  END IF;
END $$;

-- Verify
SELECT u.email, array_agg(r.name) as roles
FROM users u
JOIN user_roles ur ON ur."userId" = u.id
JOIN roles r ON r.id = ur."roleId"
GROUP BY u.email
ORDER BY u.email;
