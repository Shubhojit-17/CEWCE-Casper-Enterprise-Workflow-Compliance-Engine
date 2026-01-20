/**
 * CEWCE Landing Page - Main Entry
 * 
 * This is the production landing page with scroll-driven narrative UX.
 * 
 * Features:
 * - Fixed header with auth navigation
 * - Hero section
 * - Scroll-driven "Narrative of Trust" experience
 * - Two-column layout with sticky dashboard (properly scoped)
 * - Compliance proof explainer
 * - Verification simulator
 * - CTA section
 */
import { useRef, useEffect, useState, createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { WorkflowState } from './narrative-lab/components/WorkflowDiagram';

// Import all components
import { 
  HeroSection, 
  ComplianceExplainer, 
  VerificationSimulator,
  OnChainExplainer, 
  Footer,
  scrollSections,
  stateIcons,
} from './narrative-lab/components';
import { WorkflowDiagram } from './narrative-lab/components/WorkflowDiagram';
import { DocumentVault } from './narrative-lab/components/DocumentVault';
import { ProofBadge } from './narrative-lab/components/ProofBadge';
import { CasperStatusBar } from './narrative-lab/components/CasperStatusBar';
import { ReviewerAvatars } from './narrative-lab/components/ReviewerAvatars';

// ============================================================================
// CONTEXT - Single source of truth for active step
// ============================================================================
const NarrativeContext = createContext<{
  activeStep: WorkflowState;
  setActiveStep: (step: WorkflowState) => void;
}>({
  activeStep: 'DRAFT',
  setActiveStep: () => {},
});

// ============================================================================
// HEADER - Fixed with auth navigation wired
// ============================================================================
function LandingHeader() {
  const navigate = useNavigate();

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

        {/* Navigation Buttons - WIRED TO REAL ROUTES */}
        <div className="flex items-center gap-4">
          <button
            className="px-4 py-2 text-sm text-cyan-400/80 hover:text-cyan-400 transition-colors duration-200 font-medium hidden sm:block"
            onClick={() => navigate('/architecture-of-trust')}
          >
            How It Works
          </button>
          <button
            className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors duration-200 font-medium"
            onClick={() => navigate('/auth/login')}
          >
            Log in
          </button>
          <button
            className="px-5 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors duration-200 shadow-lg shadow-red-600/20"
            onClick={() => navigate('/auth/register')}
          >
            Sign up
          </button>
        </div>
      </div>
    </motion.header>
  );
}

// ============================================================================
// STICKY VISUAL - The "Digital Twin" that stays fixed during scroll
// ============================================================================
function StickyVisual() {
  const { activeStep } = useContext(NarrativeContext);

  return (
    <motion.div
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className="w-full"
    >
        {/* Glassmorphism Container - NO overflow-hidden here */}
        <div className="relative p-6 rounded-2xl">
          {/* Glass background */}
          <div className="absolute inset-0 bg-white/[0.03] backdrop-blur-xl rounded-2xl pointer-events-none" />
          <div className="absolute inset-0 border border-white/10 rounded-2xl pointer-events-none" />
          
          {/* Gradient accent */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Content */}
          <div className="relative z-10 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <h3 className="text-lg font-semibold text-white">Workflow Monitor</h3>
                <p className="text-xs text-white/40">Real-time compliance tracking</p>
              </div>
              <StepIndicator step={activeStep} />
            </div>

            {/* Workflow Diagram */}
            <div className="py-4">
              <WorkflowDiagram activeState={activeStep} />
            </div>

            {/* Grid layout for components */}
            <div className="grid grid-cols-2 gap-4">
              {/* Document Vault */}
              <div className="col-span-2">
                <DocumentVault activeState={activeStep} />
              </div>

              {/* Reviewers */}
              <div className="col-span-2">
                <ReviewerAvatars activeState={activeStep} />
              </div>

              {/* Proof Badge */}
              <div className="col-span-1">
                <ProofBadge activeState={activeStep} />
              </div>

              {/* Casper Status */}
              <div className="col-span-1">
                <div className="space-y-3">
                  <span className="text-xs text-white/50 uppercase tracking-wider">
                    Network Status
                  </span>
                  <CasperStatusBar activeState={activeStep} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
  );
}

function StepIndicator({ step }: { step: WorkflowState }) {
  const stepColors: Record<WorkflowState, string> = {
    DRAFT: 'bg-slate-500',
    CONFIRM: 'bg-blue-500',
    DOCUMENTS: 'bg-amber-500',
    REVIEW: 'bg-purple-500',
    APPROVED: 'bg-green-500',
    ANCHOR: 'bg-red-500',  // Casper red for on-chain
  };

  return (
    <motion.div
      key={step}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10"
    >
      <motion.div
        className={`w-2 h-2 rounded-full ${stepColors[step]}`}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      <span className="text-xs font-medium text-white/70">{step}</span>
    </motion.div>
  );
}

// ============================================================================
// NARRATIVE STEP - Individual scroll section with data-step attribute
// ============================================================================
interface NarrativeStepProps {
  step: WorkflowState;
  title: string;
  description: string;
  details: string[];
  icon: React.ReactNode;
  isActive: boolean;
}

function NarrativeStep({ step, title, description, details, icon, isActive }: NarrativeStepProps) {
  return (
    <section
      data-step={step}
      className="min-h-screen flex items-start pt-24 pb-32"
    >
      <motion.div
        className="max-w-lg"
        animate={{ opacity: isActive ? 1 : 0.2 }}
        transition={{ duration: 0.4 }}
      >
        {/* State badge */}
        <motion.div
          className={`
            inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6
            ${isActive ? 'bg-red-500/20 border border-red-500/30' : 'bg-white/5 border border-white/10'}
          `}
        >
          <span className={`text-xs font-mono ${isActive ? 'text-red-400' : 'text-white/40'}`}>
            {step}
          </span>
        </motion.div>

        {/* Icon */}
        <motion.div
          className={`
            w-16 h-16 rounded-2xl flex items-center justify-center mb-6
            ${isActive ? 'bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/20' : 'bg-white/5 border border-white/10'}
          `}
          animate={isActive ? { y: [0, -5, 0] } : { y: 0 }}
          transition={{ duration: 3, repeat: isActive ? Infinity : 0, ease: 'easeInOut' }}
        >
          <div className={isActive ? 'text-red-400' : 'text-white/30'}>
            {icon}
          </div>
        </motion.div>

        {/* Title */}
        <h2 className={`text-4xl font-bold mb-4 transition-colors duration-300 ${isActive ? 'text-white' : 'text-white/50'}`}>
          {title}
        </h2>

        {/* Description */}
        <p className={`text-lg leading-relaxed mb-6 transition-colors duration-300 ${isActive ? 'text-white/70' : 'text-white/30'}`}>
          {description}
        </p>

        {/* Details list */}
        <ul className="space-y-3">
          {details.map((detail, idx) => (
            <li
              key={idx}
              className="flex items-start gap-3"
            >
              <div className={`
                w-1.5 h-1.5 rounded-full mt-2 transition-colors duration-300
                ${isActive ? 'bg-red-400' : 'bg-white/20'}
              `} />
              <span className={`text-sm transition-colors duration-300 ${isActive ? 'text-white/60' : 'text-white/20'}`}>
                {detail}
              </span>
            </li>
          ))}
        </ul>
      </motion.div>
    </section>
  );
}

// ============================================================================
// NARRATIVE STEPS CONTAINER - All steps in a single scrollable column
// ============================================================================
function NarrativeSteps() {
  const { activeStep, setActiveStep } = useContext(NarrativeContext);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Query all sections with data-step attribute directly
    const sections = containerRef.current.querySelectorAll<HTMLElement>('[data-step]');
    if (sections.length === 0) return;

    // Handler function to process intersection entries
    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      // Find the entry with highest intersection ratio that is entering
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
          setActiveStep(step);
        }
      }
    };

    // Single IntersectionObserver with generous rootMargin for reliable triggering
    const observer = new IntersectionObserver(handleIntersection, {
      threshold: [0.1, 0.3, 0.5, 0.6],
      // Shrink viewport detection zone to center 40% of screen
      rootMargin: '-30% 0px -30% 0px',
    });

    // Observe all section elements
    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, [setActiveStep]);

  return (
    <div ref={containerRef}>
      {scrollSections.map((section) => (
        <NarrativeStep
          key={section.state}
          step={section.state}
          title={section.title}
          description={section.description}
          details={section.details}
          icon={stateIcons[section.state]}
          isActive={activeStep === section.state}
        />
      ))}
    </div>
  );
}

// ============================================================================
// NARRATIVE WRAPPER - Two-column layout with proper sticky context
// ============================================================================
function NarrativeWrapper() {
  return (
    <section className="relative bg-black">
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

      {/* 
        TWO-COLUMN LAYOUT - Critical architecture:
        - Uses flexbox with items-start (NOT items-center) to prevent clipping
        - No overflow properties on parents
        - Sticky element is direct child of flex container
      */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row lg:items-start gap-8 lg:gap-16">
          {/* LEFT COLUMN - Sticky Visual */}
          {/* sticky + self-start: sticks to top, height defined by content, persists for entire parent height */}
          <div className="hidden lg:block lg:w-[520px] lg:flex-shrink-0 lg:sticky lg:top-24 lg:self-start">
            <StickyVisual />
          </div>

          {/* RIGHT COLUMN - Scrollable Narrative Steps */}
          {/* This column drives the height of the flex parent, allowing sticky to persist */}
          <div className="flex-1 min-w-0">
            <NarrativeSteps />
          </div>
        </div>
      </div>

      {/* Mobile: Show dashboard at bottom (simplified) */}
      <div className="lg:hidden px-6 py-8">
        <MobileDashboard />
      </div>
    </section>
  );
}

// ============================================================================
// MOBILE DASHBOARD - Simplified version for mobile
// ============================================================================
function MobileDashboard() {
  const { activeStep } = useContext(NarrativeContext);

  return (
    <div className="sticky bottom-4 z-40">
      <div className="relative p-4 rounded-xl bg-black/80 backdrop-blur-xl border border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StepIndicator step={activeStep} />
            <span className="text-sm text-white/60">Workflow Monitor</span>
          </div>
          <CasperStatusBar activeState={activeStep} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN LANDING PAGE - Combines all sections
// ============================================================================
export function LandingPage() {
  const [activeStep, setActiveStep] = useState<WorkflowState>('DRAFT');

  return (
    <NarrativeContext.Provider value={{ activeStep, setActiveStep }}>
      {/* 
        CRITICAL: No overflow-hidden or overflow-auto on this container.
        Only the document body should scroll.
      */}
      <div className="min-h-screen bg-black text-white">
        {/* Fixed Header with auth navigation */}
        <LandingHeader />

        {/* Main Content - single continuous scroll */}
        <main>
          {/* Hero Section */}
          <HeroSection />

          {/* Narrative Section - sticky + scroll architecture */}
          <NarrativeWrapper />

          {/* Compliance Proof Explainer */}
          <ComplianceExplainer />

          {/* Verification Simulator */}
          <VerificationSimulator />

          {/* On-Chain Explainer: What is stored on Casper */}
          <OnChainExplainer />
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </NarrativeContext.Provider>
  );
}

export default LandingPage;
