/**
 * Narrative Lab - Scroll Narrative Section
 * Two-column layout with sticky dashboard and scrolling content
 * 
 * NOTE: This component is for the standalone /narrative-test route.
 * The main /landing page uses LandingPage.tsx which has its own implementation.
 */
import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { StickyDashboard } from './StickyDashboard';
import { ScrollSection, scrollSections, stateIcons } from './ScrollSection';
import type { WorkflowState } from './WorkflowDiagram';

export function ScrollNarrative() {
  const [activeState, setActiveState] = useState<WorkflowState>('DRAFT');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Query all sections with data-step attribute
    const sections = containerRef.current.querySelectorAll<HTMLElement>('[data-step]');
    if (sections.length === 0) return;

    // Handler for intersection changes
    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      let bestRatio = 0;
      let bestTarget: HTMLElement | null = null;

      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
          bestRatio = entry.intersectionRatio;
          bestTarget = entry.target as HTMLElement;
        }
      });

      if (bestTarget) {
        const step = (bestTarget as HTMLElement).dataset.step as WorkflowState | undefined;
        if (step) {
          setActiveState(step);
        }
      }
    };

    // Single observer with generous thresholds
    const observer = new IntersectionObserver(handleIntersection, {
      threshold: [0.1, 0.3, 0.5, 0.6],
      rootMargin: '-30% 0px -30% 0px',
    });

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  return (
    <section className="relative bg-black min-h-screen">
      {/* Section header */}
      <div className="relative pt-32 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-8"
          >
            <span className="text-xs text-red-400 font-mono tracking-widest uppercase mb-4 block">
              The Narrative of Trust
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              From Document to Immutable Proof
            </h2>
            <p className="text-white/40 max-w-2xl mx-auto">
              Watch how a private document transforms through enterprise workflow into a verifiable on-chain compliance proof.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Two-column layout - Flexbox with items-start */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row lg:items-start gap-8 lg:gap-16">
          {/* Sticky Left Column */}
          <div className="hidden lg:block lg:w-[520px] lg:flex-shrink-0">
            <div className="sticky top-24 h-[calc(100vh-6rem)]">
              <StickyDashboard activeState={activeState} />
            </div>
          </div>

          {/* Scrollable Right Column - grows naturally */}
          <div ref={containerRef} className="flex-1 min-w-0">
            {scrollSections.map((section) => (
              <ScrollSection
                key={section.state}
                state={section.state}
                isActive={activeState === section.state}
                title={section.title}
                description={section.description}
                details={section.details}
                icon={stateIcons[section.state]}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Dashboard (shown at bottom on mobile) */}
      <div className="lg:hidden px-6 py-8 sticky bottom-4">
        <StickyDashboard activeState={activeState} />
      </div>
    </section>
  );
}
