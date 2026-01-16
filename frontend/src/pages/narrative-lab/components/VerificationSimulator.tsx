/**
 * Narrative Lab - Verification Simulator
 * Mock drag-and-drop verification with fake animation flow
 */
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type VerificationState = 'idle' | 'dropped' | 'hashing' | 'querying' | 'verified';

export function VerificationSimulator() {
  const [state, setState] = useState<VerificationState>('idle');
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    runVerificationSequence();
  }, []);

  const handleClick = useCallback(() => {
    if (state === 'idle') {
      runVerificationSequence();
    }
  }, [state]);

  const runVerificationSequence = () => {
    setState('dropped');
    
    setTimeout(() => setState('hashing'), 500);
    setTimeout(() => setState('querying'), 2000);
    setTimeout(() => setState('verified'), 4000);
    
    // Reset after showing verified
    setTimeout(() => setState('idle'), 8000);
  };

  return (
    <section className="relative py-32 px-6 bg-black overflow-hidden">
      {/* Subtle background */}
      <div className="absolute inset-0 bg-gradient-to-t from-gray-950 to-black" />

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-xs text-red-400 font-mono tracking-widest uppercase mb-4 block">
            Try It Yourself
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Verification Simulator
          </h2>
          <p className="text-white/40 max-w-xl mx-auto">
            Experience how auditors verify compliance proofs. Drop any file to see the magic.
          </p>
        </motion.div>

        {/* Drop Zone */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative"
        >
          <div
            onClick={handleClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative p-12 rounded-3xl border-2 border-dashed transition-all duration-300 cursor-pointer
              ${isDragOver 
                ? 'border-red-500 bg-red-500/10' 
                : state === 'idle'
                  ? 'border-white/20 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]'
                  : 'border-white/10 bg-white/[0.02]'
              }
            `}
          >
            <AnimatePresence mode="wait">
              {state === 'idle' && (
                <IdleState isDragOver={isDragOver} />
              )}
              {state === 'dropped' && (
                <DroppedState />
              )}
              {state === 'hashing' && (
                <HashingState />
              )}
              {state === 'querying' && (
                <QueryingState />
              )}
              {state === 'verified' && (
                <VerifiedState />
              )}
            </AnimatePresence>
          </div>

          {/* Decorative elements */}
          <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px]">
            <motion.div
              className="absolute inset-0 rounded-full bg-red-500/5"
              animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 4, repeat: Infinity }}
            />
          </div>
        </motion.div>

        {/* Disclaimer */}
        <p className="text-center text-xs text-white/20 mt-8">
          This is a visual simulation. No files are uploaded or processed.
        </p>
      </div>
    </section>
  );
}

function IdleState({ isDragOver }: { isDragOver: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="text-center"
    >
      <motion.div
        className={`
          w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center
          ${isDragOver ? 'bg-red-500/20' : 'bg-white/10'}
        `}
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <svg 
          className={`w-10 h-10 ${isDragOver ? 'text-red-400' : 'text-white/40'}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      </motion.div>
      <h3 className={`text-xl font-semibold mb-2 ${isDragOver ? 'text-red-400' : 'text-white/70'}`}>
        {isDragOver ? 'Release to verify' : 'Drop a document here'}
      </h3>
      <p className="text-white/40 text-sm">
        or click to simulate verification
      </p>
    </motion.div>
  );
}

function DroppedState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="text-center"
    >
      <motion.div
        className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-white/10 flex items-center justify-center"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 0.5 }}
      >
        <svg className="w-10 h-10 text-white/60" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      </motion.div>
      <h3 className="text-xl font-semibold text-white/70 mb-2">
        Document received
      </h3>
      <p className="text-white/40 text-sm">Preparing verification...</p>
    </motion.div>
  );
}

function HashingState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="text-center"
    >
      <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-amber-500/20 flex items-center justify-center">
        <motion.div
          className="text-amber-400 font-mono text-lg"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        >
          #
        </motion.div>
      </div>
      <h3 className="text-xl font-semibold text-amber-400 mb-2">
        Calculating hash...
      </h3>
      <motion.div 
        className="font-mono text-sm text-white/40 overflow-hidden max-w-xs mx-auto"
      >
        <motion.div
          animate={{ x: [0, -200] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="whitespace-nowrap"
        >
          7f3a9b2c4e8d1a6f0b5c3d7e9f2a4b6c8d0e1f3a5b7c9d
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function QueryingState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="text-center"
    >
      <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-red-500/20 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4" />
          </svg>
        </motion.div>
      </div>
      <h3 className="text-xl font-semibold text-red-400 mb-2">
        Querying Casper...
      </h3>
      <motion.p 
        className="text-white/40 text-sm"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        Searching blockchain for proof anchor
      </motion.p>
    </motion.div>
  );
}

function VerifiedState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="text-center"
    >
      <motion.div
        className="w-24 h-24 mx-auto mb-6 rounded-full bg-green-500 flex items-center justify-center"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 10 }}
      >
        <motion.svg 
          className="w-12 h-12 text-white" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </motion.svg>
      </motion.div>
      <motion.h3 
        className="text-2xl font-bold text-green-400 mb-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        VERIFIED
      </motion.h3>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="space-y-2"
      >
        <p className="text-white/60 text-sm">Proof found on Casper Network</p>
        <p className="text-white/30 text-xs font-mono">Block #2,847,391</p>
      </motion.div>
    </motion.div>
  );
}
