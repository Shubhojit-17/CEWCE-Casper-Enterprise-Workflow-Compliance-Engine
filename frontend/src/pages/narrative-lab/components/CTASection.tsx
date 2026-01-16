/**
 * Narrative Lab - CTA Section
 * Two side-by-side call-to-action cards
 */
import { motion } from 'framer-motion';

export function CTASection() {
  return (
    <section className="relative py-32 px-6 bg-gradient-to-b from-transparent via-black/50 to-black/70 overflow-hidden">
      {/* Background accent */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Begin?
          </h2>
          <p className="text-white/40 max-w-xl mx-auto">
            Whether you're verifying compliance or building workflows, CEWCE has you covered.
          </p>
        </motion.div>

        {/* Two cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Auditor Card */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="group relative"
          >
            <div className="p-8 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-sm hover:border-white/20 transition-all duration-300">
              {/* Icon */}
              <div className="w-14 h-14 rounded-xl bg-purple-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 mb-4">
                <span className="text-xs text-purple-400 font-medium">For Auditors</span>
              </div>

              {/* Title */}
              <h3 className="text-2xl font-bold text-white mb-3">
                Public Auditor?
              </h3>

              {/* Description */}
              <p className="text-white/50 mb-8">
                Verify compliance proofs instantly. No account required. Just the document and the blockchain.
              </p>

              {/* Button */}
              <button
                onClick={() => {}}
                className="w-full py-3 px-6 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 font-medium hover:bg-purple-500/30 hover:border-purple-500/50 transition-all duration-300"
              >
                Verify a Proof Now
              </button>
            </div>
          </motion.div>

          {/* Enterprise Card */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="group relative"
          >
            <div className="p-8 rounded-2xl bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 backdrop-blur-sm hover:border-red-500/40 transition-all duration-300">
              {/* Icon */}
              <div className="w-14 h-14 rounded-xl bg-red-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>

              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 mb-4">
                <span className="text-xs text-red-400 font-medium">For Enterprise</span>
              </div>

              {/* Title */}
              <h3 className="text-2xl font-bold text-white mb-3">
                Enterprise Leader?
              </h3>

              {/* Description */}
              <p className="text-white/50 mb-8">
                Build compliance workflows that your auditors will love. Start with a template or design from scratch.
              </p>

              {/* Button */}
              <button
                onClick={() => {}}
                className="w-full py-3 px-6 rounded-xl bg-red-500 text-white font-medium hover:bg-red-400 transition-all duration-300 shadow-lg shadow-red-500/20"
              >
                Build Your First Workflow
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
