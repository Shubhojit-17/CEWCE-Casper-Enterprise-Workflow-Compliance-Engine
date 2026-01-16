/**
 * Narrative Lab - Footer Component
 */
import { motion } from 'framer-motion';

export function Footer() {
  return (
    <footer className="relative py-12 px-6 bg-black border-t border-white/5">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex flex-col md:flex-row items-center justify-between gap-6"
        >
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="text-white/60 font-medium">CEWCE</span>
          </div>

          {/* Middle */}
          <p className="text-white/30 text-sm text-center">
            Casper Enterprise Workflow & Compliance Engine
          </p>

          {/* Right */}
          <div className="flex items-center gap-6">
            <span className="text-xs text-white/20">
              Prototype Preview • January 2026
            </span>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
