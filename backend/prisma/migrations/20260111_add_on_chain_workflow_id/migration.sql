-- AddOnChainWorkflowId
-- Add onChainWorkflowId field to WorkflowTemplate for storing the U256 workflow ID
-- returned by the create_workflow smart contract entrypoint.

-- AlterTable
ALTER TABLE "workflow_templates" ADD COLUMN "onChainWorkflowId" BIGINT;

-- AlterTable  
ALTER TABLE "workflow_templates" ADD COLUMN "registrationDeployHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "workflow_templates_onChainWorkflowId_key" ON "workflow_templates"("onChainWorkflowId");
