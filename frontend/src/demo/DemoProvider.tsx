// =============================================================================
// Demo Provider Context - TESTNET ONLY
// =============================================================================
// React context provider for demo state management.
// All demo code is isolated in src/demo/ and can be safely removed for mainnet.
// =============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DemoState, DemoContextValue, DemoStep } from './types';
import { STORY_SEQUENCES, TOTAL_SEQUENCES } from './StorySequences';
import { DEMO_ENABLED, DEMO_STATE_KEY, DEMO_FULL_STATE_KEY, DEMO_CONFIG } from './demoConfig';
import { requestDemoAuth, demoLogout } from './DemoRoleSwitcher';

/**
 * Initial demo state
 */
const INITIAL_STATE: DemoState = {
  isActive: false,
  currentStepIndex: 0,
  currentRole: null,
  workflowId: null,
  hasCompletedBefore: false,
  startedAt: null,
};

/**
 * Demo context
 */
const DemoContext = createContext<DemoContextValue | null>(null);

/**
 * Hook to access demo context
 * Returns null if demo mode is not enabled (safe to use anywhere)
 */
export function useDemoContext(): DemoContextValue | null {
  const context = useContext(DemoContext);
  
  // If demo is not enabled, always return null
  if (!DEMO_ENABLED) return null;
  
  return context;
}

/**
 * Hook that requires demo context (throws if not available)
 * Only use in components that are guaranteed to be inside DemoProvider
 */
export function useRequiredDemoContext(): DemoContextValue {
  const context = useContext(DemoContext);
  
  if (!context) {
    throw new Error('useRequiredDemoContext must be used within DemoProvider when DEMO_ENABLED is true');
  }
  
  return context;
}

/**
 * Load demo state from localStorage
 */
function loadDemoState(): DemoState {
  try {
    const stored = localStorage.getItem(DEMO_FULL_STATE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...INITIAL_STATE, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load demo state:', e);
  }
  return INITIAL_STATE;
}

/**
 * Save demo state to localStorage
 */
function saveDemoState(state: DemoState): void {
  try {
    localStorage.setItem(DEMO_FULL_STATE_KEY, JSON.stringify(state));
    localStorage.setItem(DEMO_STATE_KEY, state.isActive ? 'true' : 'false');
  } catch (e) {
    console.warn('Failed to save demo state:', e);
  }
}

/**
 * Clear demo state from localStorage
 */
function clearDemoState(): void {
  try {
    localStorage.removeItem(DEMO_FULL_STATE_KEY);
    localStorage.removeItem(DEMO_STATE_KEY);
  } catch (e) {
    console.warn('Failed to clear demo state:', e);
  }
}

interface DemoProviderProps {
  children: React.ReactNode;
}

/**
 * Demo Provider Component
 * Provides demo state and actions to the application
 */
export function DemoProvider({ children }: DemoProviderProps): React.ReactElement {
  const navigate = useNavigate();
  const [state, setState] = useState<DemoState>(() => loadDemoState());
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Current step based on index (convert StorySequence to legacy DemoStep format for compatibility)
  const currentStep = useMemo((): DemoStep | null => {
    if (!state.isActive) return null;
    const seq = STORY_SEQUENCES[state.currentStepIndex];
    if (!seq) return null;
    // Map StorySequence to DemoStep for backward compatibility
    return {
      id: seq.id as any,
      role: seq.role || null,
      title: seq.title,
      description: seq.narrative.join('\n\n'),
      showSkip: seq.showSkip,
      nextButtonText: seq.actionText,
      action: seq.action === 'click' ? 'wait-for-action' : seq.action === 'auto' ? 'navigate' : undefined,
      targetSelector: seq.targetSelector,
    };
  }, [state.isActive, state.currentStepIndex]);

  // Progress percentage
  const progress = useMemo(() => {
    if (!state.isActive) return 0;
    return Math.round((state.currentStepIndex / (TOTAL_SEQUENCES - 1)) * 100);
  }, [state.isActive, state.currentStepIndex]);

  // Is last step
  const isLastStep = useMemo(() => {
    return state.currentStepIndex >= TOTAL_SEQUENCES - 1;
  }, [state.currentStepIndex]);

  // Persist state changes
  useEffect(() => {
    saveDemoState(state);
  }, [state]);

  /**
   * Start the demo
   */
  const startDemo = useCallback(() => {
    setState({
      isActive: true,
      currentStepIndex: 0,
      currentRole: null,
      workflowId: null,
      hasCompletedBefore: state.hasCompletedBefore,
      startedAt: new Date().toISOString(),
    });
  }, [state.hasCompletedBefore]);

  /**
   * Exit demo mode completely
   */
  const exitDemo = useCallback(async () => {
    setIsTransitioning(true);
    
    try {
      // Logout current user
      await demoLogout();
      
      // Clear demo state
      setState({
        ...INITIAL_STATE,
        hasCompletedBefore: state.hasCompletedBefore || state.currentStepIndex >= TOTAL_SEQUENCES - 1,
      });
      clearDemoState();
      
      // Navigate to login
      navigate('/auth/login');
    } finally {
      setIsTransitioning(false);
    }
  }, [navigate, state.hasCompletedBefore, state.currentStepIndex]);

  /**
   * Skip the demo (same as exit but marks as seen)
   */
  const skipDemo = useCallback(async () => {
    setIsTransitioning(true);
    
    try {
      await demoLogout();
      
      setState({
        ...INITIAL_STATE,
        hasCompletedBefore: true,
      });
      clearDemoState();
      
      navigate('/auth/login');
    } finally {
      setIsTransitioning(false);
    }
  }, [navigate]);

  /**
   * Move to next step
   */
  const nextStep = useCallback(async () => {
    if (isTransitioning) return;
    
    const nextIndex = state.currentStepIndex + 1;
    
    // Check if demo is complete
    if (nextIndex >= TOTAL_SEQUENCES) {
      await exitDemo();
      return;
    }
    
    const nextSequence = STORY_SEQUENCES[nextIndex];
    setIsTransitioning(true);
    
    try {
      // Handle role transitions
      if (nextSequence.role && nextSequence.role !== state.currentRole) {
        // Wait a moment for UI to update
        await new Promise(resolve => setTimeout(resolve, DEMO_CONFIG.autoLoginDelay));
        
        // Perform demo login for new role
        await requestDemoAuth(nextSequence.role);
        
        // Update state with new role
        setState(prev => ({
          ...prev,
          currentStepIndex: nextIndex,
          currentRole: nextSequence.role ?? prev.currentRole,
        }));
      }
      // Handle auto actions (no user interaction needed)
      else if (nextSequence.action === 'auto') {
        // Auto-advance after a brief delay
        await new Promise(resolve => setTimeout(resolve, DEMO_CONFIG.navigationDelay));
        
        setState(prev => ({
          ...prev,
          currentStepIndex: nextIndex,
          currentRole: nextSequence.role ?? prev.currentRole,
        }));
      }
      // Default: just advance
      else {
        setState(prev => ({
          ...prev,
          currentStepIndex: nextIndex,
          currentRole: nextSequence.role ?? prev.currentRole,
        }));
      }
    } catch (error) {
      console.error('Demo step transition failed:', error);
      // Don't block on errors - allow user to retry or exit
    } finally {
      setIsTransitioning(false);
    }
  }, [state.currentStepIndex, isTransitioning, navigate, exitDemo]);

  /**
   * Set workflow ID for tracking across role transitions
   */
  const setWorkflowId = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      workflowId: id,
    }));
  }, []);

  // Context value
  const contextValue = useMemo<DemoContextValue>(() => ({
    state,
    currentStep,
    startDemo,
    exitDemo,
    nextStep,
    skipDemo,
    setWorkflowId,
    isLastStep,
    progress,
  }), [state, currentStep, startDemo, exitDemo, nextStep, skipDemo, setWorkflowId, isLastStep, progress]);

  return (
    <DemoContext.Provider value={contextValue}>
      {children}
    </DemoContext.Provider>
  );
}

/**
 * Wrapper component that only renders DemoProvider if DEMO_ENABLED
 * This ensures zero demo code executes when disabled
 */
export function ConditionalDemoProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  if (!DEMO_ENABLED) {
    // Return children directly - no demo provider, no demo context
    return <>{children}</>;
  }
  
  return <DemoProvider>{children}</DemoProvider>;
}

export { DEMO_ENABLED };
