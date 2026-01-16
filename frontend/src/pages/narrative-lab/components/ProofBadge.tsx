/**
 * Narrative Lab - Proof Badge Component
 * Shows the compliance proof badge that glows when anchored
 */
import { motion } from 'framer-motion';
import type { WorkflowState } from './WorkflowDiagram';

interface ProofBadgeProps {
  activeState: WorkflowState;
}

export function ProofBadge({ activeState }: ProofBadgeProps) {
  const isAnchored = activeState === 'ANCHOR';
  const isApproved = activeState === 'APPROVED';
  const isPreparingAnchor = isApproved; // Approved state prepares for blockchain

  return (
    <div className="space-y-3">
      <span className="text-xs text-white/50 uppercase tracking-wider">
        Compliance Proof
      </span>

      <motion.div
        className={`
          relative p-4 rounded-xl border transition-all duration-500
          ${isAnchored 
            ? 'bg-red-500/10 border-red-500/30' 
            : isPreparingAnchor
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-white/[0.02] border-white/5'
          }
        `}
        animate={isAnchored ? {
          boxShadow: [
            '0 0 20px rgba(239, 68, 68, 0)',
            '0 0 40px rgba(239, 68, 68, 0.3)',
            '0 0 20px rgba(239, 68, 68, 0)',
          ]
        } : {}}
        transition={{ duration: 2, repeat: isAnchored ? Infinity : 0 }}
      >
        {/* Badge Icon */}
        <div className="flex items-center gap-3 mb-3">
          <motion.div
            className={`
              w-10 h-10 rounded-lg flex items-center justify-center
              ${isAnchored 
                ? 'bg-red-500' 
                : isPreparingAnchor 
                  ? 'bg-amber-500/50' 
                  : 'bg-white/10'
              }
            `}
            animate={isAnchored ? { scale: [1, 1.05, 1] } : isPreparingAnchor ? { opacity: [0.7, 1, 0.7] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            {isAnchored ? (
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            )}
          </motion.div>
          
          <div>
            <div className={`text-sm font-medium ${isAnchored ? 'text-white' : isPreparingAnchor ? 'text-amber-300' : 'text-white/40'}`}>
              {isAnchored ? 'Verified Proof' : isPreparingAnchor ? 'Ready to Anchor' : 'Pending'}
            </div>
            <div className="text-xs text-white/30">
              {isAnchored 
                ? 'Immutable on-chain' 
                : isPreparingAnchor 
                  ? 'Awaiting blockchain registration' 
                  : 'Workflow in progress'
              }
            </div>
          </div>
        </div>

        {/* Hash display for anchored state */}
        {isAnchored && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="pt-3 border-t border-white/10"
          >
            <div className="text-xs text-white/40 mb-1">Block Hash</div>
            <ScrollingHash />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

function ScrollingHash() {
  const hash = '0x7f3a9b2c4e8d1a6f0b5c3d7e9f2a4b6c8d0e1f3a5b7c9d1e3f5a7b9c1d3e5f7a9b';
  
  return (
    <div className="overflow-hidden relative">
      <motion.div
        className="font-mono text-xs text-red-400 whitespace-nowrap"
        animate={{ x: [0, -100, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
      >
        {hash}
      </motion.div>
      <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-red-500/10 to-transparent" />
    </div>
  );
}
