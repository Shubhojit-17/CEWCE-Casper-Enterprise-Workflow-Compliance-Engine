-- =============================================================================
-- Enterprise Extensions Migration
-- ADDITIVE ONLY - No breaking changes
-- =============================================================================
-- This migration adds:
-- 1. CUSTOMER and MANAGER roles support
-- 2. assignedCustomerId and assignedApproverId for workflow assignment
-- 3. SUBMITTED and REJECTED status for rejection/resubmission flow
-- 4. PENDING_CUSTOMER_CONFIRMATION for customer confirmation flow
-- =============================================================================

-- Add new instance statuses (PostgreSQL enum extension)
-- Note: PostgreSQL requires ALTER TYPE for adding enum values
ALTER TYPE "InstanceStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';
ALTER TYPE "InstanceStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "InstanceStatus" ADD VALUE IF NOT EXISTS 'PENDING_CUSTOMER_CONFIRMATION';

-- Add assignment columns to workflow_instances (nullable, non-breaking)
ALTER TABLE "workflow_instances" ADD COLUMN IF NOT EXISTS "assignedCustomerId" TEXT;
ALTER TABLE "workflow_instances" ADD COLUMN IF NOT EXISTS "assignedApproverId" TEXT;

-- Add foreign key constraints
ALTER TABLE "workflow_instances" 
  ADD CONSTRAINT "workflow_instances_assignedCustomerId_fkey" 
  FOREIGN KEY ("assignedCustomerId") REFERENCES "users"("id") 
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workflow_instances" 
  ADD CONSTRAINT "workflow_instances_assignedApproverId_fkey" 
  FOREIGN KEY ("assignedApproverId") REFERENCES "users"("id") 
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes for efficient lookups
CREATE INDEX IF NOT EXISTS "workflow_instances_assignedCustomerId_idx" ON "workflow_instances"("assignedCustomerId");
CREATE INDEX IF NOT EXISTS "workflow_instances_assignedApproverId_idx" ON "workflow_instances"("assignedApproverId");
