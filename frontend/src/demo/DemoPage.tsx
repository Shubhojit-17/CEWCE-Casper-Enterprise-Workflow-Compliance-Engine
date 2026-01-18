// =============================================================================
// Demo Entry Page - TESTNET ONLY
// =============================================================================
// Dedicated demo entry page with enterprise simulation briefing.
// Matches the 3D Digital Shard aesthetic from the auth page.
// =============================================================================

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useDemoContext } from './DemoProvider';
import { DEMO_ENABLED } from './demoConfig';

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

const glowPulse = {
  initial: { opacity: 0.5 },
  animate: {
    opacity: [0.5, 1, 0.5],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut' as const,
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DEMO PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function DemoPage(): React.ReactElement | null {
  const navigate = useNavigate();
  const demo = useDemoContext();
  const [isLoading, setIsLoading] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0.5, y: 0.5 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Don't render if demo mode is not enabled
  if (!DEMO_ENABLED || !demo) {
    navigate('/auth/login');
    return null;
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePosition({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  };

  const handleStartDemo = async () => {
    setIsLoading(true);
    try {
      demo.startDemo();
      // Navigate to dashboard after starting
      navigate('/');
    } catch (error) {
      console.error('Failed to start demo:', error);
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    navigate('/auth/login');
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0A0A0B 0%, #111113 50%, #0A0A0B 100%)',
      }}
    >
      {/* Animated grid background */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(220, 38, 38, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(220, 38, 38, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          transform: `translate(${(mousePosition.x - 0.5) * 20}px, ${(mousePosition.y - 0.5) * 20}px)`,
          transition: 'transform 0.1s ease-out',
        }}
      />

      {/* Radial glow following mouse */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          left: `${mousePosition.x * 100}%`,
          top: `${mousePosition.y * 100}%`,
          width: '600px',
          height: '600px',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(220, 38, 38, 0.15) 0%, transparent 60%)',
        }}
        animate={{
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Main content card */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-lg mx-4"
      >
        {/* Card with 3D perspective */}
        <motion.div
          className="relative"
          style={{
            perspective: '1000px',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Glow border */}
          <motion.div
            className="absolute -inset-px rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.5) 0%, rgba(220, 38, 38, 0.2) 50%, rgba(220, 38, 38, 0.5) 100%)',
              filter: 'blur(1px)',
            }}
            variants={glowPulse}
            initial="initial"
            animate="animate"
          />

          {/* Card body */}
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(15, 15, 17, 0.95) 0%, rgba(10, 10, 11, 0.98) 100%)',
              backdropFilter: 'blur(40px)',
              boxShadow: `
                0 0 0 1px rgba(255, 255, 255, 0.05),
                0 25px 50px -12px rgba(0, 0, 0, 0.8),
                inset 0 1px 0 rgba(255, 255, 255, 0.05)
              `,
            }}
          >
            {/* Header with scan line effect */}
            <motion.div
              className="relative px-8 pt-8 pb-6 border-b border-white/5"
              variants={itemVariants}
            >
              {/* Scan line */}
              <motion.div
                className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent"
                initial={{ top: 0 }}
                animate={{ top: '100%' }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              />

              {/* Sequence label */}
              <div className="flex items-center gap-2 mb-3">
                <motion.div
                  className="h-2 w-2 rounded-full bg-red-500"
                  animate={{
                    opacity: [1, 0.5, 1],
                    scale: [1, 0.9, 1],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
                <span className="font-mono text-xs text-red-400 uppercase tracking-[0.3em]">
                  DEMO // SIMULATION
                </span>
              </div>

              {/* Title */}
              <h1 className="text-2xl font-bold text-white mb-2">
                Compliance Simulation
              </h1>
              <p className="text-slate-400 text-sm leading-relaxed">
                Enterprise workflow verification on Casper Network
              </p>
            </motion.div>

            {/* Content */}
            <motion.div
              className="px-8 py-6 space-y-6"
              variants={itemVariants}
            >
              {/* Briefing section */}
              <div className="space-y-4">
                <h2 className="font-mono text-xs text-slate-500 uppercase tracking-wider">
                  Simulation Briefing
                </h2>
                
                <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                  <p>
                    You will experience a <span className="text-red-400 font-medium">Bank Loan Approval</span> workflow
                    from three perspectives:
                  </p>
                  
                  <ul className="space-y-2 ml-4">
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-1">→</span>
                      <span><strong className="text-white">Requester:</strong> Create and configure the workflow</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-1">→</span>
                      <span><strong className="text-white">Customer:</strong> Submit documents and confirm participation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-1">→</span>
                      <span><strong className="text-white">Approver:</strong> Review and finalize with on-chain proof</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Testnet notice */}
              <div
                className="p-4 rounded-lg"
                style={{
                  background: 'rgba(220, 38, 38, 0.08)',
                  border: '1px solid rgba(220, 38, 38, 0.2)',
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-red-400 text-xs font-bold">!</span>
                  </div>
                  <div className="text-xs text-slate-400 leading-relaxed">
                    <strong className="text-red-400">TESTNET ONLY:</strong> This simulation uses pre-configured accounts.
                    No real transactions will be made.
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Actions */}
            <motion.div
              className="px-8 pb-8 pt-2"
              variants={itemVariants}
            >
              <div className="flex flex-col gap-3">
                {/* Start button */}
                <motion.button
                  onClick={handleStartDemo}
                  disabled={isLoading}
                  className="relative w-full py-3.5 px-6 rounded-lg font-semibold text-white overflow-hidden group"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                    boxShadow: '0 4px 20px rgba(220, 38, 38, 0.4)',
                  }}
                >
                  {/* Shimmer effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    initial={{ x: '-100%' }}
                    whileHover={{ x: '100%' }}
                    transition={{ duration: 0.6 }}
                  />
                  
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isLoading ? (
                      <>
                        <motion.div
                          className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        />
                        Initializing...
                      </>
                    ) : (
                      <>
                        Initialize Simulation
                        <span className="text-white/70">→</span>
                      </>
                    )}
                  </span>
                </motion.button>

                {/* Skip link */}
                <button
                  onClick={handleSkip}
                  className="py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Skip to login
                </button>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Footer text */}
        <motion.p
          className="mt-6 text-center text-xs text-slate-600"
          variants={itemVariants}
        >
          Estimated time: 3-5 minutes
        </motion.p>
      </motion.div>
    </div>
  );
}

export default DemoPage;
