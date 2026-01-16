/**
 * Narrative Lab - Compliance Proof Explainer Section
 * Full-width educational section showing how proofs work
 */
import { motion } from 'framer-motion';

export function ComplianceExplainer() {
  return (
    <section className="relative py-32 px-6 bg-gradient-to-b from-transparent via-black/40 to-transparent overflow-hidden">
      {/* Background grid */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <span className="text-xs text-red-400 font-mono tracking-widest uppercase mb-4 block">
            Under the Hood
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Anatomy of a Compliance Proof
          </h2>
          <p className="text-white/40 max-w-2xl mx-auto">
            Every proof is a cryptographic certificate that links your documents to an immutable blockchain record.
          </p>
        </motion.div>

        {/* Three-column grid with consistent card structure */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 items-stretch">
          {/* Document Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="flex"
          >
            <div className="flex flex-col p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-sm w-full">
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              {/* Title */}
              <h3 className="text-lg font-semibold text-white mb-2">Your Document</h3>
              {/* Description */}
              <p className="text-sm text-white/40 mb-4 flex-grow">
                The original file stays private. It never leaves your control.
              </p>
              {/* Code block - pushed to bottom */}
              <div className="p-3 rounded-lg bg-black/40 border border-white/5 mt-auto">
                <div className="text-xs text-white/30 mb-1">Example</div>
                <div className="text-sm text-white/60 font-mono truncate">contract_2026.pdf</div>
              </div>
            </div>
          </motion.div>

          {/* Arrow between cards (mobile: hidden) */}
          <div className="hidden md:flex absolute left-[calc(33.333%-1rem)] top-1/2 -translate-y-1/2 z-20 pointer-events-none" style={{ display: 'none' }} />

          {/* Hash Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex"
          >
            <div className="flex flex-col p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-sm w-full">
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              {/* Title */}
              <h3 className="text-lg font-semibold text-white mb-2">Cryptographic Hash</h3>
              {/* Description */}
              <p className="text-sm text-white/40 mb-4 flex-grow">
                A unique fingerprint. Any change to the document creates a completely different hash.
              </p>
              {/* Code block - pushed to bottom */}
              <div className="p-3 rounded-lg bg-black/40 border border-white/5 mt-auto">
                <div className="text-xs text-white/30 mb-1">SHA-256</div>
                <div className="text-xs text-amber-400/70 font-mono truncate">
                  7f3a9b2c4e8d1a6f0b5c3d7e9f2a4b6c
                </div>
              </div>
            </div>
          </motion.div>

          {/* Blockchain Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="flex"
          >
            <div className="flex flex-col p-6 rounded-2xl bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 backdrop-blur-sm w-full">
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              {/* Title */}
              <h3 className="text-lg font-semibold text-white mb-2">Casper Blockchain</h3>
              {/* Description */}
              <p className="text-sm text-white/40 mb-4 flex-grow">
                The hash is anchored forever. Tamper-proof. Publicly verifiable.
              </p>
              {/* Code block - pushed to bottom */}
              <div className="p-3 rounded-lg bg-black/40 border border-red-500/10 mt-auto">
                <div className="text-xs text-white/30 mb-1">Block #2,847,391</div>
                <div className="text-xs text-red-400/70 font-mono truncate">
                  0x8a9f...3c2d
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Flow arrows - separate row, centered */}
        <div className="hidden md:flex justify-center items-center gap-4 -mt-[calc(50%+2rem)] mb-[calc(50%-2rem)] relative z-10 pointer-events-none" style={{ display: 'none' }}>
          {/* Arrows removed for cleaner alignment - visual ordering is sufficient */}
        </div>

        {/* Immutability Message */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-green-500/10 border border-green-500/20">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="text-green-400 font-medium">
              Once anchored, your proof cannot be altered, deleted, or disputed.
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
