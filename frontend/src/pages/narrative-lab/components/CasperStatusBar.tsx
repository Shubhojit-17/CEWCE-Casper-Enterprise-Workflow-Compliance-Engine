/**
 * Narrative Lab - Casper Status Bar
 * Shows network status that updates based on scroll state
 * 
 * IMPORTANT: Shows "Off-chain" for all states EXCEPT ANCHOR.
 * This reflects that blockchain is used ONLY for final anchoring.
 */
import { motion } from 'framer-motion';
import type { WorkflowState } from './WorkflowDiagram';

interface CasperStatusBarProps {
  activeState: WorkflowState;
}

// Status messages reflecting that only ANCHOR touches the blockchain
const stateMessages: Record<WorkflowState, { status: string; color: string; isOnChain: boolean }> = {
  DRAFT: { status: 'Off-chain', color: 'text-white/40', isOnChain: false },
  CONFIRM: { status: 'Off-chain', color: 'text-white/40', isOnChain: false },
  DOCUMENTS: { status: 'Off-chain', color: 'text-white/40', isOnChain: false },
  REVIEW: { status: 'Off-chain', color: 'text-white/40', isOnChain: false },
  APPROVED: { status: 'Preparing...', color: 'text-amber-400', isOnChain: false },
  ANCHOR: { status: 'Anchored ✓', color: 'text-green-400', isOnChain: true },
};

export function CasperStatusBar({ activeState }: CasperStatusBarProps) {
  const { status, color, isOnChain } = stateMessages[activeState];
  const isPreparing = activeState === 'APPROVED';

  return (
    <motion.div
      className={`
        p-3 rounded-lg border transition-all duration-300
        ${isOnChain 
          ? 'bg-green-500/10 border-green-500/30' 
          : 'bg-white/5 border-white/10'
        }
      `}
      animate={isOnChain ? {
        borderColor: ['rgba(34, 197, 94, 0.3)', 'rgba(34, 197, 94, 0.6)', 'rgba(34, 197, 94, 0.3)']
      } : {}}
      transition={{ duration: 2, repeat: isOnChain ? Infinity : 0 }}
    >
      <div className="flex items-center justify-between">
        {/* Network indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <motion.div
              className={`w-2 h-2 rounded-full ${
                isOnChain ? 'bg-green-400' : 
                isPreparing ? 'bg-amber-400' : 
                'bg-white/20'
              }`}
              animate={isOnChain || isPreparing ? { opacity: [1, 0.5, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="text-xs text-white/50">Casper Network</span>
          </div>
        </div>

        {/* Status */}
        <motion.div
          key={status}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2"
        >
          {isPreparing && (
            <motion.div
              className="flex gap-0.5"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1 h-1 rounded-full bg-amber-400"
                  animate={{ scale: [0.8, 1.2, 0.8] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </motion.div>
          )}
          <span className={`text-xs font-medium ${color}`}>
            {status}
          </span>
        </motion.div>
      </div>

      {/* Block height (mock) - only show when on-chain */}
      <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
        <span className="text-[10px] text-white/30">
          {isOnChain ? 'Block Height' : 'Status'}
        </span>
        <motion.span 
          className="text-[10px] font-mono text-white/50"
          key={activeState}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {isOnChain ? '#2,847,391' : 'Idle'}
        </motion.span>
      </div>
    </motion.div>
  );
}
