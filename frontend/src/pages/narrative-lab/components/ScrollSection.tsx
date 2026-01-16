/**
 * Narrative Lab - Scroll Section Component
 * Individual scroll section with opacity based on active state
 */
import { motion } from 'framer-motion';
import type { WorkflowState } from './WorkflowDiagram';

interface ScrollSectionProps {
  state: WorkflowState;
  isActive: boolean;
  title: string;
  description: string;
  details: string[];
  icon: React.ReactNode;
}

export function ScrollSection({ 
  state, 
  isActive, 
  title, 
  description, 
  details,
  icon 
}: ScrollSectionProps) {
  return (
    <motion.section
      data-step={state}
      className="min-h-screen flex items-start pt-24 pb-32"
      animate={{ opacity: isActive ? 1 : 0.15 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-lg">
        {/* State badge */}
        <motion.div
          className={`
            inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6
            ${isActive ? 'bg-red-500/20 border border-red-500/30' : 'bg-white/5 border border-white/10'}
          `}
          animate={isActive ? { scale: [1, 1.02, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className={`text-xs font-mono ${isActive ? 'text-red-400' : 'text-white/40'}`}>
            {state}
          </span>
        </motion.div>

        {/* Icon */}
        <motion.div
          className={`
            w-16 h-16 rounded-2xl flex items-center justify-center mb-6
            ${isActive ? 'bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/20' : 'bg-white/5 border border-white/10'}
          `}
          animate={isActive ? { y: [0, -5, 0] } : {}}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className={isActive ? 'text-red-400' : 'text-white/30'}>
            {icon}
          </div>
        </motion.div>

        {/* Title */}
        <h2 className={`text-4xl font-bold mb-4 ${isActive ? 'text-white' : 'text-white/50'}`}>
          {title}
        </h2>

        {/* Description */}
        <p className={`text-lg leading-relaxed mb-6 ${isActive ? 'text-white/70' : 'text-white/30'}`}>
          {description}
        </p>

        {/* Details list */}
        <ul className="space-y-3">
          {details.map((detail, idx) => (
            <motion.li
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: isActive ? 1 : 0.3, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="flex items-start gap-3"
            >
              <div className={`
                w-1.5 h-1.5 rounded-full mt-2
                ${isActive ? 'bg-red-400' : 'bg-white/20'}
              `} />
              <span className={`text-sm ${isActive ? 'text-white/60' : 'text-white/20'}`}>
                {detail}
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.section>
  );
}

// Scroll section data - ALIGNED WITH CEWCE WORKFLOW LIFECYCLE
// Important: Only ANCHOR touches the blockchain. All prior states are off-chain.
export const scrollSections: Array<{
  state: WorkflowState;
  title: string;
  description: string;
  details: string[];
}> = [
  {
    state: 'DRAFT',
    title: 'Workflow Creation',
    description: 'The Requester initiates a new compliance workflow. Define participants, set approval requirements, and establish the document structure—all off-chain and fully editable.',
    details: [
      'Requester creates workflow from template or scratch',
      'Define approval hierarchy and required participants',
      'Set document requirements and compliance criteria',
      'Workflow remains private and editable until confirmation',
    ],
  },
  {
    state: 'CONFIRM',
    title: 'User Confirmation',
    description: 'Assigned users confirm their participation in the workflow. Each confirmation is logged, establishing accountability before document submission begins.',
    details: [
      'Users (Customers) receive workflow assignment notification',
      'Participants review requirements and confirm acceptance',
      'All confirmations tracked in audit log',
      'No blockchain activity—still fully off-chain',
    ],
  },
  {
    state: 'DOCUMENTS',
    title: 'Document Submission',
    description: 'Upload and manage compliance documents securely. Files are stored off-chain and remain editable. Cryptographic hashes are computed for each document, preparing them for future anchoring.',
    details: [
      'Secure document upload with end-to-end encryption',
      'Documents stored off-chain—never on the blockchain',
      'SHA-256 hashes computed for integrity verification',
      'Version control allows revisions until approval',
    ],
  },
  {
    state: 'REVIEW',
    title: 'Approver Review',
    description: 'The Approver examines submitted documents and workflow details. They may request revisions (rejection loop) or grant approval. Every action is logged.',
    details: [
      'Approver reviews all submitted documents',
      'Comments and feedback provided inline',
      'Rejection sends workflow back for revision (off-chain loop)',
      'Only approved workflows proceed to blockchain anchoring',
    ],
  },
  {
    state: 'APPROVED',
    title: 'Approval Decision',
    description: 'The Approver grants final approval. This is the human decision point—the moment of consensus. The workflow is now locked and ready for blockchain registration.',
    details: [
      'Approver digitally signs the approval decision',
      'All documents and metadata are finalized',
      'Document vault locks—no further edits allowed',
      'Final hash aggregation computed for anchoring',
    ],
  },
  {
    state: 'ANCHOR',
    title: 'Blockchain Registration',
    description: 'The compliance proof is anchored to the Casper blockchain. This is the only step that touches the chain—creating an immutable, permanent record that auditors can verify forever.',
    details: [
      'Merkle root of all document hashes submitted to Casper',
      'Transaction achieves finality in ~2 seconds',
      'Compliance proof certificate generated',
      'Immutable audit trail available for public verification',
    ],
  },
];

// Icons for each state
export const stateIcons: Record<WorkflowState, React.ReactNode> = {
  DRAFT: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  CONFIRM: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  DOCUMENTS: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  ),
  REVIEW: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  APPROVED: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  ANCHOR: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
};
