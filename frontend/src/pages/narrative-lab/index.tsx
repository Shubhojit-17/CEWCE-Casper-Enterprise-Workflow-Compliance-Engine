/**
 * CEWCE Narrative Lab - Landing Page Prototype
 * 
 * This is a TEST / PROTOTYPE VERSION ONLY.
 * Purpose: Validate scroll-driven narrative UX and animations.
 * 
 * Features:
 * - Scroll-driven "Narrative of Trust" experience
 * - Two-column layout with sticky dashboard
 * - 5 scroll states: INITIATE, UPLOAD, REVIEW, FINALIZE, ANCHOR
 * - Mock verification simulator
 * - No backend connections, no auth, no blockchain interaction
 * 
 * Route: /narrative-test
 */
import { FixedBackground, Header, HeroSection, ScrollNarrative, ComplianceExplainer, VerificationSimulator, CTASection, Footer } from './components';

export function NarrativeLabPage() {
  return (
    <div className="min-h-screen bg-transparent text-white overflow-x-hidden relative">
      {/* Fixed Animated Background - stays constant during scroll */}
      <FixedBackground />
      
      {/* Fixed Header */}
      <Header />

      {/* Main Content - z-index above background */}
      <main className="relative z-[1]">
        {/* Hero Section - Minimal */}
        <HeroSection />

        {/* Core Scroll Narrative - Two Column Layout */}
        <ScrollNarrative />

        {/* Compliance Proof Explainer */}
        <ComplianceExplainer />

        {/* Verification Simulator */}
        <VerificationSimulator />

        {/* Final CTA Section */}
        <CTASection />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default NarrativeLabPage;
