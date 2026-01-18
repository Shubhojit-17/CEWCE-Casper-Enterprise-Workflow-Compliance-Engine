// =============================================================================
// Demo Overlay Component - TESTNET ONLY
// =============================================================================
// Fullscreen overlay that hosts the NarrativeBox story-driven guide.
// All demo code is isolated in src/demo/ and can be safely removed for mainnet.
// =============================================================================

import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDemoContext } from './DemoProvider';
import { DemoHighlight } from './DemoHighlight';
import { DemoRoleBadge } from './DemoRoleBadge';
import { NarrativeBox } from './NarrativeBox';
import { DEMO_CONFIG, DEMO_ENABLED } from './demoConfig';
import { STORY_SEQUENCES, TOTAL_SEQUENCES } from './StorySequences';

/**
 * DemoOverlay is the main overlay component that displays:
 * - NarrativeBox story-driven guidance
 * - Progress indicator
 * - Element highlighting
 */
export function DemoOverlay(): React.ReactElement | null {
  const demo = useDemoContext();
  const [narrativeKey, setNarrativeKey] = useState(0);
  
  // Get state safely (may be null if demo not active)
  const state = demo?.state;
  const currentStepIndex = state?.currentStepIndex ?? 0;

  // Map current step index to story sequence - MUST be called before any returns
  const currentSequence = useMemo(() => {
    if (currentStepIndex >= STORY_SEQUENCES.length) {
      return STORY_SEQUENCES[STORY_SEQUENCES.length - 1];
    }
    return STORY_SEQUENCES[currentStepIndex] || STORY_SEQUENCES[0];
  }, [currentStepIndex]);

  // Trigger re-render of NarrativeBox on step change - MUST be called before any returns
  useEffect(() => {
    setNarrativeKey(prev => prev + 1);
  }, [currentStepIndex]);

  // Don't render if demo is not enabled or not active
  if (!DEMO_ENABLED || !demo || !state?.isActive) {
    return null;
  }

  const { nextStep, skipDemo } = demo;

  // Determine if we should show the highlight
  const showHighlight = Boolean(
    currentSequence.targetSelector && 
    currentSequence.action === 'click'
  );

  // Handle action click
  const handleAction = () => {
    nextStep();
  };

  // Handle skip click
  const handleSkip = () => {
    skipDemo();
  };

  const overlayContent = (
    <>
      {/* Element highlight overlay */}
      <DemoHighlight
        targetSelector={currentSequence.targetSelector}
        isActive={showHighlight}
      />

      {/* Role badge */}
      <DemoRoleBadge role={state.currentRole} />

      {/* Narrative Box - Fixed bottom center */}
      <div
        className="fixed inset-0 flex items-end justify-center pointer-events-none"
        style={{ zIndex: DEMO_CONFIG.overlayZIndex }}
      >
        <div className="w-full max-w-2xl p-4 sm:p-6 pointer-events-auto">
          {/* Progress indicator above NarrativeBox */}
          <div className="mb-2 flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              {STORY_SEQUENCES.map((seq, idx) => (
                <div
                  key={seq.id}
                  className={`
                    h-1.5 w-6 rounded-full transition-all duration-300
                    ${idx <= state.currentStepIndex 
                      ? 'bg-red-500' 
                      : 'bg-white/20'}
                  `}
                />
              ))}
            </div>
            <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">
              {currentSequence.sequenceLabel} / {TOTAL_SEQUENCES - 1}
            </span>
          </div>

          {/* NarrativeBox with story content */}
          <NarrativeBox
            key={narrativeKey}
            sequenceId={currentSequence.sequenceLabel}
            title={currentSequence.title}
            body={currentSequence.narrative}
            actionText={currentSequence.actionText}
            showSkip={currentSequence.showSkip}
            onAction={handleAction}
            onSkip={handleSkip}
            isVisible={true}
          />
        </div>
      </div>
    </>
  );

  return createPortal(overlayContent, document.body);
}

export default DemoOverlay;
