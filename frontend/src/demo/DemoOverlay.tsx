// =============================================================================
// Demo Overlay Component - TESTNET ONLY
// =============================================================================
// Fullscreen glassmorphic overlay that guides users through the demo.
// All demo code is isolated in src/demo/ and can be safely removed for mainnet.
// =============================================================================

import React from 'react';
import { createPortal } from 'react-dom';
import {
  XMarkIcon,
  ArrowRightIcon,
  ForwardIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  BeakerIcon,
  ShieldCheckIcon,
  UserIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';
import { useDemoContext } from './DemoProvider';
import { DemoHighlight } from './DemoHighlight';
import { DemoRoleBadge } from './DemoRoleBadge';
import { DEMO_CONFIG, DEMO_ENABLED } from './demoConfig';
import { getDemoRoleDisplayName } from './DemoRoleSwitcher';

/**
 * Get icon for current step
 */
function getStepIcon(stepId: string): React.ReactElement {
  const iconClass = "h-8 w-8 text-red-400";
  
  if (stepId.includes('login')) return <UserIcon className={iconClass} />;
  if (stepId.includes('workflow')) return <ClipboardDocumentCheckIcon className={iconClass} />;
  if (stepId.includes('approver') || stepId.includes('approve')) return <ShieldCheckIcon className={iconClass} />;
  if (stepId.includes('onchain') || stepId.includes('proof')) return <CheckCircleIcon className={iconClass} />;
  if (stepId.includes('transition')) return <ArrowPathIcon className={iconClass} />;
  if (stepId === 'orientation' || stepId === 'demo-complete') return <BeakerIcon className={iconClass} />;
  
  return <ClipboardDocumentCheckIcon className={iconClass} />;
}

/**
 * DemoOverlay is the main overlay component that displays:
 * - Current step guidance
 * - Progress indicator
 * - Navigation buttons
 * - Element highlighting
 */
export function DemoOverlay(): React.ReactElement | null {
  const demo = useDemoContext();
  
  // Don't render if demo is not enabled or not active
  if (!DEMO_ENABLED || !demo || !demo.state.isActive || !demo.currentStep) {
    return null;
  }

  const { currentStep, state, nextStep, skipDemo, exitDemo, progress, isLastStep } = demo;

  // Determine if we should show the highlight
  const showHighlight = Boolean(currentStep.targetSelector && currentStep.action === 'wait-for-action');

  const overlayContent = (
    <>
      {/* Element highlight overlay */}
      <DemoHighlight
        targetSelector={currentStep.targetSelector}
        isActive={showHighlight}
      />

      {/* Role badge */}
      <DemoRoleBadge role={state.currentRole} />

      {/* Main guidance panel */}
      <div
        className="fixed inset-0 flex items-end justify-center p-4 sm:p-6"
        style={{ zIndex: DEMO_CONFIG.overlayZIndex, pointerEvents: 'none' }}
      >
        <div
          className="w-full max-w-2xl mb-4 pointer-events-auto"
          style={{
            animation: 'demo-slide-up 0.3s ease-out',
          }}
        >
          {/* Glassmorphic panel */}
          <div className="relative rounded-2xl overflow-hidden">
            {/* Background with blur */}
            <div className="absolute inset-0 bg-[#0A0A0B]/90 backdrop-blur-xl" />
            
            {/* Red glow border */}
            <div className="absolute inset-0 rounded-2xl border border-red-500/30" />
            <div
              className="absolute inset-0 rounded-2xl"
              style={{
                boxShadow: `
                  0 0 30px rgba(220, 38, 38, 0.15),
                  0 0 60px rgba(220, 38, 38, 0.1),
                  inset 0 1px 0 rgba(255, 255, 255, 0.05)
                `,
              }}
            />

            {/* Content */}
            <div className="relative p-6">
              {/* Header with progress */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getStepIcon(currentStep.id)}
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {currentStep.title}
                    </h3>
                    {state.currentRole && (
                      <span className="text-xs font-medium text-red-400 uppercase tracking-wider">
                        Role: {getDemoRoleDisplayName(state.currentRole)}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Exit button */}
                <button
                  onClick={exitDemo}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  title="Exit Demo"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Demo Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="mb-4">
                <p className="text-slate-300 whitespace-pre-line leading-relaxed">
                  {currentStep.description}
                </p>
              </div>

              {/* Instruction highlight */}
              {currentStep.instruction && (
                <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-300">
                    <span className="font-semibold">→ </span>
                    {currentStep.instruction}
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {currentStep.showSkip && (
                    <button
                      onClick={skipDemo}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      <ForwardIcon className="h-4 w-4" />
                      Skip Demo
                    </button>
                  )}
                </div>

                <button
                  onClick={nextStep}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-white transition-all duration-200"
                  style={{
                    background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                    boxShadow: '0 4px 15px rgba(220, 38, 38, 0.3)',
                  }}
                >
                  {isLastStep ? (
                    <>
                      <CheckCircleIcon className="h-5 w-5" />
                      {currentStep.nextButtonText || 'Exit Demo'}
                    </>
                  ) : (
                    <>
                      {currentStep.nextButtonText || 'Continue'}
                      <ArrowRightIcon className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes demo-slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );

  return createPortal(overlayContent, document.body);
}

export default DemoOverlay;
