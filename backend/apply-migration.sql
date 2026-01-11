ALTER TYPE "InstanceStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';
ALTER TYPE "InstanceStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TABLE "workflow_instances" ADD COLUMN IF NOT EXISTS "assignedCustomerId" TEXT;
ALTER TABLE "workflow_instances" ADD COLUMN IF NOT EXISTS "assignedApproverId" TEXT;
CREATE INDEX IF NOT EXISTS "workflow_instances_assignedCustomerId_idx" ON "workflow_instances"("assignedCustomerId");
CREATE INDEX IF NOT EXISTS "workflow_instances_assignedApproverId_idx" ON "workflow_instances"("assignedApproverId");
