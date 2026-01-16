/**
 * Narrative Lab - Reviewer Avatars Component
 * Shows Approver status during REVIEW and APPROVED states
 * 
 * CEWCE Roles:
 * - Approver: Reviews and approves/rejects workflows
 */
import { motion, AnimatePresence } from 'framer-motion';
import type { WorkflowState } from './WorkflowDiagram';

interface ReviewerAvatarsProps {
  activeState: WorkflowState;
}

// Simplified to show single Approver (matching CEWCE role model)
const approver = { id: 1, name: 'Approver', initials: 'AP' };

export function ReviewerAvatars({ activeState }: ReviewerAvatarsProps) {
  // Show approver from REVIEW onwards
  const showApprover = ['REVIEW', 'APPROVED', 'ANCHOR'].includes(activeState);
  const isReviewing = activeState === 'REVIEW';
  const hasApproved = activeState === 'APPROVED' || activeState === 'ANCHOR';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50 uppercase tracking-wider">
          Approver
        </span>
        {hasApproved && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-xs text-green-400"
          >
            Approved ✓
          </motion.span>
        )}
      </div>

      <AnimatePresence>
        {showApprover ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3"
          >
            {/* Approver Avatar */}
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative"
            >
              <motion.div
                className={`
                  w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium
                  border-2 transition-all duration-300
                  ${hasApproved 
                    ? 'bg-green-500/20 border-green-500 text-green-400' 
                    : 'bg-white/10 border-white/20 text-white/60'
                  }
                `}
                animate={isReviewing ? {
                  borderColor: ['rgba(255,255,255,0.2)', 'rgba(168,85,247,0.5)', 'rgba(255,255,255,0.2)']
                } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {approver.initials}
              </motion.div>

              {/* Approval checkmark */}
              <AnimatePresence>
                {hasApproved && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center"
                  >
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Status text */}
            <div className="flex-1">
              <div className="text-sm text-white/70">{approver.name}</div>
              {isReviewing && (
                <motion.div
                  className="text-xs text-purple-400"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  Reviewing documents...
                </motion.div>
              )}
              {hasApproved && (
                <div className="text-xs text-white/40">
                  Decision recorded
                </div>
              )}
            </div>

            {/* Rejection indicator during review */}
            {isReviewing && (
              <div className="text-right">
                <div className="text-[10px] text-white/30 mb-1">May also:</div>
                <div className="text-[10px] text-red-400/60">Request Revision</div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            className="flex items-center gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10" />
            <div className="text-sm text-white/30">Pending assignment</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
