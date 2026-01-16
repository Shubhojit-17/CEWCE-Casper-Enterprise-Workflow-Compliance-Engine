/**
 * Narrative Lab - Sticky Dashboard Component
 * Glassmorphism-style dashboard that updates based on scroll state
 */
import { motion } from 'framer-motion';
import { WorkflowDiagram, type WorkflowState } from './WorkflowDiagram';
import { DocumentVault } from './DocumentVault';
import { ProofBadge } from './ProofBadge';
import { CasperStatusBar } from './CasperStatusBar';
import { ReviewerAvatars } from './ReviewerAvatars';

interface StickyDashboardProps {
  activeState: WorkflowState;
}

export function StickyDashboard({ activeState }: StickyDashboardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className="sticky top-24 h-fit"
    >
      {/* Glassmorphism Container */}
      <div className="relative p-6 rounded-2xl overflow-hidden">
        {/* Glass background */}
        <div className="absolute inset-0 bg-white/[0.03] backdrop-blur-xl rounded-2xl" />
        <div className="absolute inset-0 border border-white/10 rounded-2xl" />
        
        {/* Gradient accent */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-red-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl" />

        {/* Content */}
        <div className="relative z-10 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <h3 className="text-lg font-semibold text-white">Workflow Monitor</h3>
              <p className="text-xs text-white/40">Real-time compliance tracking</p>
            </div>
            <StateIndicator state={activeState} />
          </div>

          {/* Workflow Diagram */}
          <div className="py-4">
            <WorkflowDiagram activeState={activeState} />
          </div>

          {/* Grid layout for components */}
          <div className="grid grid-cols-2 gap-4">
            {/* Document Vault */}
            <div className="col-span-2">
              <DocumentVault activeState={activeState} />
            </div>

            {/* Reviewers */}
            <div className="col-span-2">
              <ReviewerAvatars activeState={activeState} />
            </div>

            {/* Proof Badge */}
            <div className="col-span-1">
              <ProofBadge activeState={activeState} />
            </div>

            {/* Casper Status */}
            <div className="col-span-1">
              <div className="space-y-3">
                <span className="text-xs text-white/50 uppercase tracking-wider">
                  Network Status
                </span>
                <CasperStatusBar activeState={activeState} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StateIndicator({ state }: { state: WorkflowState }) {
  const stateColors: Record<WorkflowState, string> = {
    DRAFT: 'bg-slate-500',
    CONFIRM: 'bg-blue-500',
    DOCUMENTS: 'bg-amber-500',
    REVIEW: 'bg-purple-500',
    APPROVED: 'bg-green-500',
    ANCHOR: 'bg-red-500',  // Casper red for on-chain
  };

  return (
    <motion.div
      key={state}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10"
    >
      <motion.div
        className={`w-2 h-2 rounded-full ${stateColors[state]}`}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      <span className="text-xs font-medium text-white/70">{state}</span>
    </motion.div>
  );
}
