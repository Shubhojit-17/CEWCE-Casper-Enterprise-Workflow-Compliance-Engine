// =============================================================================
// Demo Steps Definition - TESTNET ONLY
// =============================================================================
// This file defines the linear flow of demo steps.
// All demo code is isolated in src/demo/ and can be safely removed for mainnet.
// =============================================================================

import type { DemoStep } from './types';
import { DEMO_CONFIG } from './demoConfig';

/**
 * Complete demo step definitions in strict linear order.
 * Users cannot jump between steps - they must progress sequentially.
 */
export const DEMO_STEPS: DemoStep[] = [
  // =========================================================================
  // Step 0: Orientation
  // =========================================================================
  {
    id: 'orientation',
    role: null,
    title: 'Welcome to the CEWCE Demo',
    description: `This guided demo will walk you through the complete Casper Enterprise Workflow Compliance Engine.

You will experience:
• Creating a compliance workflow as a Requester
• Reviewing and accepting as a Customer
• Approving and recording on-chain as an Approver

All actions use automated testnet accounts - no credentials required.
Your decisions will be recorded immutably on Casper testnet.`,
    instruction: `Estimated time: ${DEMO_CONFIG.estimatedTime}. Click "Start Demo" to begin.`,
    action: 'navigate',
    nextButtonText: 'Start Demo',
    showSkip: true,
    estimatedTime: DEMO_CONFIG.estimatedTime,
  },

  // =========================================================================
  // Step 1: Requester Login
  // =========================================================================
  {
    id: 'requester-login',
    role: 'requester',
    title: 'Logging in as Requester',
    description: 'You are now being logged in as the Requester role. This role creates and submits workflow requests for compliance review.',
    instruction: 'Please wait while we securely authenticate you...',
    action: 'auto-login',
    nextButtonText: 'Continue',
    showSkip: true,
  },

  // =========================================================================
  // Step 2: Navigate to Workflows
  // =========================================================================
  {
    id: 'requester-navigate-workflows',
    role: 'requester',
    title: 'Navigate to Workflows',
    description: 'The Requester can view all workflows and create new ones. Let\'s navigate to the Workflows page.',
    instruction: 'Click on "Workflows" in the sidebar, or click Continue to auto-navigate.',
    targetSelector: '[data-demo-target="nav-workflows"]',
    targetPath: '/workflows',
    action: 'navigate',
    nextButtonText: 'Continue',
    showSkip: true,
  },

  // =========================================================================
  // Step 3: Create Workflow
  // =========================================================================
  {
    id: 'requester-create-workflow',
    role: 'requester',
    title: 'Create a New Workflow',
    description: `Scenario: A customer has requested a vehicle loan. You need to create a compliance workflow for this request.

Click "Create Workflow" to start a new workflow request.`,
    instruction: 'Click the "Create Workflow" button to proceed.',
    targetSelector: '[data-demo-target="create-workflow-btn"]',
    targetPath: '/workflows',
    action: 'wait-for-action',
    nextButtonText: 'I\'ve Created the Workflow',
    showSkip: true,
  },

  // =========================================================================
  // Step 4: Assign Customer
  // =========================================================================
  {
    id: 'requester-assign-customer',
    role: 'requester',
    title: 'Assign to Customer',
    description: 'When creating a workflow, you must assign it to a customer who will review and confirm the request.',
    instruction: 'Select "Demo Customer (User1)" as the assigned customer, then submit the workflow.',
    targetSelector: '[data-demo-target="customer-select"]',
    action: 'wait-for-action',
    nextButtonText: 'Workflow Created',
    showSkip: true,
  },

  // =========================================================================
  // Step 5: Requester to User Transition
  // =========================================================================
  {
    id: 'requester-to-user-transition',
    role: 'requester',
    title: 'Role Transition: Requester → Customer',
    description: `Excellent! You've created a workflow as the Requester.

In a real enterprise, the Customer (User1) would now receive a notification that they have a workflow to review.

For this demo, we'll switch roles so you can experience the Customer perspective.`,
    instruction: 'Click Continue to log out and log in as the Customer.',
    action: 'auto-logout',
    nextButtonText: 'Switch to Customer',
    showSkip: true,
  },

  // =========================================================================
  // Step 6: User Login
  // =========================================================================
  {
    id: 'user-login',
    role: 'user',
    title: 'Logging in as Customer',
    description: 'You are now being logged in as the Customer (User1). This role reviews and confirms assigned workflow requests.',
    instruction: 'Please wait while we securely authenticate you...',
    action: 'auto-login',
    nextButtonText: 'Continue',
    showSkip: true,
  },

  // =========================================================================
  // Step 7: View Inbox
  // =========================================================================
  {
    id: 'user-view-inbox',
    role: 'user',
    title: 'Review Your Inbox',
    description: 'As a Customer, you can see workflows assigned to you. The workflow you just created should appear here.',
    instruction: 'Navigate to Workflows to see your assigned items.',
    targetSelector: '[data-demo-target="nav-workflows"]',
    targetPath: '/workflows',
    action: 'navigate',
    nextButtonText: 'Continue',
    showSkip: true,
  },

  // =========================================================================
  // Step 8: Accept Workflow
  // =========================================================================
  {
    id: 'user-accept-workflow',
    role: 'user',
    title: 'Confirm the Workflow',
    description: 'Click on the workflow to view its details, then confirm/accept it to proceed with the compliance review.',
    instruction: 'Open the workflow and click "Confirm" or "Accept" to proceed.',
    action: 'wait-for-action',
    nextButtonText: 'Workflow Confirmed',
    showSkip: true,
  },

  // =========================================================================
  // Step 9: User to Approver Transition
  // =========================================================================
  {
    id: 'user-to-approver-transition',
    role: 'user',
    title: 'Role Transition: Customer → Approver',
    description: `Great! You've confirmed the workflow as the Customer.

The workflow is now ready for final compliance review. In a real enterprise, an Approver would receive this for review.

Let's switch to the Approver role to complete the compliance cycle.`,
    instruction: 'Click Continue to log out and log in as the Approver.',
    action: 'auto-logout',
    nextButtonText: 'Switch to Approver',
    showSkip: true,
  },

  // =========================================================================
  // Step 10: Approver Login
  // =========================================================================
  {
    id: 'approver-login',
    role: 'approver',
    title: 'Logging in as Approver',
    description: 'You are now being logged in as the Approver. This role has the authority to approve or reject workflows, with decisions recorded on-chain.',
    instruction: 'Please wait while we securely authenticate you...',
    action: 'auto-login',
    nextButtonText: 'Continue',
    showSkip: true,
  },

  // =========================================================================
  // Step 11: Review Workflow
  // =========================================================================
  {
    id: 'approver-review-workflow',
    role: 'approver',
    title: 'Review the Workflow',
    description: 'As an Approver, review the workflow details, documents, and compliance requirements before making a decision.',
    instruction: 'Navigate to the workflow and review its details.',
    targetSelector: '[data-demo-target="nav-workflows"]',
    targetPath: '/workflows',
    action: 'navigate',
    nextButtonText: 'Continue',
    showSkip: true,
  },

  // =========================================================================
  // Step 12: Approve/Reject Action
  // =========================================================================
  {
    id: 'approver-action',
    role: 'approver',
    title: 'Make Your Decision',
    description: `This is the critical step. Your decision will be:
• Recorded immutably on Casper testnet
• Cryptographically signed
• Permanently auditable

Choose to Approve or Reject the workflow.`,
    instruction: 'Click "Approve" or "Reject" to record your decision on-chain.',
    targetSelector: '[data-demo-target="approve-btn"], [data-demo-target="reject-btn"]',
    action: 'wait-for-action',
    nextButtonText: 'Decision Recorded',
    showSkip: false, // Don't allow skip at this critical step
  },

  // =========================================================================
  // Step 13: On-Chain Proof
  // =========================================================================
  {
    id: 'onchain-proof',
    role: 'approver',
    title: 'On-Chain Proof Recorded',
    description: `🎉 Congratulations! Your compliance decision has been recorded on Casper testnet.

This transaction is:
• Immutable - Cannot be altered or deleted
• Transparent - Publicly verifiable on the blockchain
• Timestamped - Cryptographically proven time of decision

This is the core value of CEWCE: enterprise compliance with blockchain-grade auditability.`,
    instruction: 'Click the transaction hash or explorer link to verify on Casper testnet.',
    targetSelector: '[data-demo-target="tx-hash"], [data-demo-target="explorer-link"]',
    action: 'wait-for-action',
    nextButtonText: 'Complete Demo',
    showSkip: true,
  },

  // =========================================================================
  // Step 14: Demo Complete
  // =========================================================================
  {
    id: 'demo-complete',
    role: null,
    title: 'Demo Complete!',
    description: `You've experienced the complete CEWCE workflow:

✅ Requester created a compliance workflow
✅ Customer reviewed and confirmed
✅ Approver made an on-chain decision
✅ Transaction recorded on Casper testnet

CEWCE brings enterprise compliance into the blockchain era - transparent, immutable, and auditable.`,
    instruction: 'Thank you for completing the demo!',
    action: 'complete',
    nextButtonText: 'Exit Demo',
    showSkip: false,
  },
];

/**
 * Get a step by its ID
 */
export function getStepById(id: string): DemoStep | undefined {
  return DEMO_STEPS.find(step => step.id === id);
}

/**
 * Get step index by ID
 */
export function getStepIndex(id: string): number {
  return DEMO_STEPS.findIndex(step => step.id === id);
}

/**
 * Get the next step after current
 */
export function getNextStep(currentIndex: number): DemoStep | null {
  if (currentIndex >= DEMO_STEPS.length - 1) return null;
  return DEMO_STEPS[currentIndex + 1];
}

/**
 * Check if step requires a role transition
 */
export function isTransitionStep(step: DemoStep): boolean {
  return step.action === 'auto-logout' || step.action === 'auto-login';
}
