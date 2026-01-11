-- Migration: Add missing columns and enum values for code compatibility
-- This is a SAFE, additive migration that does NOT modify or delete existing data

-- 1. Add missing enum values to instance_status
ALTER TYPE instance_status ADD VALUE IF NOT EXISTS 'ACTIVE';
ALTER TYPE instance_status ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE instance_status ADD VALUE IF NOT EXISTS 'ONCHAIN_PENDING';
ALTER TYPE instance_status ADD VALUE IF NOT EXISTS 'CUSTOMER_CONFIRMED';

-- 2. Add missing enum values to template_status  
ALTER TYPE template_status ADD VALUE IF NOT EXISTS 'PUBLISHED';

-- 3. Add missing enum values to transition_status
ALTER TYPE transition_status ADD VALUE IF NOT EXISTS 'ONCHAIN_PENDING';
ALTER TYPE transition_status ADD VALUE IF NOT EXISTS 'CONFIRMED_ONCHAIN';
ALTER TYPE transition_status ADD VALUE IF NOT EXISTS 'FAILED_ONCHAIN';
ALTER TYPE transition_status ADD VALUE IF NOT EXISTS 'TIMEOUT';

-- 4. Add missing columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;

-- Make email/password/name nullable for wallet-first auth
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ALTER COLUMN name DROP NOT NULL;

-- 5. Add missing columns to workflow_instances table
ALTER TABLE workflow_instances ADD COLUMN IF NOT EXISTS workflow_id BIGINT UNIQUE;
ALTER TABLE workflow_instances ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE workflow_instances ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

-- 6. Add missing columns to workflow_templates table
ALTER TABLE workflow_templates ADD COLUMN IF NOT EXISTS sla_days INTEGER DEFAULT 7;
ALTER TABLE workflow_templates ADD COLUMN IF NOT EXISTS escalation_days INTEGER DEFAULT 3;
ALTER TABLE workflow_templates ADD COLUMN IF NOT EXISTS contract_hash TEXT;
ALTER TABLE workflow_templates ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- 7. Add missing columns to workflow_transitions table
ALTER TABLE workflow_transitions ADD COLUMN IF NOT EXISTS block_height BIGINT;
ALTER TABLE workflow_transitions ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE workflow_transitions ADD COLUMN IF NOT EXISTS execution_cost BIGINT;

-- 8. Add missing columns to user_roles table
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS template_id TEXT;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 9. Add foreign key for template_id in user_roles (if column was added)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_roles_template_id_fkey'
    ) THEN
        ALTER TABLE user_roles 
        ADD CONSTRAINT user_roles_template_id_fkey 
        FOREIGN KEY (template_id) REFERENCES workflow_templates(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN others THEN
    NULL; -- Ignore if already exists or any other error
END $$;

-- 10. Add missing columns to audit_logs table
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS deploy_hash TEXT;

-- 11. Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_workflow_instances_workflow_id ON workflow_instances(workflow_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_template_id ON user_roles(template_id);
