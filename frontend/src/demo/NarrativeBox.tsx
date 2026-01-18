// =============================================================================
// NarrativeBox Component - "Data-Shard Guide" - TESTNET ONLY
// =============================================================================
// The system itself guiding the user through a compliance scenario.
// Ultra-thin glass panel with HUD brackets and mechanical frame design.
// Appears only when a demo step requires user action, then disappears.
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// =============================================================================
// Constants
// =============================================================================

const HEX_CHARS = '0123456789ABCDEF';

// =============================================================================
// DecryptionText - Text reveals via hex scramble effect
// =============================================================================

interface DecryptionTextProps {
  text: string;
  delay?: number;
  duration?: number;
  className?: string;
  onComplete?: () => void;
}

function DecryptionText({ 
  text, 
  delay = 0, 
  duration = 400, 
  className = '',
  onComplete 
}: DecryptionTextProps) {
  const [displayText, setDisplayText] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [hasDecrypted, setHasDecrypted] = useState(false);

  useEffect(() => {
    // Reset state when text changes
    setDisplayText('');
    setIsDecrypting(false);
    setHasDecrypted(false);

    const startTimeout = setTimeout(() => {
      setIsDecrypting(true);
      
      // Create initial scrambled text
      const scrambled = text.split('').map(char => 
        char === ' ' || char === '\n' ? char : HEX_CHARS[Math.floor(Math.random() * HEX_CHARS.length)]
      ).join('');
      setDisplayText(scrambled);
      
      const charDuration = duration / text.length;
      let currentIndex = 0;
      
      // Scramble interval during decryption
      const scrambleInterval = setInterval(() => {
        setDisplayText(prev => {
          const chars = prev.split('');
          for (let i = currentIndex; i < text.length; i++) {
            if (text[i] !== ' ' && text[i] !== '\n') {
              chars[i] = HEX_CHARS[Math.floor(Math.random() * HEX_CHARS.length)];
            }
          }
          return chars.join('');
        });
      }, 40);
      
      // Character reveal interval
      const revealInterval = setInterval(() => {
        if (currentIndex >= text.length) {
          clearInterval(revealInterval);
          clearInterval(scrambleInterval);
          setDisplayText(text);
          setIsDecrypting(false);
          setHasDecrypted(true);
          onComplete?.();
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
  }, [text, delay, duration, onComplete]);

  return (
    <span 
      className={`${className}`}
      style={{
        color: hasDecrypted ? '#ffffff' : '#ef4444',
        textShadow: isDecrypting 
          ? '0 0 8px rgba(239, 68, 68, 0.8)' 
          : hasDecrypted 
            ? '0 0 15px rgba(255, 255, 255, 0.15)' 
            : 'none',
        filter: isDecrypting ? 'blur(0.3px)' : 'none',
        transition: 'color 0.2s ease, text-shadow 0.2s ease, filter 0.2s ease',
      }}
    >
      {displayText || text.split('').map(c => (c === ' ' || c === '\n') ? c : '█').join('')}
    </span>
  );
}

// =============================================================================
// NarrativeBox Animation Variants
// =============================================================================

const narrativeVariants = {
  // Phase 1: Scan-Line Ignition (0-150ms)
  hidden: { 
    opacity: 0,
    scaleY: 0,
    scaleX: 1,
    filter: 'brightness(3) blur(4px)',
  },
  // Phase 2: De-Pixelation Expansion (150-400ms)
  visible: { 
    opacity: [0, 0.4, 1, 0.6, 1, 0.8, 1],
    scaleY: 1,
    scaleX: 1,
    filter: 'brightness(1) blur(0px)',
    transition: { 
      duration: 0.5,
      times: [0, 0.1, 0.2, 0.35, 0.5, 0.7, 1],
      ease: 'easeOut' as const,
    }
  },
  // Exit: Collapse to point of light
  exit: { 
    opacity: [1, 0.8, 0],
    scaleY: [1, 0.5, 0],
    scaleX: [1, 0.3, 0],
    filter: 'brightness(2) blur(3px)',
    transition: { 
      duration: 0.3,
      ease: 'easeIn' as const,
    } 
  }
};

// HUD bracket pulse animation
const bracketPulseVariants = {
  idle: {
    opacity: [0.6, 1, 0.6],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut' as const,
    }
  }
};

// =============================================================================
// NarrativeBox Props Interface
// =============================================================================

export interface NarrativeBoxProps {
  /** Sequence label (e.g., "SEQ_01") */
  sequenceId: string;
  /** Title descriptor (e.g., "DOCUMENT SUBMISSION") */
  title: string;
  /** Main narrative text (max 2-3 lines per paragraph) */
  body: string | string[];
  /** Whether the box is visible */
  isVisible: boolean;
  /** Position on screen */
  position?: 'bottom-center' | 'bottom-left' | 'bottom-right' | 'top-center';
  /** Optional action button text */
  actionText?: string;
  /** Action button handler */
  onAction?: () => void;
  /** Skip button handler */
  onSkip?: () => void;
  /** Show skip option */
  showSkip?: boolean;
}

// =============================================================================
// NarrativeBox Component
// =============================================================================

export function NarrativeBox({
  sequenceId,
  title,
  body,
  isVisible,
  position = 'bottom-center',
  actionText,
  onAction,
  onSkip,
  showSkip = false,
}: NarrativeBoxProps): React.ReactElement | null {
  const [textPhase, setTextPhase] = useState<'idle' | 'decrypting' | 'complete'>('idle');
  const [headerDecrypted, setHeaderDecrypted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset text phase when content changes
  useEffect(() => {
    if (isVisible) {
      setTextPhase('decrypting');
      setHeaderDecrypted(false);
    } else {
      setTextPhase('idle');
    }
  }, [isVisible, sequenceId]);

  // Position classes
  const positionClasses = {
    'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2',
    'bottom-left': 'bottom-6 left-6',
    'bottom-right': 'bottom-6 right-6',
    'top-center': 'top-24 left-1/2 -translate-x-1/2',
  };

  const bodyParagraphs = Array.isArray(body) ? body : [body];

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          ref={containerRef}
          className={`fixed z-[9999] ${positionClasses[position]}`}
          variants={narrativeVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{ 
            transformOrigin: 'center center',
            maxWidth: '540px',
            width: '90vw',
          }}
        >
          {/* Scan Line Flash (Phase 1) */}
          <motion.div
            className="absolute inset-x-0 top-1/2 h-[2px] pointer-events-none"
            initial={{ opacity: 1, scaleX: 0.3 }}
            animate={{ opacity: 0, scaleX: 1 }}
            transition={{ duration: 0.15 }}
            style={{
              background: 'linear-gradient(90deg, transparent, #ef4444, transparent)',
              filter: 'blur(1px)',
              boxShadow: '0 0 20px #ef4444',
            }}
          />

          {/* HUD Brackets - Outer Layer (2px outside main box) */}
          <motion.div
            className="absolute -inset-[3px] pointer-events-none"
            variants={bracketPulseVariants}
            animate="idle"
          >
            {/* Top-Left Bracket */}
            <div className="absolute top-0 left-0 w-6 h-6">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-white/80 to-transparent" />
              <div className="absolute top-0 left-0 w-[1px] h-full bg-gradient-to-b from-white/80 to-transparent" />
            </div>
            {/* Top-Right Bracket */}
            <div className="absolute top-0 right-0 w-6 h-6">
              <div className="absolute top-0 right-0 w-full h-[1px] bg-gradient-to-l from-white/80 to-transparent" />
              <div className="absolute top-0 right-0 w-[1px] h-full bg-gradient-to-b from-white/80 to-transparent" />
            </div>
            {/* Bottom-Left Bracket */}
            <div className="absolute bottom-0 left-0 w-6 h-6">
              <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-red-500/80 to-transparent" />
              <div className="absolute bottom-0 left-0 w-[1px] h-full bg-gradient-to-t from-red-500/80 to-transparent" />
            </div>
            {/* Bottom-Right Bracket */}
            <div className="absolute bottom-0 right-0 w-6 h-6">
              <div className="absolute bottom-0 right-0 w-full h-[1px] bg-gradient-to-l from-red-500/80 to-transparent" />
              <div className="absolute bottom-0 right-0 w-[1px] h-full bg-gradient-to-t from-red-500/80 to-transparent" />
            </div>
          </motion.div>

          {/* Main Glass Chassis */}
          <div
            className="relative overflow-hidden"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              // Notched corners via clip-path
              clipPath: 'polygon(0 10px, 10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px))',
              // Multi-layer rim light border
              borderTop: '1px solid rgba(255, 255, 255, 0.25)',
              borderLeft: '1px solid rgba(255, 255, 255, 0.15)',
              borderRight: '1px solid rgba(255, 3, 3, 0.15)',
              borderBottom: '1px solid rgba(255, 3, 3, 0.3)',
              boxShadow: `
                inset 0 0 30px rgba(255, 255, 255, 0.03),
                inset 0 0 60px rgba(220, 38, 38, 0.05),
                0 20px 50px rgba(0, 0, 0, 0.5),
                0 0 40px rgba(220, 38, 38, 0.15)
              `,
            }}
          >
            {/* Active Indicator Dot (top-left) */}
            <div className="absolute top-3 left-4 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span 
                  className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
                  style={{ backgroundColor: 'rgba(220, 38, 38, 0.8)' }}
                />
                <span 
                  className="relative inline-flex h-2 w-2 rounded-full"
                  style={{ 
                    backgroundColor: '#dc2626',
                    boxShadow: '0 0 10px rgba(220, 38, 38, 1)',
                  }}
                />
              </span>
              <span className="text-[9px] text-slate-500 uppercase tracking-[0.2em] font-mono">
                SYSTEM GUIDE
              </span>
            </div>

            {/* Header (top-right) - Sequence Label */}
            <div className="absolute top-3 right-4 text-right">
              <span 
                className="text-[11px] font-mono uppercase tracking-[0.15em] text-slate-400"
                style={{ textShadow: '0 0 10px rgba(255, 255, 255, 0.2)' }}
              >
                {headerDecrypted ? (
                  `${sequenceId} // ${title}`
                ) : (
                  <DecryptionText 
                    text={`${sequenceId} // ${title}`} 
                    delay={200} 
                    duration={300}
                    onComplete={() => setHeaderDecrypted(true)}
                  />
                )}
              </span>
            </div>

            {/* Top Edge Highlight */}
            <div 
              className="absolute top-0 left-6 right-6 h-px pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
              }}
            />

            {/* Content */}
            <div className="pt-10 pb-5 px-5">
              {/* Body Text - Decryption Effect */}
              <div className="space-y-3 mb-5">
                {bodyParagraphs.map((paragraph, idx) => (
                  <p 
                    key={idx}
                    className="text-sm leading-relaxed font-light"
                    style={{
                      textShadow: '0 0 20px rgba(239, 68, 68, 0.15)',
                    }}
                  >
                    <DecryptionText 
                      text={paragraph}
                      delay={400 + (idx * 200)}
                      duration={Math.min(600, paragraph.length * 8)}
                      onComplete={() => {
                        if (idx === bodyParagraphs.length - 1) {
                          setTextPhase('complete');
                        }
                      }}
                    />
                  </p>
                ))}
              </div>

              {/* Action Area */}
              {(actionText || showSkip) && (
                <motion.div 
                  className="flex items-center justify-between gap-4 pt-3 border-t border-white/5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: textPhase === 'complete' ? 1 : 0.3 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Skip Button */}
                  {showSkip && onSkip && (
                    <button
                      onClick={onSkip}
                      className="text-xs text-slate-500 hover:text-slate-300 uppercase tracking-wider font-mono transition-colors"
                    >
                      [SKIP]
                    </button>
                  )}

                  {/* Action Button */}
                  {actionText && onAction && (
                    <motion.button
                      onClick={onAction}
                      disabled={textPhase !== 'complete'}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="ml-auto px-5 py-2.5 text-sm font-medium uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.25) 0%, rgba(220, 38, 38, 0.15) 100%)',
                        border: '1px solid rgba(220, 38, 38, 0.4)',
                        clipPath: 'polygon(0 4px, 4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px))',
                        boxShadow: textPhase === 'complete' 
                          ? '0 0 20px rgba(220, 38, 38, 0.3)' 
                          : 'none',
                        color: textPhase === 'complete' ? '#ffffff' : '#64748b',
                      }}
                    >
                      {actionText}
                    </motion.button>
                  )}
                </motion.div>
              )}
            </div>

            {/* Scan Line Animation */}
            <motion.div
              animate={{
                top: ['0%', '100%', '0%'],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: 'linear',
              }}
              className="absolute left-0 right-0 h-px pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(220, 38, 38, 0.3), transparent)',
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default NarrativeBox;
