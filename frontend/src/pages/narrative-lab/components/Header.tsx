/**
 * Narrative Lab - Fixed Header Component
 * CEWCE wordmark with ghost login and primary signup buttons
 * Purely visual - no auth logic
 */
import { motion } from 'framer-motion';

export function Header() {
  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-50 px-6 py-4 backdrop-blur-md bg-black/30 border-b border-white/5"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* CEWCE Wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="text-white font-semibold text-lg tracking-wide">
            CEWCE
          </span>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-4">
          <button
            className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors duration-200 font-medium"
            onClick={() => {}}
          >
            Log in
          </button>
          <button
            className="px-5 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors duration-200 shadow-lg shadow-red-600/20"
            onClick={() => {}}
          >
            Sign up
          </button>
        </div>
      </div>
    </motion.header>
  );
}
