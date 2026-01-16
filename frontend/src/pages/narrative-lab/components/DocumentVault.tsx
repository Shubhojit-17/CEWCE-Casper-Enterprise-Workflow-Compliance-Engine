/**
 * Narrative Lab - Document Vault Component
 * Shows document icons that appear and animate based on scroll state
 * 
 * IMPORTANT: Documents are stored OFF-CHAIN.
 * Only hashes are anchored to the blockchain at final approval.
 */
import { motion, AnimatePresence } from 'framer-motion';
import type { WorkflowState } from './WorkflowDiagram';

interface DocumentVaultProps {
  activeState: WorkflowState;
}

const documents = [
  { id: 1, name: 'contract_v1.pdf', hash: '0x7f3a...' },
  { id: 2, name: 'audit_report.pdf', hash: '0x9b2c...' },
  { id: 3, name: 'compliance.pdf', hash: '0x4e8d...' },
];

export function DocumentVault({ activeState }: DocumentVaultProps) {
  // Documents appear from DOCUMENTS phase onwards
  const showDocuments = ['DOCUMENTS', 'REVIEW', 'APPROVED', 'ANCHOR'].includes(activeState);
  // Show hashing animation only during DOCUMENTS phase
  const isHashing = activeState === 'DOCUMENTS';
  // Vault locks after approval
  const isLocked = activeState === 'APPROVED' || activeState === 'ANCHOR';
  // Show anchored status only at final step
  const isAnchored = activeState === 'ANCHOR';
  // Documents are editable until approval
  const isEditable = ['DOCUMENTS', 'REVIEW'].includes(activeState);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/50 uppercase tracking-wider">
          Document Vault
        </span>
        <div className="flex items-center gap-2">
          {isEditable && (
            <span className="text-[10px] text-blue-400 font-mono">Editable</span>
          )}
          {isLocked && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1"
            >
              <svg className={`w-3 h-3 ${isAnchored ? 'text-green-500' : 'text-amber-500'}`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span className={`text-xs ${isAnchored ? 'text-green-500' : 'text-amber-500'}`}>
                {isAnchored ? 'Anchored' : 'Locked'}
              </span>
            </motion.div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showDocuments ? (
          <motion.div 
            className="space-y-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {documents.map((doc, idx) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`
                  p-3 rounded-lg border transition-all duration-300
                  ${isLocked 
                    ? 'bg-green-500/5 border-green-500/20' 
                    : 'bg-white/5 border-white/10'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  {/* Document icon */}
                  <div className={`
                    w-8 h-10 rounded flex items-center justify-center
                    ${isLocked ? 'bg-green-500/20' : 'bg-white/10'}
                  `}>
                    <svg className={`w-4 h-5 ${isLocked ? 'text-green-400' : 'text-white/50'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                  </div>

                  {/* Document info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/80 truncate">{doc.name}</div>
                    <div className="flex items-center gap-2">
                      {isHashing ? (
                        <motion.div 
                          className="flex items-center gap-1"
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          <HashingAnimation />
                          <span className="text-xs text-amber-400 font-mono">Hashing...</span>
                        </motion.div>
                      ) : (
                        <span className="text-xs text-white/40 font-mono">{doc.hash}</span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div 
            className="p-6 rounded-lg border border-dashed border-white/10 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <span className="text-sm text-white/30">No documents yet</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HashingAnimation() {
  return (
    <motion.div 
      className="flex gap-0.5"
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1, repeat: Infinity }}
    >
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1 h-3 bg-amber-400 rounded-full"
          animate={{ scaleY: [0.5, 1, 0.5] }}
          transition={{ 
            duration: 0.6, 
            repeat: Infinity, 
            delay: i * 0.15 
          }}
        />
      ))}
    </motion.div>
  );
}
