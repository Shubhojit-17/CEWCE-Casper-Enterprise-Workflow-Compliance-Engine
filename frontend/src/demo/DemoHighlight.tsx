// =============================================================================
// Demo Highlight Component - TESTNET ONLY
// =============================================================================
// Creates a spotlight effect with red glow focus ring around target elements.
// All demo code is isolated in src/demo/ and can be safely removed for mainnet.
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DEMO_CONFIG } from './demoConfig';

interface DemoHighlightProps {
  /** CSS selector for the element to highlight */
  targetSelector?: string;
  /** Whether the highlight is active */
  isActive: boolean;
  /** Optional click handler when clicking on the dimmed area */
  onDimClick?: () => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * DemoHighlight creates a fullscreen overlay that dims everything
 * except the target element, which gets a red glow focus ring.
 */
export function DemoHighlight({ targetSelector, isActive, onDimClick }: DemoHighlightProps): React.ReactElement | null {
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Find and track target element position
  const updateTargetPosition = useCallback(() => {
    if (!targetSelector || !isActive) {
      setTargetRect(null);
      return;
    }

    const element = document.querySelector(targetSelector);
    if (element) {
      const rect = element.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
      setIsVisible(true);

      // Scroll element into view if needed
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      setTargetRect(null);
      setIsVisible(false);
    }
  }, [targetSelector, isActive]);

  // Update position on mount and resize
  useEffect(() => {
    if (!isActive) {
      setIsVisible(false);
      return;
    }

    // Initial position update with delay for DOM to settle
    const initialTimeout = setTimeout(updateTargetPosition, 300);

    // Update on scroll and resize
    window.addEventListener('scroll', updateTargetPosition, true);
    window.addEventListener('resize', updateTargetPosition);

    // Set up mutation observer for DOM changes
    const observer = new MutationObserver(updateTargetPosition);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(initialTimeout);
      window.removeEventListener('scroll', updateTargetPosition, true);
      window.removeEventListener('resize', updateTargetPosition);
      observer.disconnect();
    };
  }, [isActive, updateTargetPosition]);

  // Don't render anything if not active or no target
  if (!isActive) return null;

  const padding = 8; // Padding around the target element

  const overlayContent = (
    <>
      {/* Dim overlay with cutout */}
      <div
        className="fixed inset-0 transition-opacity duration-300"
        style={{
          zIndex: DEMO_CONFIG.highlightZIndex,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          opacity: isVisible && targetRect ? 1 : 0,
          pointerEvents: isVisible && targetRect ? 'auto' : 'none',
        }}
        onClick={onDimClick}
      >
        {/* SVG mask to create cutout */}
        {targetRect && (
          <svg
            className="absolute inset-0 w-full h-full"
            style={{ pointerEvents: 'none' }}
          >
            <defs>
              <mask id="demo-highlight-mask">
                {/* White = visible (dimmed), Black = transparent (cutout) */}
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                <rect
                  x={targetRect.left - padding}
                  y={targetRect.top - padding}
                  width={targetRect.width + padding * 2}
                  height={targetRect.height + padding * 2}
                  rx="8"
                  ry="8"
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(0, 0, 0, 0.75)"
              mask="url(#demo-highlight-mask)"
            />
          </svg>
        )}
      </div>

      {/* Red glow ring around target */}
      {targetRect && isVisible && (
        <div
          className="fixed pointer-events-none transition-all duration-300"
          style={{
            zIndex: DEMO_CONFIG.highlightZIndex + 1,
            top: targetRect.top - padding,
            left: targetRect.left - padding,
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
            borderRadius: '8px',
            border: '2px solid #dc2626',
            boxShadow: `
              0 0 0 4px rgba(220, 38, 38, 0.3),
              0 0 20px rgba(220, 38, 38, 0.5),
              0 0 40px rgba(220, 38, 38, 0.3),
              inset 0 0 20px rgba(220, 38, 38, 0.1)
            `,
            animation: 'demo-pulse 2s ease-in-out infinite',
          }}
        />
      )}

      {/* Pulse animation style */}
      <style>{`
        @keyframes demo-pulse {
          0%, 100% {
            box-shadow:
              0 0 0 4px rgba(220, 38, 38, 0.3),
              0 0 20px rgba(220, 38, 38, 0.5),
              0 0 40px rgba(220, 38, 38, 0.3),
              inset 0 0 20px rgba(220, 38, 38, 0.1);
          }
          50% {
            box-shadow:
              0 0 0 6px rgba(220, 38, 38, 0.4),
              0 0 30px rgba(220, 38, 38, 0.6),
              0 0 60px rgba(220, 38, 38, 0.4),
              inset 0 0 30px rgba(220, 38, 38, 0.15);
          }
        }
      `}</style>
    </>
  );

  // Render in portal to ensure proper stacking
  return createPortal(overlayContent, document.body);
}

export default DemoHighlight;
