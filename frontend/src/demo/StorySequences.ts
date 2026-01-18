// =============================================================================
// Demo Story Sequences - Bank Loan Compliance Scenario - TESTNET ONLY
// =============================================================================
// Story-driven demo sequences for the guided compliance simulation.
// Each sequence maps to a demoStep state with narrative text.
// =============================================================================

import type { DemoRole } from './types';

/**
 * Story sequence interface for NarrativeBox integration
 */
export interface StorySequence {
  id: string;
  sequenceLabel: string;  // e.g., "SEQ_01"
  title: string;          // e.g., "REQUEST CREATION"
  narrative: string[];    // Paragraphs of narrative text
  action?: 'click' | 'wait' | 'auto';
  actionText?: string;    // Button text for user action
  targetSelector?: string;
  role?: DemoRole | null;
  nextSequence?: string;
  showSkip?: boolean;
}

/**
 * Complete story sequences for the Bank Loan Compliance Scenario
 */
export const STORY_SEQUENCES: StorySequence[] = [
  // =========================================================================
  // SEQ_00 — INITIALIZATION
  // =========================================================================
  {
    id: 'seq-00-init',
    sequenceLabel: 'SEQ_00',
    title: 'INITIALIZATION',
    narrative: [
      'You are entering a guided compliance simulation.',
      'This scenario demonstrates how a bank processes a customer loan request — from submission to final approval — with every critical decision recorded immutably.',
    ],
    action: 'click',
    actionText: 'Initialize System',
    showSkip: true,
    nextSequence: 'seq-01-request',
  },

  // =========================================================================
  // SEQ_01 — REQUEST CREATION
  // =========================================================================
  {
    id: 'seq-01-request',
    sequenceLabel: 'SEQ_01',
    title: 'REQUEST CREATION',
    narrative: [
      'A customer has requested a loan.',
      'As the requester, you define the workflow: required documents, review participants, and final approval authority.',
    ],
    action: 'click',
    actionText: 'Create Workflow',
    role: 'requester',
    targetSelector: '[data-demo-target="create-workflow-btn"]',
    showSkip: true,
    nextSequence: 'seq-02-confirm',
  },

  // =========================================================================
  // SEQ_02 — CUSTOMER CONFIRMATION
  // =========================================================================
  {
    id: 'seq-02-confirm',
    sequenceLabel: 'SEQ_02',
    title: 'CUSTOMER CONFIRMATION',
    narrative: [
      'The workflow is assigned to the customer.',
      'Before any review can occur, the customer must confirm participation and acknowledge the document requirements.',
    ],
    action: 'click',
    actionText: 'Confirm Workflow',
    role: 'user',
    targetSelector: '[data-demo-target="confirm-workflow-btn"]',
    showSkip: true,
    nextSequence: 'seq-03-submit',
  },

  // =========================================================================
  // SEQ_03 — DOCUMENT SUBMISSION
  // =========================================================================
  {
    id: 'seq-03-submit',
    sequenceLabel: 'SEQ_03',
    title: 'DOCUMENT SUBMISSION',
    narrative: [
      'The customer submits financial and identity documents.',
      'These documents remain off-chain. Only cryptographic fingerprints are generated for verification.',
    ],
    action: 'click',
    actionText: 'Submit Documents',
    role: 'user',
    targetSelector: '[data-demo-target="submit-documents-btn"]',
    showSkip: true,
    nextSequence: 'seq-04-review',
  },

  // =========================================================================
  // SEQ_04 — APPROVER REVIEW
  // =========================================================================
  {
    id: 'seq-04-review',
    sequenceLabel: 'SEQ_04',
    title: 'REVIEW & DECISION',
    narrative: [
      'The request is now under review.',
      'The approver can approve or reject the request. Only finalized approvals generate immutable proof.',
    ],
    action: 'click',
    actionText: 'Approve',
    role: 'approver',
    targetSelector: '[data-demo-target="approve-btn"]',
    showSkip: true,
    nextSequence: 'seq-05-finality',
  },

  // =========================================================================
  // SEQ_05 — ON-CHAIN FINALITY
  // =========================================================================
  {
    id: 'seq-05-finality',
    sequenceLabel: 'SEQ_05',
    title: 'ON-CHAIN FINALITY',
    narrative: [
      'The approval is finalized.',
      'A cryptographic compliance proof is now anchored on the Casper blockchain, permanently recording this decision.',
    ],
    action: 'auto',
    role: 'approver',
    nextSequence: 'seq-06-rejection',
  },

  // =========================================================================
  // SEQ_06 — REJECTION EXPLANATION
  // =========================================================================
  {
    id: 'seq-06-rejection',
    sequenceLabel: 'SEQ_06',
    title: 'ALTERNATE OUTCOME',
    narrative: [
      'If the request were rejected:',
      '• The workflow returns for revision',
      '• No on-chain proof is created',
      '• Only final approvals are anchored immutably',
    ],
    action: 'click',
    actionText: 'Continue',
    showSkip: false,
    nextSequence: 'seq-07-outcome',
  },

  // =========================================================================
  // SEQ_07 — COMPLIANCE OUTCOME
  // =========================================================================
  {
    id: 'seq-07-outcome',
    sequenceLabel: 'SEQ_07',
    title: 'COMPLIANCE OUTCOME',
    narrative: [
      'This is the core of CEWCE.',
      'Private collaboration stays off-chain. Critical decisions are recorded immutably. Anyone can verify the outcome without trusting internal systems.',
    ],
    action: 'click',
    actionText: 'Complete Simulation',
    showSkip: false,
    nextSequence: 'seq-08-feedback',
  },

  // =========================================================================
  // SEQ_08 — FEEDBACK & EXIT
  // =========================================================================
  {
    id: 'seq-08-feedback',
    sequenceLabel: 'SEQ_08',
    title: 'FEEDBACK',
    narrative: [
      'You\'ve completed the compliance simulation.',
      'How was this experience? Your feedback helps refine enterprise verification workflows.',
    ],
    action: 'click',
    actionText: 'Exit Demo',
    showSkip: false,
    nextSequence: undefined,
  },
];

/**
 * Get sequence by ID
 */
export function getSequenceById(id: string): StorySequence | undefined {
  return STORY_SEQUENCES.find(seq => seq.id === id);
}

/**
 * Get sequence by sequence label (e.g., "SEQ_01")
 */
export function getSequenceByLabel(label: string): StorySequence | undefined {
  return STORY_SEQUENCES.find(seq => seq.sequenceLabel === label);
}

/**
 * Get the initial sequence
 */
export function getInitialSequence(): StorySequence {
  return STORY_SEQUENCES[0];
}

/**
 * Get sequence index
 */
export function getSequenceIndex(id: string): number {
  return STORY_SEQUENCES.findIndex(seq => seq.id === id);
}

/**
 * Get next sequence
 */
export function getNextSequence(currentId: string): StorySequence | null {
  const current = getSequenceById(currentId);
  if (!current?.nextSequence) return null;
  return getSequenceById(current.nextSequence) || null;
}

/**
 * Total number of sequences
 */
export const TOTAL_SEQUENCES = STORY_SEQUENCES.length;
