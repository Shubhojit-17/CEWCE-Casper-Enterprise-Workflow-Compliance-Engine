/**
 * Narrative Lab - On-Chain Explainer Section
 * Visual explanation of what CEWCE stores on Casper vs. off-chain
 * 
 * Purpose: Build trust by clearly showing that documents never touch the blockchain,
 * only cryptographic proofs are anchored.
 */
import { motion } from 'framer-motion';

// Items stored on the Casper blockchain
const onChainItems = [
  { id: 1, label: 'Workflow ID', description: 'Unique identifier for the compliance workflow' },
  { id: 2, label: 'Final Approval State', description: 'Approved / Rejected decision' },
  { id: 3, label: 'Approval Timestamp', description: 'Exact time of final decision' },
  { id: 4, label: 'Compliance Proof Hash', description: 'SHA-256 Merkle root of all documents' },
  { id: 5, label: 'Smart Contract Address', description: 'Deployed contract location' },
  { id: 6, label: 'Deploy Hash', description: 'Transaction reference on Casper' },
  { id: 7, label: 'Block Hash', description: 'Immutable block containing the proof' },
];

// Items that are NEVER stored on-chain
const offChainItems = [
  { id: 1, label: 'Document contents' },
  { id: 2, label: 'File names' },
  { id: 3, label: 'Personal data' },
  { id: 4, label: 'Internal comments' },
  { id: 5, label: 'Draft workflow states' },
  { id: 6, label: 'Attachments' },
];

export function OnChainExplainer() {
  return (
    <section className="relative py-32 px-6 bg-gradient-to-b from-black via-gray-950 to-black overflow-hidden">
      {/* Subtle background grid */}
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-xs text-red-400 font-mono tracking-widest uppercase mb-4 block">
            Transparency
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            What Is Stored on Casper?
          </h2>
          <p className="text-white/40 max-w-2xl mx-auto">
            CEWCE anchors cryptographic proof on-chain — not business data or documents.
          </p>
        </motion.div>

        {/* Two-panel layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* On-Chain Panel (Primary) */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="relative"
          >
            <div className="p-6 rounded-2xl bg-gradient-to-br from-green-500/5 to-green-600/[0.02] border border-green-500/20 backdrop-blur-sm">
              {/* Panel Header */}
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-green-500/10">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Casper Blockchain</h3>
                  <p className="text-xs text-green-400/70">Immutable • Public • Verifiable</p>
                </div>
              </div>

              {/* On-Chain Items */}
              <div className="space-y-3">
                {onChainItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 + index * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-black/30 border border-green-500/10"
                  >
                    {/* Lock icon */}
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white">{item.label}</div>
                      <div className="text-xs text-white/30 truncate">{item.description}</div>
                    </div>
                    {/* Checkmark */}
                    <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                ))}
              </div>

              {/* Footer note */}
              <div className="mt-6 pt-4 border-t border-green-500/10">
                <p className="text-xs text-green-400/60 text-center">
                  Only cryptographic facts are stored on-chain.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Off-Chain Panel (Secondary, Muted) */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="relative"
          >
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 backdrop-blur-sm">
              {/* Panel Header */}
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white/50">Never Stored on Casper</h3>
                  <p className="text-xs text-white/20">Private • Off-Chain • Your Control</p>
                </div>
              </div>

              {/* Off-Chain Items */}
              <div className="space-y-3">
                {offChainItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + index * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.01] border border-white/5"
                  >
                    {/* X icon */}
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white/30">{item.label}</div>
                    </div>
                    {/* Strikethrough indicator */}
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      <div className="w-4 h-[2px] bg-white/10 rounded" />
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Footer note */}
              <div className="mt-6 pt-4 border-t border-white/5">
                <p className="text-xs text-white/20 text-center">
                  Documents never leave CEWCE.
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Cryptographic Link Visualization */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="relative"
        >
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-sm">
            {/* Title */}
            <div className="text-center mb-6">
              <h4 className="text-sm font-medium text-white/60 mb-1">How It Works</h4>
              <p className="text-xs text-white/30">The cryptographic link between your documents and the blockchain</p>
            </div>

            {/* Flow diagram */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6">
              {/* Step 1: Documents */}
              <FlowStep
                icon={
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                }
                label="Documents"
                sublabel="Private"
                color="blue"
              />

              <FlowArrow />

              {/* Step 2: SHA-256 Hash */}
              <FlowStep
                icon={
                  <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                }
                label="SHA-256 Hash"
                sublabel="Fingerprint"
                color="amber"
              />

              <FlowArrow />

              {/* Step 3: Compliance Proof */}
              <FlowStep
                icon={
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                }
                label="Compliance Proof"
                sublabel="Verified"
                color="purple"
              />

              <FlowArrow />

              {/* Step 4: Casper Blockchain */}
              <FlowStep
                icon={
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                }
                label="Casper Blockchain"
                sublabel="Immutable"
                color="red"
              />
            </div>

            {/* Bottom message */}
            <div className="mt-8 text-center">
              <p className="text-xs text-white/40">
                Anyone can verify this proof independently. No wallet required.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// Helper component: Flow step
function FlowStep({ 
  icon, 
  label, 
  sublabel, 
  color,
}: { 
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  color: 'blue' | 'amber' | 'purple' | 'red';
}) {
  const colorClasses = {
    blue: 'bg-blue-500/10 border-blue-500/20',
    amber: 'bg-amber-500/10 border-amber-500/20',
    purple: 'bg-purple-500/10 border-purple-500/20',
    red: 'bg-red-500/10 border-red-500/20',
  };

  return (
    <div className={`flex flex-col items-center p-4 rounded-xl border ${colorClasses[color]} min-w-[100px]`}>
      <div className="mb-2">{icon}</div>
      <div className="text-xs font-medium text-white text-center">{label}</div>
      <div className="text-[10px] text-white/30">{sublabel}</div>
    </div>
  );
}

// Helper component: Flow arrow
function FlowArrow() {
  return (
    <div className="hidden md:flex items-center text-white/20">
      <motion.div
        animate={{ x: [0, 4, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
        </svg>
      </motion.div>
    </div>
  );
}
