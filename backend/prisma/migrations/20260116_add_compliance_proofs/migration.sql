-- =============================================================================
-- Migration: Add Compliance Proofs
-- =============================================================================
-- Creates the compliance_proofs table for storing verifiable compliance proofs
-- that are anchored on the Casper blockchain.
-- =============================================================================

-- Create the compliance proof status enum
DO $$ BEGIN
    CREATE TYPE compliance_proof_status AS ENUM ('PENDING', 'ONCHAIN_PENDING', 'CONFIRMED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create the compliance_proofs table
CREATE TABLE IF NOT EXISTS "compliance_proofs" (
    "id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "final_state" TEXT NOT NULL,
    "approved_by" TEXT NOT NULL,
    "approved_at" TIMESTAMP(3) NOT NULL,
    "document_hashes" JSONB NOT NULL,
    "contract_hash" TEXT NOT NULL,
    "approval_deploy_hash" TEXT NOT NULL,
    "approval_block_hash" TEXT,
    "proof_hash" TEXT NOT NULL,
    "proof_deploy_hash" TEXT,
    "proof_block_hash" TEXT,
    "proof_json" JSONB NOT NULL,
    "status" compliance_proof_status NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),

    CONSTRAINT "compliance_proofs_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on instance_id (one proof per workflow instance)
CREATE UNIQUE INDEX IF NOT EXISTS "compliance_proofs_instance_id_key" ON "compliance_proofs"("instance_id");

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS "compliance_proofs_status_idx" ON "compliance_proofs"("status");
CREATE INDEX IF NOT EXISTS "compliance_proofs_proof_hash_idx" ON "compliance_proofs"("proof_hash");

-- Add foreign key constraint
ALTER TABLE "compliance_proofs" ADD CONSTRAINT "compliance_proofs_instance_id_fkey" 
    FOREIGN KEY ("instance_id") REFERENCES "workflow_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
