/**
 * Architecture of Trust - Scroll-Driven Storytelling Page
 * 
 * A standalone explanatory page for Casper community members.
 * Explains how CEWCE works through a dual-track narrative:
 * - Left: Persistent "Digital Shard" 3D visualization
 * - Right: Scroll-driven text sections
 * 
 * This is NOT a demo, NOT interactive business logic.
 * It's pure visual storytelling.
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion';

// =============================================================================
// TYPES
// =============================================================================

type StoryStep = 1 | 2 | 3 | 4 | 5 | 6;

interface StepContent {
  step: StoryStep;
  stepLabel: string;
  headline: string;
  body: string;
}

// =============================================================================
// STORY CONTENT - The 6 narrative steps
// =============================================================================

const STORY_STEPS: StepContent[] = [
  {
    step: 1,
    stepLabel: '01 — THE SITUATION',
    headline: 'A Real Business Problem',
    body: 'A company wants to onboard a new vendor. Before work can begin, the vendor must be approved. Documents are required. Approvals are mandatory. Mistakes here are expensive.',
  },
  {
    step: 2,
    stepLabel: '02 — STARTING THE PROCESS',
    headline: 'Starting the Approval Process',
    body: 'The company creates a vendor approval workflow in CEWCE. They define: who must review, who can approve, what documents are required. Everything happens inside the company. Nothing is public.',
  },
  {
    step: 3,
    stepLabel: '03 — WORKING WITH DOCUMENTS',
    headline: 'Private by Default',
    body: 'The vendor uploads the required documents. The compliance team reviews them inside CEWCE. Documents remain private, exactly as companies expect. CEWCE prepares them for verification without exposing them.',
  },
  {
    step: 4,
    stepLabel: '04 — THE APPROVAL MOMENT',
    headline: 'A Decision That Matters',
    body: 'A senior manager reviews the case and approves the vendor. This approval allows the business to move forward. But this decision is important. It needs to be provable later.',
  },
  {
    step: 5,
    stepLabel: '05 — AFTER APPROVAL',
    headline: 'Making the Approval Provable',
    body: 'After approval, CEWCE records proof of the decision on the Casper blockchain. No documents are uploaded. No internal data is exposed. Only cryptographic proof of the approval is recorded.',
  },
  {
    step: 6,
    stepLabel: '06 — WHEN PROOF IS NEEDED',
    headline: 'Verification Without Trust',
    body: 'Months later, an auditor or partner asks: "Can you prove this vendor was approved?" The company shares the proof. Casper independently confirms it. No explanations required. No trust required.',
  },
];

// =============================================================================
// HEX DECRYPTION TEXT EFFECT
// =============================================================================

const HEX_CHARS = '0123456789ABCDEF';

function DecryptionText({ 
  text, 
  delay = 0, 
  duration = 600, 
  className = '',
  isActive = true,
}: { 
  text: string; 
  delay?: number; 
  duration?: number; 
  className?: string;
  isActive?: boolean;
}) {
  const [displayText, setDisplayText] = useState('');
  const [hasDecrypted, setHasDecrypted] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setDisplayText('');
      setHasDecrypted(false);
      setKey(prev => prev + 1);
      return;
    }

    const startTimeout = setTimeout(() => {
      const scrambled = text.split('').map(char => 
        char === ' ' ? ' ' : HEX_CHARS[Math.floor(Math.random() * HEX_CHARS.length)]
      ).join('');
      setDisplayText(scrambled);
      
      const charDuration = duration / text.length;
      let currentIndex = 0;
      
      const scrambleInterval = setInterval(() => {
        setDisplayText(prev => {
          const chars = prev.split('');
          for (let i = currentIndex; i < text.length; i++) {
            if (text[i] !== ' ') {
              chars[i] = HEX_CHARS[Math.floor(Math.random() * HEX_CHARS.length)];
            }
          }
          return chars.join('');
        });
      }, 50);
      
      const revealInterval = setInterval(() => {
        if (currentIndex >= text.length) {
          clearInterval(revealInterval);
          clearInterval(scrambleInterval);
          setDisplayText(text);
          setHasDecrypted(true);
          return;
        }
        
        setDisplayText(prev => {
          const chars = prev.split('');
          chars[currentIndex] = text[currentIndex];
          return chars.join('');
        });
        currentIndex++;
      }, charDuration);
      
      return () => {
        clearInterval(revealInterval);
        clearInterval(scrambleInterval);
      };
    }, delay);
    
    return () => clearTimeout(startTimeout);
  }, [text, delay, duration, isActive, key]);

  if (!isActive) return null;

  return (
    <span 
      className={`font-mono ${className}`}
      style={{
        color: hasDecrypted ? '#ffffff' : '#ef4444',
        textShadow: hasDecrypted 
          ? '0 0 20px rgba(255, 255, 255, 0.15)' 
          : '0 0 10px rgba(239, 68, 68, 0.6)',
        transition: 'color 0.3s ease, text-shadow 0.3s ease',
      }}
    >
      {displayText || text.split('').map(c => c === ' ' ? ' ' : '█').join('')}
    </span>
  );
}

// =============================================================================
// VOLUMETRIC COMPLIANCE SHARD - The persistent 3D visualization
// A high-fidelity glass prism representing CEWCE as a Single Source of Truth
// Private data enters → public proof emerges
// =============================================================================

function DigitalShard({ activeStep }: { activeStep: StoryStep }) {
  const [prevStep, setPrevStep] = useState<StoryStep>(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Mouse tracking for 3D parallax tilt
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  const springConfig = { stiffness: 100, damping: 20, mass: 0.5 };
  const rotateX = useSpring(useTransform(mouseY, [-300, 300], [5, -5]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-300, 300], [-5, 5]), springConfig);
  
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    mouseX.set(e.clientX - centerX);
    mouseY.set(e.clientY - centerY);
  }, [mouseX, mouseY]);
  
  const handleMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  // Signal stutter effect on step change
  useEffect(() => {
    if (activeStep !== prevStep) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setIsTransitioning(false);
        setPrevStep(activeStep);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeStep, prevStep]);

  // Determine if we're in verified/Casper state
  const isVerifiedState = activeStep >= 5;
  const isApprovalState = activeStep === 4;
  const isWorkflowActive = activeStep >= 2;
  const isDocumentPhase = activeStep === 3;
  const isLocked = activeStep >= 5;
  const isFullyVerified = activeStep === 6;

  // Primary accent color based on state
  const accentColor = isVerifiedState 
    ? 'rgba(6, 182, 212, 1)' 
    : isApprovalState 
      ? 'rgba(220, 38, 38, 1)' 
      : 'rgba(255, 255, 255, 0.5)';
  
  const accentColorMuted = isVerifiedState
    ? 'rgba(6, 182, 212, 0.4)'
    : isApprovalState
      ? 'rgba(220, 38, 38, 0.4)'
      : 'rgba(255, 255, 255, 0.15)';

  return (
    <div 
      className="relative w-full h-full flex items-center justify-center"
      style={{ perspective: '1200px' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* === ATMOSPHERIC DEPTH LAYER === */}
      {/* Large blurred ambient blobs behind shard */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Red ambient blob - shifts based on state */}
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full"
          animate={{
            opacity: isVerifiedState ? 0.1 : 0.25,
            x: isApprovalState ? 20 : 0,
          }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
          style={{
            background: 'radial-gradient(circle, rgba(139, 0, 0, 0.8) 0%, transparent 70%)',
            filter: 'blur(80px)',
            top: '-20%',
            left: '-10%',
          }}
        />
        {/* Slate/teal blob - grows in verified state */}
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full"
          animate={{
            opacity: isVerifiedState ? 0.35 : 0.15,
            scale: isVerifiedState ? 1.2 : 1,
          }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
          style={{
            background: isVerifiedState 
              ? 'radial-gradient(circle, rgba(6, 182, 212, 0.6) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(30, 41, 59, 0.8) 0%, transparent 70%)',
            filter: 'blur(100px)',
            bottom: '-25%',
            right: '-15%',
          }}
        />
      </div>

      {/* === CASPER ANCHOR BEAM (Step 5-6) === */}
      <AnimatePresence>
        {isLocked && (
          <>
            {/* Vertical beam to chain */}
            <motion.div
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0, scaleY: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="absolute left-1/2 -translate-x-1/2 bottom-0 w-0.5 origin-bottom z-0"
              style={{
                height: '35%',
                background: 'linear-gradient(to top, rgba(6, 182, 212, 0.9), rgba(6, 182, 212, 0.3), transparent)',
                boxShadow: '0 0 40px rgba(6, 182, 212, 0.6), 0 0 80px rgba(6, 182, 212, 0.3)',
              }}
            />
            {/* Chain anchor indicator */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.4, delay: 0.4 }}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10"
            >
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-cyan-500/50 bg-black/60 backdrop-blur-md">
                <motion.div 
                  className="w-2 h-2 rounded-full bg-cyan-400"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
                  Casper Network
                </span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* === 3D SHARD CONTAINER === */}
      <motion.div
        style={{ 
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
        animate={{
          opacity: isTransitioning ? 0.4 : 1,
        }}
        transition={{ duration: 0.1 }}
        className="relative w-72 h-[420px] sm:w-80 sm:h-[460px] lg:w-96 lg:h-[520px] z-10"
      >
        {/* Ambient glow behind shard */}
        <motion.div 
          animate={{ 
            opacity: [0.4, 0.6, 0.4],
            scale: [1, 1.03, 1],
          }}
          transition={{ 
            duration: 5, 
            repeat: Infinity, 
            ease: 'easeInOut' 
          }}
          className="absolute inset-0"
          style={{
            background: isFullyVerified
              ? 'radial-gradient(ellipse at center, rgba(6, 182, 212, 0.35), transparent 65%)'
              : isApprovalState
                ? 'radial-gradient(ellipse at center, rgba(220, 38, 38, 0.35), transparent 65%)'
                : 'radial-gradient(ellipse at center, rgba(80, 80, 100, 0.2), transparent 65%)',
            filter: 'blur(50px)',
            transition: 'background 0.8s ease',
          }}
        />

        {/* === THE CHASSIS - Main Glass Prism === */}
        <motion.div
          className="absolute inset-0"
          animate={{
            boxShadow: isFullyVerified
              ? '0 30px 60px -15px rgba(0, 0, 0, 0.7), inset 0 0 80px rgba(6, 182, 212, 0.15), 0 0 60px rgba(6, 182, 212, 0.2)'
              : isApprovalState
                ? '0 30px 60px -15px rgba(0, 0, 0, 0.7), inset 0 0 80px rgba(220, 38, 38, 0.15), 0 0 40px rgba(220, 38, 38, 0.15)'
                : '0 30px 60px -15px rgba(0, 0, 0, 0.7), inset 0 0 60px rgba(255, 255, 255, 0.03)',
          }}
          transition={{ duration: 0.6 }}
          style={{
            // Notched mechanical corners using clip-path
            clipPath: 'polygon(0 16px, 16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px))',
            background: `linear-gradient(
              145deg, 
              rgba(255, 255, 255, 0.1) 0%, 
              rgba(255, 255, 255, 0.03) 30%,
              rgba(0, 0, 0, 0.2) 70%,
              rgba(0, 0, 0, 0.3) 100%
            )`,
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
          }}
        >
          {/* Rim light border - brighter top-left, darker bottom-right */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              clipPath: 'polygon(0 16px, 16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px))',
              background: `linear-gradient(
                135deg,
                ${isFullyVerified ? 'rgba(6, 182, 212, 0.4)' : 'rgba(255, 255, 255, 0.2)'} 0%,
                transparent 40%,
                transparent 60%,
                ${isFullyVerified ? 'rgba(6, 182, 212, 0.1)' : 'rgba(0, 0, 0, 0.3)'} 100%
              )`,
            }}
          />
          
          {/* Inner border line */}
          <div 
            className="absolute inset-[1px] pointer-events-none"
            style={{
              clipPath: 'polygon(0 16px, 16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px))',
              border: `1px solid ${accentColorMuted}`,
              transition: 'border-color 0.5s ease',
            }}
          />

          {/* === HUD L-SHAPED BRACKETS === */}
          <ShardCornerBracket position="top-left" color={accentColor} locked={isLocked} />
          <ShardCornerBracket position="top-right" color={accentColor} locked={isLocked} />
          <ShardCornerBracket position="bottom-left" color={accentColor} locked={isLocked} />
          <ShardCornerBracket position="bottom-right" color={accentColor} locked={isLocked} />

          {/* === INTERNAL ANATOMY === */}
          <div className="absolute inset-4 flex flex-col">
            
            {/* === TOP ZONE: Identity Header === */}
            <div className="h-16 flex items-center justify-center border-b border-white/5">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: activeStep >= 1 ? 1 : 0 }}
                className="text-center"
              >
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500 mb-1">
                  Compliance Record
                </div>
                <motion.div 
                  className="text-xs font-mono tracking-wider"
                  animate={{
                    color: isFullyVerified 
                      ? 'rgba(6, 182, 212, 0.9)' 
                      : isApprovalState
                        ? 'rgba(220, 38, 38, 0.9)'
                        : 'rgba(148, 163, 184, 0.6)',
                  }}
                  transition={{ duration: 0.4 }}
                >
                  ID: VENDOR_NEW
                </motion.div>
              </motion.div>
            </div>

            {/* === MIDDLE ZONE: Process Core === */}
            <div className="flex-1 relative overflow-hidden">
              {/* Grid background */}
              <ProcessCoreGrid 
                isActive={isWorkflowActive} 
                isApprovalState={isApprovalState}
                isVerified={isFullyVerified}
              />
              
              {/* Workflow nodes and connections */}
              <AnimatePresence>
                {isWorkflowActive && (
                  <WorkflowConstellation 
                    step={activeStep}
                    isApprovalState={isApprovalState}
                    isVerified={isVerifiedState}
                  />
                )}
              </AnimatePresence>

              {/* Document dissolve effect */}
              <AnimatePresence>
                {isDocumentPhase && <DataShardDissolve />}
              </AnimatePresence>

              {/* Pending pulse (Step 1 only) */}
              <AnimatePresence>
                {activeStep === 1 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <motion.div
                      animate={{ 
                        scale: [1, 1.1, 1],
                        opacity: [0.3, 0.6, 0.3],
                      }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                      className="text-xs font-mono uppercase tracking-[0.3em] text-slate-500"
                    >
                      Pending
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* === BOTTOM ZONE: Anchor Point === */}
            <div className="h-20 flex items-center justify-center border-t border-white/5 relative">
              {/* Power indicator (Step 1) */}
              <AnimatePresence>
                {activeStep === 1 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-2 h-2 rounded-full bg-red-500"
                    style={{ boxShadow: '0 0 12px rgba(220, 38, 38, 0.8)' }}
                  />
                )}
              </AnimatePresence>

              {/* Teal Proof Seal (Step 5-6) */}
              <AnimatePresence>
                {isLocked && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.4 }}
                    className="flex items-center gap-2"
                  >
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center border"
                      style={{
                        borderColor: 'rgba(6, 182, 212, 0.5)',
                        background: 'rgba(6, 182, 212, 0.1)',
                        boxShadow: '0 0 20px rgba(6, 182, 212, 0.3)',
                      }}
                    >
                      <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <span className="text-xs font-mono text-cyan-400/80 uppercase tracking-wider">
                      Anchored
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Approval glow indicator (Step 4) */}
              <AnimatePresence>
                {isApprovalState && !isLocked && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-xs font-mono text-red-400 uppercase tracking-wider flex items-center gap-2"
                  >
                    <motion.div 
                      className="w-2 h-2 rounded-full bg-red-500"
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      style={{ boxShadow: '0 0 10px rgba(220, 38, 38, 0.8)' }}
                    />
                    Approved
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* === VERIFICATION HOLOGRAM OVERLAY (Step 6) === */}
          <AnimatePresence>
            {isFullyVerified && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 pointer-events-none flex items-center justify-center"
                style={{
                  clipPath: 'polygon(0 16px, 16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px))',
                  background: 'linear-gradient(180deg, rgba(6, 182, 212, 0.05) 0%, transparent 30%, transparent 70%, rgba(6, 182, 212, 0.08) 100%)',
                }}
              >
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className="px-6 py-3 rounded-xl border border-cyan-400/40 bg-black/40 backdrop-blur-sm"
                  style={{ boxShadow: '0 0 30px rgba(6, 182, 212, 0.25)' }}
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                    </svg>
                    <span className="text-sm font-mono text-cyan-400 uppercase tracking-wider">
                      Verified
                    </span>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
}

// =============================================================================
// SHARD CORNER BRACKET - HUD-style mechanical corners
// =============================================================================

function ShardCornerBracket({ 
  position, 
  color,
  locked,
}: { 
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  color: string;
  locked: boolean;
}) {
  const positionClasses = {
    'top-left': 'top-3 left-3',
    'top-right': 'top-3 right-3',
    'bottom-left': 'bottom-3 left-3',
    'bottom-right': 'bottom-3 right-3',
  };

  const isTop = position.includes('top');
  const isLeft = position.includes('left');

  return (
    <motion.div 
      className={`absolute w-6 h-6 ${positionClasses[position]}`}
      animate={{
        opacity: locked ? 1 : 0.6,
      }}
      transition={{ duration: 0.3 }}
    >
      {/* Horizontal line */}
      <div 
        className="absolute h-[2px] w-full"
        style={{
          top: isTop ? 0 : 'auto',
          bottom: isTop ? 'auto' : 0,
          left: isLeft ? 0 : 'auto',
          right: isLeft ? 'auto' : 0,
          background: `linear-gradient(${isLeft ? 'to right' : 'to left'}, ${color}, transparent)`,
        }}
      />
      {/* Vertical line */}
      <div 
        className="absolute w-[2px] h-full"
        style={{
          top: isTop ? 0 : 'auto',
          bottom: isTop ? 'auto' : 0,
          left: isLeft ? 0 : 'auto',
          right: isLeft ? 'auto' : 0,
          background: `linear-gradient(${isTop ? 'to bottom' : 'to top'}, ${color}, transparent)`,
        }}
      />
      {/* Corner lock indicator */}
      {locked && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute w-1.5 h-1.5 rounded-full bg-cyan-400"
          style={{
            top: isTop ? 0 : 'auto',
            bottom: isTop ? 'auto' : 0,
            left: isLeft ? 0 : 'auto',
            right: isLeft ? 'auto' : 0,
            boxShadow: '0 0 8px rgba(6, 182, 212, 0.8)',
          }}
        />
      )}
    </motion.div>
  );
}

// =============================================================================
// PROCESS CORE GRID - SVG-based mechanical grid inside the shard
// =============================================================================

function ProcessCoreGrid({ 
  isActive, 
  isApprovalState,
  isVerified,
}: { 
  isActive: boolean;
  isApprovalState: boolean;
  isVerified: boolean;
}) {
  const gridColor = isVerified 
    ? 'rgba(6, 182, 212, 0.15)' 
    : isApprovalState 
      ? 'rgba(220, 38, 38, 0.12)'
      : 'rgba(255, 255, 255, 0.05)';

  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: isActive ? 1 : 0.3 }}
      transition={{ duration: 0.5 }}
    >
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path 
              d="M 30 0 L 0 0 0 30" 
              fill="none" 
              stroke={gridColor}
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        {/* Center crosshair */}
        <line x1="50%" y1="40%" x2="50%" y2="60%" stroke={gridColor} strokeWidth="1" />
        <line x1="40%" y1="50%" x2="60%" y2="50%" stroke={gridColor} strokeWidth="1" />
      </svg>
    </motion.div>
  );
}

// =============================================================================
// WORKFLOW CONSTELLATION - Nodes and connections representing workflow
// =============================================================================

function WorkflowConstellation({ 
  step: _step,
  isApprovalState,
  isVerified,
}: { 
  step: StoryStep;
  isApprovalState: boolean;
  isVerified: boolean;
}) {
  // _step available for future per-step customization
  
  // =========================================================================
  // GEOMETRY CONSTANTS - All measurements relative to a 200x160 viewBox
  // Central vertical spine at x=100
  // =========================================================================
  const VIEWBOX = { width: 200, height: 160 };
  const CENTER_X = 100; // Central vertical spine
  
  // Vertical positions (evenly distributed)
  const ROW_Y = {
    reviewers: 30,  // Top row for R1, R2
    document: 70,   // Middle row for document
    approver: 120,  // Bottom row for approver
  };
  
  // Horizontal offset for reviewers (symmetric from center)
  const REVIEWER_OFFSET = 45;
  
  // Node sizes (visual hierarchy: approver > document > reviewers)
  const NODE_SIZE = {
    reviewer: 20,
    document: 28,
    approver: 32,
  };

  // Computed node positions
  const nodes = {
    r1: { x: CENTER_X - REVIEWER_OFFSET, y: ROW_Y.reviewers },
    r2: { x: CENTER_X + REVIEWER_OFFSET, y: ROW_Y.reviewers },
    doc: { x: CENTER_X, y: ROW_Y.document },
    approver: { x: CENTER_X, y: ROW_Y.approver },
  };

  // Colors
  const lineColor = isVerified 
    ? 'rgba(6, 182, 212, 0.6)' 
    : isApprovalState 
      ? 'rgba(220, 38, 38, 0.6)'
      : 'rgba(255, 255, 255, 0.25)';

  const reviewerColor = isVerified 
    ? 'rgba(6, 182, 212, 0.8)' 
    : 'rgba(255, 255, 255, 0.5)';

  const documentBorderColor = isVerified
    ? 'rgba(6, 182, 212, 0.5)'
    : isApprovalState
      ? 'rgba(220, 38, 38, 0.5)'
      : 'rgba(255, 255, 255, 0.25)';

  const approverColor = isVerified
    ? 'rgba(6, 182, 212, 1)'
    : isApprovalState
      ? 'rgba(220, 38, 38, 1)'
      : 'rgba(255, 255, 255, 0.6)';

  const approverGlow = isApprovalState 
    ? '0 0 25px rgba(220, 38, 38, 0.8), 0 0 50px rgba(220, 38, 38, 0.4)'
    : isVerified
      ? '0 0 20px rgba(6, 182, 212, 0.7), 0 0 40px rgba(6, 182, 212, 0.3)'
      : '0 0 10px rgba(255, 255, 255, 0.3)';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.5 }}
      className="absolute inset-0 flex items-center justify-center"
    >
      {/* SVG container with fixed viewBox for precise geometry */}
      <svg 
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        style={{ overflow: 'visible' }}
      >
        {/* ===== CONNECTION LINES ===== */}
        {/* R1 → Document */}
        <motion.line
          x1={nodes.r1.x}
          y1={nodes.r1.y}
          x2={nodes.doc.x}
          y2={nodes.doc.y}
          stroke={lineColor}
          strokeWidth={isApprovalState ? 2 : 1.5}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        />
        
        {/* R2 → Document */}
        <motion.line
          x1={nodes.r2.x}
          y1={nodes.r2.y}
          x2={nodes.doc.x}
          y2={nodes.doc.y}
          stroke={lineColor}
          strokeWidth={isApprovalState ? 2 : 1.5}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        />
        
        {/* Document → Approver (vertical spine) */}
        <motion.line
          x1={nodes.doc.x}
          y1={nodes.doc.y}
          x2={nodes.approver.x}
          y2={nodes.approver.y}
          stroke={lineColor}
          strokeWidth={isApprovalState ? 3 : 2}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        />

        {/* ===== REVIEWER NODE 1 (R1) ===== */}
        <motion.g
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          style={{ transformOrigin: `${nodes.r1.x}px ${nodes.r1.y}px` }}
        >
          <circle
            cx={nodes.r1.x}
            cy={nodes.r1.y}
            r={NODE_SIZE.reviewer / 2}
            fill={reviewerColor}
            style={{
              filter: isVerified ? 'drop-shadow(0 0 6px rgba(6, 182, 212, 0.6))' : 'drop-shadow(0 0 4px rgba(255, 255, 255, 0.3))',
            }}
          />
          <text
            x={nodes.r1.x}
            y={nodes.r1.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="7"
            fontFamily="monospace"
            fill="#000"
            fontWeight="500"
          >
            R1
          </text>
        </motion.g>

        {/* ===== REVIEWER NODE 2 (R2) ===== */}
        <motion.g
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          style={{ transformOrigin: `${nodes.r2.x}px ${nodes.r2.y}px` }}
        >
          <circle
            cx={nodes.r2.x}
            cy={nodes.r2.y}
            r={NODE_SIZE.reviewer / 2}
            fill={reviewerColor}
            style={{
              filter: isVerified ? 'drop-shadow(0 0 6px rgba(6, 182, 212, 0.6))' : 'drop-shadow(0 0 4px rgba(255, 255, 255, 0.3))',
            }}
          />
          <text
            x={nodes.r2.x}
            y={nodes.r2.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="7"
            fontFamily="monospace"
            fill="#000"
            fontWeight="500"
          >
            R2
          </text>
        </motion.g>

        {/* ===== DOCUMENT NODE (DOC) - Centered on spine ===== */}
        <motion.g
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          style={{ transformOrigin: `${nodes.doc.x}px ${nodes.doc.y}px` }}
        >
          <rect
            x={nodes.doc.x - NODE_SIZE.document / 2}
            y={nodes.doc.y - NODE_SIZE.document / 2}
            width={NODE_SIZE.document}
            height={NODE_SIZE.document}
            rx={4}
            fill="rgba(255, 255, 255, 0.08)"
            stroke={documentBorderColor}
            strokeWidth={1.5}
          />
          {/* Document icon inside */}
          <path
            d={`M${nodes.doc.x - 5} ${nodes.doc.y - 7} 
                L${nodes.doc.x + 3} ${nodes.doc.y - 7} 
                L${nodes.doc.x + 6} ${nodes.doc.y - 4} 
                L${nodes.doc.x + 6} ${nodes.doc.y + 7} 
                L${nodes.doc.x - 5} ${nodes.doc.y + 7} Z`}
            fill="none"
            stroke={isVerified ? 'rgba(6, 182, 212, 0.7)' : 'rgba(255, 255, 255, 0.5)'}
            strokeWidth={1}
          />
          {/* Folded corner */}
          <path
            d={`M${nodes.doc.x + 3} ${nodes.doc.y - 7} 
                L${nodes.doc.x + 3} ${nodes.doc.y - 4} 
                L${nodes.doc.x + 6} ${nodes.doc.y - 4}`}
            fill="none"
            stroke={isVerified ? 'rgba(6, 182, 212, 0.7)' : 'rgba(255, 255, 255, 0.5)'}
            strokeWidth={1}
          />
        </motion.g>

        {/* ===== APPROVER NODE (AP) - Largest, centered on spine ===== */}
        <motion.g
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.35 }}
          style={{ transformOrigin: `${nodes.approver.x}px ${nodes.approver.y}px` }}
        >
          <motion.circle
            cx={nodes.approver.x}
            cy={nodes.approver.y}
            r={NODE_SIZE.approver / 2}
            fill={approverColor}
            animate={isApprovalState ? { 
              r: [NODE_SIZE.approver / 2, NODE_SIZE.approver / 2 * 1.12, NODE_SIZE.approver / 2] 
            } : {}}
            transition={{ duration: 1.5, repeat: isApprovalState ? Infinity : 0 }}
            style={{
              filter: approverGlow.replace(/,/g, '').includes('rgba') 
                ? `drop-shadow(${approverGlow.split(',')[0]})` 
                : undefined,
            }}
          />
          {/* Checkmark icon */}
          <motion.path
            d={`M${nodes.approver.x - 6} ${nodes.approver.y} 
                L${nodes.approver.x - 2} ${nodes.approver.y + 4} 
                L${nodes.approver.x + 6} ${nodes.approver.y - 4}`}
            fill="none"
            stroke={isApprovalState || isVerified ? '#fff' : '#000'}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, delay: 0.5 }}
          />
        </motion.g>
      </svg>
    </motion.div>
  );
}

// =============================================================================
// DATA SHARD DISSOLVE - Documents dissolving into fingerprints
// =============================================================================

function DataShardDissolve() {
  // =========================================================================
  // GEOMETRY CONSTANTS - Symmetric positioning relative to center
  // =========================================================================
  const CENTER_X = 100; // Center of 200-unit viewBox
  const SHARD_OFFSET = 50; // Distance from center for left/right shards
  const SHARD_Y_START = 40;
  const SHARD_Y_END = 100;
  
  const shards = [
    { id: 1, startX: CENTER_X - SHARD_OFFSET, endX: CENTER_X, delay: 0 },
    { id: 2, startX: CENTER_X, endX: CENTER_X, delay: 0.3 },
    { id: 3, startX: CENTER_X + SHARD_OFFSET, endX: CENTER_X, delay: 0.6 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
      <svg 
        viewBox="0 0 200 160" 
        className="w-full h-full" 
        preserveAspectRatio="xMidYMid meet"
        style={{ overflow: 'visible' }}
      >
        {shards.map((shard) => (
          <motion.g
            key={shard.id}
            initial={{ 
              x: shard.startX - CENTER_X,
              y: SHARD_Y_START - 80,
              opacity: 0,
              scale: 0.6,
            }}
            animate={{ 
              x: shard.endX - CENTER_X,
              y: SHARD_Y_END - 80,
              opacity: [0, 0.9, 0.7, 0],
              scale: [0.6, 0.8, 0.4, 0],
            }}
            transition={{ 
              duration: 3, 
              delay: shard.delay,
              repeat: Infinity,
              repeatDelay: 0.5,
              ease: 'easeInOut',
            }}
            style={{ transformOrigin: `${CENTER_X}px 80px` }}
          >
            {/* Abstract data shard - document shape */}
            <rect
              x={CENTER_X - 10}
              y={70}
              width={20}
              height={24}
              rx={2}
              fill="rgba(220, 38, 38, 0.2)"
              stroke="rgba(220, 38, 38, 0.5)"
              strokeWidth={1}
              style={{ clipPath: 'polygon(0 0, 100% 0, 100% 80%, 80% 100%, 0 100%)' }}
            />
            {/* Folded corner hint */}
            <path
              d={`M${CENTER_X + 6} ${70} L${CENTER_X + 10} ${70} L${CENTER_X + 10} ${74}`}
              fill="none"
              stroke="rgba(220, 38, 38, 0.4)"
              strokeWidth={1}
            />
            
            {/* Hex fingerprint that appears as it dissolves */}
            <motion.text
              x={CENTER_X}
              y={105}
              textAnchor="middle"
              fontSize="8"
              fontFamily="monospace"
              fill="rgba(220, 38, 38, 0.9)"
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: [0, 1, 0], y: 12 }}
              transition={{ 
                duration: 1.5, 
                delay: shard.delay + 0.8, 
                repeat: Infinity, 
                repeatDelay: 2,
              }}
            >
              0x{Math.random().toString(16).substr(2, 6).toUpperCase()}
            </motion.text>
          </motion.g>
        ))}
      </svg>
    </div>
  );
}

// =============================================================================
// STORY SECTION COMPONENT
// =============================================================================

function StorySection({ 
  content, 
  isActive, 
  onEnterViewport 
}: { 
  content: StepContent; 
  isActive: boolean;
  onEnterViewport: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            onEnterViewport();
          }
        });
      },
      { 
        threshold: 0.6,
        rootMargin: '-10% 0px -30% 0px',
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [onEnterViewport]);

  return (
    <motion.div
      ref={ref}
      className="min-h-[70vh] flex items-center py-20"
      initial={{ opacity: 0.3 }}
      animate={{ opacity: isActive ? 1 : 0.3 }}
      transition={{ duration: 0.4 }}
    >
      <div 
        className="relative w-full px-8 py-10"
        style={{
          clipPath: 'polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px))',
          background: isActive ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.2)',
          border: isActive ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(255, 255, 255, 0.05)',
          transition: 'background 0.4s ease, border-color 0.4s ease',
        }}
      >
        {/* Step Label */}
        <motion.div 
          className="text-xs font-mono uppercase tracking-[0.3em] mb-4"
          style={{ 
            color: isActive 
              ? content.step >= 5 ? 'rgba(6, 182, 212, 0.8)' : 'rgba(220, 38, 38, 0.8)' 
              : 'rgba(100, 116, 139, 0.6)',
            transition: 'color 0.4s ease',
          }}
        >
          {content.stepLabel}
        </motion.div>

        {/* Headline with signal stutter */}
        <h3 
          className="text-2xl lg:text-3xl font-bold mb-4 leading-tight"
          style={{ 
            color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.4)',
            transition: 'color 0.4s ease',
          }}
        >
          {isActive ? (
            <DecryptionText 
              text={content.headline} 
              delay={100} 
              duration={400} 
              isActive={isActive}
            />
          ) : (
            content.headline
          )}
        </h3>

        {/* Body text */}
        <p 
          className="text-lg lg:text-xl leading-relaxed max-w-md"
          style={{ 
            color: isActive ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.3)',
            transition: 'color 0.4s ease',
          }}
        >
          {content.body}
        </p>

        {/* Active indicator line */}
        <motion.div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-full"
          initial={{ height: 0, opacity: 0 }}
          animate={{ 
            height: isActive ? '60%' : 0, 
            opacity: isActive ? 1 : 0,
          }}
          transition={{ duration: 0.3 }}
          style={{
            background: content.step >= 5 
              ? 'linear-gradient(to bottom, transparent, rgba(6, 182, 212, 0.8), transparent)'
              : 'linear-gradient(to bottom, transparent, rgba(220, 38, 38, 0.8), transparent)',
            boxShadow: content.step >= 5 
              ? '0 0 15px rgba(6, 182, 212, 0.5)'
              : '0 0 15px rgba(220, 38, 38, 0.5)',
          }}
        />
      </div>
    </motion.div>
  );
}

// =============================================================================
// CONCLUSION SECTION - Terminal end state, no sticky elements
// =============================================================================

function ConclusionSection({ onVisibilityChange }: { onVisibilityChange: (visible: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Update visibility state based on intersection
          onVisibilityChange(entry.isIntersecting);
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [onVisibilityChange]);

  return (
    <div 
      ref={ref}
      className="relative z-20 h-screen flex items-center justify-center px-8 bg-[#0A0A0B]"
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={isVisible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8 }}
        className="text-center max-w-3xl"
      >
        {/* Main statement */}
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 leading-tight">
          <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Workflows stay private.
          </span>
          <br />
          <span className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-white bg-clip-text text-transparent">
            Approvals stay provable.
          </span>
        </h2>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={isVisible ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-lg text-slate-500 font-medium tracking-wide"
        >
          CEWCE + Casper — The Architecture of Trust
        </motion.p>

        {/* Decorative line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={isVisible ? { scaleX: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-12 h-px w-40 mx-auto"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.5), transparent)',
          }}
        />
      </motion.div>
    </div>
  );
}

// =============================================================================
// PAGE HEADER
// =============================================================================

function PageHeader() {
  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-50 px-6 py-4 backdrop-blur-md bg-black/30 border-b border-white/5"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Back to Home */}
        <Link 
          to="/"
          className="flex items-center gap-3 text-white/70 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          <span className="text-sm font-medium">Back</span>
        </Link>

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="text-white font-semibold text-lg tracking-wide">
            CEWCE
          </span>
        </div>

        {/* Sign In Link */}
        <Link
          to="/auth/login"
          className="text-sm text-white/70 hover:text-white transition-colors font-medium"
        >
          Sign in
        </Link>
      </div>
    </motion.header>
  );
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export function ArchitectureOfTrustPage() {
  const [activeStep, setActiveStep] = useState<StoryStep>(1);
  const [isInConclusion, setIsInConclusion] = useState(false);

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white overflow-x-hidden">
      {/* Background Elements */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Slow drifting blob - top right */}
        <motion.div
          animate={{ 
            x: [0, 30, -20, 0],
            y: [0, -20, 10, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute w-[600px] h-[600px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, #8b0000 0%, transparent 70%)',
            filter: 'blur(120px)',
            top: '-10%',
            right: '-10%',
          }}
        />
        {/* Slate blob - bottom left */}
        <motion.div
          animate={{ 
            x: [0, -25, 15, 0],
            y: [0, 25, -15, 0],
          }}
          transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute w-[500px] h-[500px] rounded-full opacity-15"
          style={{
            background: 'radial-gradient(circle, #1e293b 0%, transparent 70%)',
            filter: 'blur(140px)',
            bottom: '-15%',
            left: '-10%',
          }}
        />
        {/* Noise texture */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Fixed Header */}
      <PageHeader />

      {/* LEFT COLUMN - Fixed Digital Shard (60%) - Fades out at conclusion */}
      <motion.div 
        className="hidden lg:flex fixed top-0 left-0 w-[60%] h-screen items-center justify-center p-8 z-10"
        initial={{ opacity: 1 }}
        animate={{ 
          opacity: isInConclusion ? 0 : 1,
          pointerEvents: isInConclusion ? 'none' : 'auto',
        }}
        transition={{ duration: 0.5 }}
      >
        <DigitalShard activeStep={activeStep} />
      </motion.div>

      {/* Mobile: Show shard at top */}
      <div className="lg:hidden flex items-center justify-center p-8 h-[50vh] pt-24">
        <DigitalShard activeStep={activeStep} />
      </div>

      {/* RIGHT COLUMN - Scrollable Story Sections (40%) - Offset to the right on desktop */}
      <div className="relative z-10 lg:ml-[60%] lg:w-[40%] pt-20 lg:pt-0">
        {/* Story Sections */}
        <div className="px-4 lg:px-8 lg:pt-20">
          {STORY_STEPS.map((step) => (
            <StorySection
              key={step.step}
              content={step}
              isActive={activeStep === step.step}
              onEnterViewport={() => setActiveStep(step.step)}
            />
          ))}
        </div>
      </div>

      {/* Conclusion Section - Full Width Terminal Section */}
      <ConclusionSection onVisibilityChange={setIsInConclusion} />

      {/* Step indicator - fixed on bottom, hidden at conclusion */}
      <motion.div 
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 hidden lg:flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10"
        animate={{ opacity: isInConclusion ? 0 : 1 }}
        transition={{ duration: 0.3 }}
      >
        {STORY_STEPS.map((step) => (
          <button
            key={step.step}
            onClick={() => {
              const element = document.querySelector(`[data-step="${step.step}"]`);
              element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              activeStep === step.step 
                ? step.step >= 5 
                  ? 'bg-cyan-400 scale-125' 
                  : 'bg-red-500 scale-125'
                : 'bg-white/30 hover:bg-white/50'
            }`}
          />
        ))}
      </motion.div>
    </div>
  );
}

export default ArchitectureOfTrustPage;
