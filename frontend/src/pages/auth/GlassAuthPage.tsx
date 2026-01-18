// =============================================================================
// Split-Prism Auth Page - Mechanical HUD Design
// Left: Digital Shard Narrative | Right: Glass Terminal Auth Form
// =============================================================================

import { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';

// =============================================================================
// HUD Animation Variants - Signal Stutter Effect
// =============================================================================
const hudVariants = {
  hidden: { 
    opacity: 0, 
    scaleY: 0, 
    filter: 'brightness(2) blur(10px)' 
  },
  visible: { 
    opacity: [0, 1, 0.5, 1, 0.8, 1],
    scaleY: 1,
    filter: 'brightness(1) blur(0px)',
    transition: { 
      duration: 0.4, 
      times: [0, 0.1, 0.2, 0.3, 0.4, 1], 
      ease: 'easeOut' as const
    }
  },
  exit: { 
    scaleY: 0, 
    opacity: 0, 
    transition: { duration: 0.2 } 
  }
};
import { 
  EyeIcon, 
  EyeSlashIcon, 
  BeakerIcon,
  DocumentCheckIcon,
  BoltIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../../stores/auth';
import { useWalletStore } from '../../stores/wallet';
import { api } from '../../lib/api';
import { ParticleBackground } from '../../components/auth/ParticleBackground';
import { DEMO_ENABLED, useDemoContext } from '../../demo';

// Debug: Log DEMO_ENABLED value on module load
console.log('[GlassAuthPage] Module loaded - DEMO_ENABLED:', DEMO_ENABLED, 'Raw env:', import.meta.env.VITE_DEMO_MODE);

// =============================================================================
// Types
// =============================================================================

interface LoginForm {
  email: string;
  password: string;
}

interface RegisterForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

type AuthTab = 'login' | 'signup';

// =============================================================================
// Simulated Network Activity Messages
// =============================================================================
const NETWORK_MESSAGES = [
  'New Compliance Proof Anchored...',
  'Workflow Approved on Casper',
  'Verification Complete',
  'Document Hash Stored',
  'Multi-Sig Threshold Met',
  'Audit Trail Updated',
  'Smart Contract Executed',
  'Proof-of-Integrity Verified',
];

// =============================================================================
// DecryptionText Component - Hash-to-Text Reveal Effect
// =============================================================================

interface DecryptionTextProps {
  text: string;
  delay?: number;
  duration?: number;
  className?: string;
}

const HEX_CHARS = '0123456789ABCDEF';

function DecryptionText({ text, delay = 0, duration = 600, className = '' }: DecryptionTextProps) {
  const [displayText, setDisplayText] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [hasDecrypted, setHasDecrypted] = useState(false);

  useEffect(() => {
    // Initial delay before starting
    const startTimeout = setTimeout(() => {
      setIsDecrypting(true);
      
      // Create initial scrambled text
      const scrambled = text.split('').map(char => 
        char === ' ' ? ' ' : HEX_CHARS[Math.floor(Math.random() * HEX_CHARS.length)]
      ).join('');
      setDisplayText(scrambled);
      
      // Calculate timing for character-by-character reveal
      const charDuration = duration / text.length;
      let currentIndex = 0;
      
      // Scramble interval during decryption
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
      
      // Character reveal interval
      const revealInterval = setInterval(() => {
        if (currentIndex >= text.length) {
          clearInterval(revealInterval);
          clearInterval(scrambleInterval);
          setDisplayText(text);
          setIsDecrypting(false);
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
  }, [text, delay, duration]);

  return (
    <span 
      className={`font-mono ${className}`}
      style={{
        color: hasDecrypted ? '#ffffff' : '#ef4444',
        textShadow: isDecrypting 
          ? '0 0 10px rgba(239, 68, 68, 0.8), 0 0 20px rgba(239, 68, 68, 0.4)' 
          : hasDecrypted 
            ? '0 0 20px rgba(255, 255, 255, 0.25)' 
            : 'none',
        transition: 'color 0.3s ease, text-shadow 0.3s ease',
      }}
    >
      {displayText || text.split('').map(c => c === ' ' ? ' ' : '█').join('')}
    </span>
  );
}

// =============================================================================
// Glassmorphism Auth Page Component
// =============================================================================

export function GlassAuthPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AuthTab>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [isWalletLoading, setIsWalletLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const { login, register: registerUser } = useAuthStore();
  const { connect, publicKey, isConnected, disconnect } = useWalletStore();

  // Login form
  const loginForm = useForm<LoginForm>();
  // Register form
  const registerForm = useForm<RegisterForm>();

  const password = registerForm.watch('password');

  // Clear error when switching tabs
  const handleTabChange = (tab: AuthTab) => {
    setAuthError(null);
    setActiveTab(tab);
  };

  // =============================================================================
  // Login Handler
  // =============================================================================
  const onLoginSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      await login(data.email, data.password);
      toast.success('Welcome back!');
    } catch (error) {
      console.error('Login failed:', error);
      // Extract error message from response
      const err = error as { response?: { data?: { error?: { message?: string }; message?: string } } };
      const errorMessage = err.response?.data?.error?.message || 
                          err.response?.data?.message || 
                          'Invalid email or password. Please try again.';
      setAuthError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // =============================================================================
  // Register Handler
  // =============================================================================
  const onRegisterSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      await registerUser({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
      });
      toast.success('Account created successfully!');
    } catch (error) {
      console.error('Registration failed:', error);
      const err = error as { response?: { data?: { error?: { message?: string }; message?: string } } };
      const errorMessage = err.response?.data?.error?.message || 
                          err.response?.data?.message || 
                          'Registration failed. Please try again.';
      setAuthError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // =============================================================================
  // Wallet Sign-In Handler
  // =============================================================================
  const handleWalletSignIn = useCallback(async () => {
    setIsWalletLoading(true);
    try {
      let walletPublicKey = publicKey;
      if (!isConnected || !publicKey) {
        await connect();
        walletPublicKey = useWalletStore.getState().publicKey;
        if (!walletPublicKey) {
          toast.error('Failed to connect wallet. Please try again.');
          return;
        }
      }

      const nonceResponse = await api.post<{
        success: boolean;
        data: { nonce: string; message: string; expiresAt: string };
      }>('/auth/nonce', { publicKey: walletPublicKey });

      const { nonce, message } = nonceResponse.data.data;
      const walletStore = useWalletStore.getState();
      const signature = await walletStore.signMessage(message);

      if (!signature) {
        toast.error('Signature cancelled or failed');
        return;
      }

      const verifyResponse = await api.post<{
        success: boolean;
        data: {
          token: string;
          user: {
            id: string;
            publicKey: string;
            accountHash: string;
            roles: string[];
            createdAt: string;
          };
        };
      }>('/auth/verify', {
        publicKey: walletPublicKey,
        signature,
        nonce,
      });

      const { token, user } = verifyResponse.data.data;
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      useAuthStore.setState({
        token,
        user: {
          id: user.id,
          email: '',
          publicKey: user.publicKey,
          accountHash: user.accountHash,
          firstName: '',
          lastName: '',
          avatar: '',
          isActive: true,
          emailVerified: false,
          createdAt: user.createdAt,
          updatedAt: user.createdAt,
          lastLoginAt: new Date().toISOString(),
          roles: user.roles,
        },
        isAuthenticated: true,
        isLoading: false,
      });

      toast.success('Signed in with Casper Wallet!');
      setTimeout(() => {
        useWalletStore.getState().fetchBalance();
      }, 100);
      navigate('/app/dashboard');
    } catch (error) {
      console.error('Wallet sign-in failed:', error);
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Wallet sign-in failed. Please try again.');
      disconnect();
    } finally {
      setIsWalletLoading(false);
    }
  }, [connect, disconnect, isConnected, navigate, publicKey]);

  // =============================================================================
  // Render - Split-Prism Two-Column Layout
  // =============================================================================
  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0A0A0B]">
      {/* === Layer 1: Atmospheric Drifting Blobs (Full Viewport) === */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Deep red blob - top right, drifting */}
        <motion.div
          animate={{ 
            x: [0, 30, -20, 0],
            y: [0, -20, 10, 0],
          }}
          transition={{ 
            duration: 20, 
            repeat: Infinity, 
            ease: 'easeInOut' 
          }}
          className="absolute w-[700px] h-[700px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, #8b0000 0%, transparent 70%)',
            filter: 'blur(120px)',
            top: '-15%',
            right: '-10%',
          }}
        />
        {/* Slate/purple blob - bottom left, drifting */}
        <motion.div
          animate={{ 
            x: [0, -25, 15, 0],
            y: [0, 25, -15, 0],
          }}
          transition={{ 
            duration: 25, 
            repeat: Infinity, 
            ease: 'easeInOut' 
          }}
          className="absolute w-[600px] h-[600px] rounded-full opacity-25"
          style={{
            background: 'radial-gradient(circle, #1e293b 0%, transparent 70%)',
            filter: 'blur(140px)',
            bottom: '-20%',
            left: '-15%',
          }}
        />
        {/* Red accent - center left */}
        <motion.div
          animate={{ 
            scale: [1, 1.1, 0.95, 1],
          }}
          transition={{ 
            duration: 15, 
            repeat: Infinity, 
            ease: 'easeInOut' 
          }}
          className="absolute w-[400px] h-[400px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, #660000 0%, transparent 70%)',
            filter: 'blur(100px)',
            top: '40%',
            left: '25%',
          }}
        />
      </div>

      {/* === Layer 2: Noise Texture Overlay === */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* === Layer 3: Particle Constellation (Full Page) === */}
      <ParticleBackground />

      {/* === Main Split-Prism Layout === */}
      <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">
        
        {/* === LEFT COLUMN: Engine Core Narrative (40%) === */}
        <div 
          className="hidden lg:flex lg:w-[40%] xl:w-[42%] flex-col items-center justify-center px-8 xl:px-16 py-20 relative"
          style={{
            perspective: '1200px',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Column Red Ambient Light */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 80% 60% at 30% 50%, rgba(220, 38, 38, 0.12), transparent 70%)',
            }}
          />
          
          {/* Digital Shard Column Wrapper - 3D Tilted */}
          <NarrativeBox delay={100}>
            <div className="max-w-md w-full space-y-8">
              
              {/* Section Title */}
              <div className="text-center mb-2">
                <motion.h2 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="text-xs uppercase tracking-[0.3em] text-slate-500 mb-1"
                >
                  <DecryptionText text="COMPLIANCE ENGINE" delay={500} duration={500} />
                </motion.h2>
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                  className="h-px mx-auto max-w-[120px]"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(220, 38, 38, 0.6), transparent)',
                  }}
                />
              </div>
              
              {/* Floating 3D Glass Engine Core */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="relative"
                style={{ perspective: '1200px' }}
              >
                <GlassEngineCore />
              </motion.div>

              {/* Glowing Value Propositions */}
              <div className="space-y-4 pt-2">
                <TrustIndicator 
                  icon={<DocumentCheckIcon className="w-5 h-5" />}
                  text="Immutable Audit Trails"
                  delay={0.4}
                />
                <TrustIndicator 
                  icon={<BoltIcon className="w-5 h-5" />}
                  text="Off-Chain Efficiency"
                  delay={0.55}
                />
                <TrustIndicator 
                  icon={<LinkIcon className="w-5 h-5" />}
                  text="On-Chain Finality"
                  delay={0.7}
                />
              </div>

              {/* Real-Time Network Pulse Widget */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.85 }}
              >
                <NetworkPulseWidget />
              </motion.div>
            </div>
          </NarrativeBox>
        </div>

        {/* === RIGHT COLUMN: Glass Terminal Auth Form (60%) === */}
        <div className="flex-1 lg:w-[60%] xl:w-[58%] flex items-center justify-center px-4 sm:px-8 py-20 lg:py-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="relative w-full max-w-md lg:max-w-lg"
          >
            {/* === Glass Terminal Container with Enhanced HUD Styling === */}
            <div
              className="relative overflow-hidden"
              style={{
                clipPath: 'polygon(0 16px, 16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px))',
                background: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
                boxShadow: `
                  0 30px 60px -15px rgba(0, 0, 0, 0.7),
                  0 25px 50px -12px rgba(255, 50, 50, 0.2),
                  inset 0 1px 0 0 rgba(255, 255, 255, 0.1)
                `,
              }}
            >
              {/* Rim Light Gradient Border Overlay */}
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, transparent 40%, rgba(255, 3, 3, 0.15) 100%)',
                  clipPath: 'polygon(0 16px, 16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px))',
                }}
              />
              
              {/* HUD L-Shaped Brackets */}
              <div className="absolute top-0 left-0 w-8 h-8 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-red-500 to-transparent" />
                <div className="absolute top-0 left-0 w-[2px] h-full bg-gradient-to-b from-red-500 to-transparent" />
              </div>
              <div className="absolute top-0 right-0 w-8 h-8 pointer-events-none">
                <div className="absolute top-0 right-0 w-full h-[2px] bg-gradient-to-l from-red-500 to-transparent" />
                <div className="absolute top-0 right-0 w-[2px] h-full bg-gradient-to-b from-red-500 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 w-8 h-8 pointer-events-none">
                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-red-500 to-transparent" />
                <div className="absolute bottom-0 left-0 w-[2px] h-full bg-gradient-to-t from-red-500 to-transparent" />
              </div>
              <div className="absolute bottom-0 right-0 w-8 h-8 pointer-events-none">
                <div className="absolute bottom-0 right-0 w-full h-[2px] bg-gradient-to-l from-red-500 to-transparent" />
                <div className="absolute bottom-0 right-0 w-[2px] h-full bg-gradient-to-t from-red-500 to-transparent" />
              </div>

              {/* Top-Left Rim Light */}
              <div
                className="absolute top-0 left-0 w-40 h-40 pointer-events-none"
                style={{
                  background: 'radial-gradient(circle at top left, rgba(255, 255, 255, 0.1), transparent 60%)',
                }}
              />

              {/* Bottom Red Glow */}
              <div
                className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none"
                style={{
                  background: 'linear-gradient(to top, rgba(220, 38, 38, 0.15), transparent)',
                }}
              />
              
              {/* Scan Line Animation */}
              <motion.div
                animate={{
                  top: ['0%', '100%', '0%'],
                }}
                transition={{
                  duration: 12,
                  repeat: Infinity,
                  ease: 'linear',
                }}
                className="absolute left-0 right-0 h-px pointer-events-none z-50"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(220, 38, 38, 0.3), transparent)',
                }}
              />

              <div className="relative p-8 sm:p-10 lg:p-12">
                {/* === Header === */}
                <div className="text-center mb-8">
                  {/* Small Logo with HUD styling */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="mx-auto w-14 h-14 bg-gradient-to-br from-red-500/25 to-red-900/25 border border-red-500/30 flex items-center justify-center mb-5"
                    style={{
                      boxShadow: '0 0 35px rgba(220, 38, 38, 0.35)',
                      clipPath: 'polygon(0 6px, 6px 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px))',
                    }}
                  >
                    <svg
                      className="h-7 w-7 text-red-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      style={{ filter: 'drop-shadow(0 0 8px rgba(220, 38, 38, 0.8))' }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </motion.div>

                  {/* Title with Gradient and Decryption Effect */}
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-wider uppercase">
                    <span className="bg-gradient-to-r from-red-400 via-red-300 to-white bg-clip-text text-transparent">
                      <DecryptionText text="Access The Engine" delay={300} duration={600} className="!font-bold" />
                    </span>
                  </h1>
                </div>

                {/* === Tab Switcher === */}
                <div className="relative flex justify-center gap-10 mb-8">
                  {(['login', 'signup'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => handleTabChange(tab)}
                      className="relative py-2 text-sm font-semibold uppercase tracking-[0.2em] transition-colors duration-300"
                      style={{
                        color: activeTab === tab ? '#ffffff' : '#64748b',
                        textShadow: activeTab === tab ? '0 0 20px rgba(255, 100, 100, 0.4)' : 'none',
                      }}
                    >
                      [ {tab === 'login' ? 'Log In' : 'Sign Up'} ]
                      {activeTab === tab && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full"
                          style={{
                            background: 'linear-gradient(90deg, transparent, #dc2626, transparent)',
                            boxShadow: '0 0 15px rgba(220, 38, 38, 0.8)',
                          }}
                        />
                      )}
                    </button>
                  ))}
                </div>

                {/* === Error Alert === */}
                <AnimatePresence>
                  {authError && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -10, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10"
                    >
                      <div className="flex items-start gap-3">
                        <svg
                          className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-400">Authentication Failed</p>
                          <p className="text-sm text-red-400/80 mt-1">{authError}</p>
                        </div>
                        <button
                          onClick={() => setAuthError(null)}
                          className="text-red-400/60 hover:text-red-400 transition-colors"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* === Form Content with Animation === */}
                <AnimatePresence mode="wait">
                  {activeTab === 'login' ? (
                    <motion.div
                      key="login"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <LoginForm
                        form={loginForm}
                        onSubmit={onLoginSubmit}
                        isLoading={isLoading}
                        showPassword={showPassword}
                        setShowPassword={setShowPassword}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="signup"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <SignupForm
                        form={registerForm}
                        onSubmit={onRegisterSubmit}
                        isLoading={isLoading}
                        showPassword={showPassword}
                        setShowPassword={setShowPassword}
                        showConfirmPassword={showConfirmPassword}
                        setShowConfirmPassword={setShowConfirmPassword}
                        password={password}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* === Divider === */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 text-slate-500 bg-transparent text-xs uppercase tracking-wider">
                      Or continue with
                    </span>
                  </div>
                </div>

                {/* === Wallet Sign-In === */}
                <WalletButton
                  isLoading={isWalletLoading}
                  onClick={handleWalletSignIn}
                />

                {/* === Demo Mode Button (TESTNET ONLY) === */}
                {DEMO_ENABLED && <DemoButton />}

                {/* === Footer Links === */}
                <div className="mt-6 text-center">
                  <Link
                    to="/auth/forgot-password"
                    className="text-sm text-slate-500 hover:text-red-400 transition-colors"
                  >
                    Forgot your password?
                  </Link>
                </div>
              </div>
            </div>

            {/* === Bottom Text === */}
            <p className="mt-6 text-center text-xs text-slate-600">
              Secured by Casper Network
            </p>
          </motion.div>
        </div>
      </div>

      {/* === Mobile: Trust Indicators at Bottom === */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 px-4 py-3 bg-black/80 backdrop-blur-xl border-t border-white/5">
        <div className="flex justify-center gap-6 text-xs">
          <span className="flex items-center gap-1.5 text-slate-400">
            <DocumentCheckIcon className="w-3.5 h-3.5 text-red-500" />
            Immutable
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <BoltIcon className="w-3.5 h-3.5 text-red-500" />
            Efficient
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <LinkIcon className="w-3.5 h-3.5 text-red-500" />
            On-Chain
          </span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Glass Engine Core Component (3D Rotating Prism with Mouse Tracking)
// =============================================================================

function GlassEngineCore() {
  // Mouse tracking for 3D tilt effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  // Spring physics for smooth tilt
  const springConfig = { stiffness: 150, damping: 15, mass: 0.1 };
  const rotateX = useSpring(useTransform(mouseY, [-100, 100], [15, -15]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-100, 100], [-15, 15]), springConfig);
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    mouseX.set(e.clientX - centerX);
    mouseY.set(e.clientY - centerY);
  };
  
  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <div 
      className="relative mx-auto w-56 h-56 xl:w-64 xl:h-64" 
      style={{ perspective: '1200px' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Deep Ambient Glow */}
      <motion.div 
        animate={{ 
          opacity: [0.4, 0.65, 0.4],
          scale: [1, 1.08, 1],
        }}
        transition={{ 
          duration: 4, 
          repeat: Infinity, 
          ease: 'easeInOut' 
        }}
        className="absolute inset-0 rounded-3xl"
        style={{
          background: 'radial-gradient(circle at center, rgba(220, 38, 38, 0.4), transparent 60%)',
          filter: 'blur(45px)',
        }}
      />
      
      {/* 3D Glass Cube Container with Mouse Tracking */}
      <motion.div
        style={{ 
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
        className="absolute inset-0"
      >
        {/* Auto-Rotating Inner Container */}
        <motion.div
          animate={{ 
            rotateY: [0, 360],
          }}
          transition={{ 
            duration: 25, 
            repeat: Infinity, 
            ease: 'linear' 
          }}
          style={{ 
            transformStyle: 'preserve-3d',
          }}
          className="absolute inset-0"
        >
          {/* Main Glass Cube with Float Animation */}
          <motion.div
            animate={{ 
              y: [0, -15, 0],
            }}
            transition={{ 
              duration: 6, 
              repeat: Infinity, 
              ease: 'easeInOut' 
            }}
            className="absolute inset-4"
            style={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.03) 50%, rgba(255, 255, 255, 0.08) 100%)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: `
                0 25px 50px -12px rgba(0, 0, 0, 0.6),
                inset 0 0 60px rgba(220, 38, 38, 0.2),
                inset 0 2px 0 rgba(255, 255, 255, 0.15),
                inset 0 -2px 0 rgba(0, 0, 0, 0.3)
              `,
              transformStyle: 'preserve-3d',
              clipPath: 'polygon(0 12px, 12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px))',
            }}
          >
            {/* HUD L-Brackets */}
            <div className="absolute top-0 left-0 w-6 h-6 pointer-events-none">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-red-500 to-transparent" />
              <div className="absolute top-0 left-0 w-[2px] h-full bg-gradient-to-b from-red-500 to-transparent" />
            </div>
            <div className="absolute top-0 right-0 w-6 h-6 pointer-events-none">
              <div className="absolute top-0 right-0 w-full h-[2px] bg-gradient-to-l from-red-500 to-transparent" />
              <div className="absolute top-0 right-0 w-[2px] h-full bg-gradient-to-b from-red-500 to-transparent" />
            </div>
            <div className="absolute bottom-0 left-0 w-6 h-6 pointer-events-none">
              <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-red-500 to-transparent" />
              <div className="absolute bottom-0 left-0 w-[2px] h-full bg-gradient-to-t from-red-500 to-transparent" />
            </div>
            <div className="absolute bottom-0 right-0 w-6 h-6 pointer-events-none">
              <div className="absolute bottom-0 right-0 w-full h-[2px] bg-gradient-to-l from-red-500 to-transparent" />
              <div className="absolute bottom-0 right-0 w-[2px] h-full bg-gradient-to-t from-red-500 to-transparent" />
            </div>
            
            {/* Inner Red Glow */}
            <div 
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(circle at 30% 30%, rgba(220, 38, 38, 0.25), transparent 60%)',
                clipPath: 'polygon(0 12px, 12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px))',
              }}
            />

            {/* Volumetric Blurred Glow Behind Logo - Creates depth */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              animate={{
                opacity: [0.6, 0.9, 0.6],
                scale: [1, 1.15, 1],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <div 
                className="w-32 h-32 xl:w-36 xl:h-36 rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgba(220, 38, 38, 0.6) 0%, rgba(220, 38, 38, 0.3) 40%, transparent 70%)',
                  filter: 'blur(25px)',
                }}
              />
            </motion.div>

            {/* Holographic Casper Logo - Floats forward with parallax */}
            <div 
              className="absolute inset-0 flex items-center justify-center"
              style={{ transform: 'translateZ(20px)' }}
            >
              <motion.div
                animate={{ 
                  scale: [1, 1.1, 1],
                  y: [0, -5, 0],
                }}
                transition={{ 
                  duration: 3, 
                  repeat: Infinity, 
                  ease: 'easeInOut' 
                }}
                className="relative"
                style={{
                  filter: 'drop-shadow(0 0 30px rgba(220, 38, 38, 1)) drop-shadow(0 0 60px rgba(220, 38, 38, 0.6))',
                }}
              >
                {/* Glowing "C" Logo with HUD styling - Volumetric */}
                <div 
                  className="w-24 h-24 xl:w-28 xl:h-28 flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 30%, #991b1b 70%, #7f1d1d 100%)',
                    boxShadow: `
                      0 0 50px rgba(220, 38, 38, 0.8),
                      0 10px 30px rgba(0, 0, 0, 0.5),
                      inset 0 3px 6px rgba(255, 255, 255, 0.3),
                      inset 0 -3px 6px rgba(0, 0, 0, 0.4)
                    `,
                    clipPath: 'polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px))',
                  }}
                >
                  <span 
                    className="text-white font-bold text-5xl xl:text-6xl"
                    style={{
                      textShadow: '0 0 30px rgba(255, 255, 255, 0.7), 0 0 60px rgba(255, 255, 255, 0.3)',
                    }}
                  >
                    C
                  </span>
                </div>
                
                {/* Verification Badge - Floats even further forward */}
                <motion.div
                  animate={{ 
                    opacity: [0.8, 1, 0.8],
                    scale: [1, 1.2, 1],
                    y: [0, -3, 0],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                    boxShadow: '0 0 30px rgba(34, 197, 94, 0.8), 0 5px 15px rgba(0, 0, 0, 0.4), inset 0 1px 3px rgba(255, 255, 255, 0.4)',
                    border: '2px solid rgba(255, 255, 255, 0.2)',
                    transform: 'translateZ(30px)',
                  }}
                >
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ filter: 'drop-shadow(0 0 4px rgba(255, 255, 255, 0.5))' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
              </motion.div>
            </div>

            {/* Diagonal Refraction Line - Volumetric shine */}
            <motion.div 
              animate={{ 
                opacity: [0.1, 0.5, 0.1],
                x: ['-100%', '200%'],
              }}
              transition={{ 
                duration: 6, 
                repeat: Infinity, 
                ease: 'easeInOut' 
              }}
              className="absolute inset-0 overflow-hidden pointer-events-none"
              style={{
                background: 'linear-gradient(120deg, transparent 30%, rgba(255, 255, 255, 0.25) 50%, transparent 70%)',
                clipPath: 'polygon(0 12px, 12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px))',
              }}
            />
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}

// =============================================================================
// Narrative Box - Digital Shard Container
// =============================================================================

interface NarrativeBoxProps {
  children: React.ReactNode;
  delay?: number;
}

function NarrativeBox({ children, delay = 0 }: NarrativeBoxProps) {
  return (
    <motion.div
      variants={hudVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{ 
        originY: 0.5,
        transitionDelay: `${delay}ms`,
        transformStyle: 'preserve-3d',
      }}
      className="relative"
    >
      {/* Main Digital Shard Container - TRUE 3D with Tilt */}
      <motion.div 
        className="relative px-6 py-6 overflow-hidden"
        initial={{ rotateX: 0, rotateY: 0 }}
        animate={{ rotateX: 2, rotateY: -3 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          clipPath: 'polygon(0 12px, 12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px))',
          // Multi-layered borders for "Rim Lighting" - different on each edge
          borderTop: '1px solid rgba(255, 255, 255, 0.3)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.2)',
          borderRight: '1px solid rgba(255, 3, 3, 0.15)',
          borderBottom: '1px solid rgba(255, 3, 3, 0.35)',
          // Inner glow to simulate glass volume + deep shadow
          boxShadow: `
            inset 0 0 30px rgba(255, 255, 255, 0.05),
            inset 0 0 60px rgba(220, 38, 38, 0.08),
            0 25px 60px -10px rgba(0, 0, 0, 0.6),
            0 0 40px rgba(220, 38, 38, 0.15)
          `,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Rim Light Gradient Border Overlay - Volumetric */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, transparent 35%, transparent 65%, rgba(255, 3, 3, 0.12) 100%)',
            clipPath: 'polygon(0 12px, 12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px))',
          }}
        />
        
        {/* Top Edge Highlight - Glass Thickness */}
        <div 
          className="absolute top-0 left-4 right-4 h-px pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)',
          }}
        />
        
        {/* L-Shaped Corner Brackets */}
        {/* Top-Left */}
        <div className="absolute top-0 left-0 w-4 h-4 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-red-500/80 to-transparent" />
          <div className="absolute top-0 left-0 w-[2px] h-full bg-gradient-to-b from-red-500/80 to-transparent" />
        </div>
        {/* Top-Right */}
        <div className="absolute top-0 right-0 w-4 h-4 pointer-events-none">
          <div className="absolute top-0 right-0 w-full h-[2px] bg-gradient-to-l from-red-500/80 to-transparent" />
          <div className="absolute top-0 right-0 w-[2px] h-full bg-gradient-to-b from-red-500/80 to-transparent" />
        </div>
        {/* Bottom-Left */}
        <div className="absolute bottom-0 left-0 w-4 h-4 pointer-events-none">
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-red-500/80 to-transparent" />
          <div className="absolute bottom-0 left-0 w-[2px] h-full bg-gradient-to-t from-red-500/80 to-transparent" />
        </div>
        {/* Bottom-Right */}
        <div className="absolute bottom-0 right-0 w-4 h-4 pointer-events-none">
          <div className="absolute bottom-0 right-0 w-full h-[2px] bg-gradient-to-l from-red-500/80 to-transparent" />
          <div className="absolute bottom-0 right-0 w-[2px] h-full bg-gradient-to-t from-red-500/80 to-transparent" />
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
            background: 'linear-gradient(90deg, transparent, rgba(220, 38, 38, 0.5), transparent)',
          }}
        />
        
        {/* Content - Slightly forward in Z-space */}
        <div 
          className="relative z-10"
          style={{ transform: 'translateZ(10px)' }}
        >
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}

// =============================================================================
// Trust Indicator Component (Glowing Value Propositions with HUD Effect)
// =============================================================================

interface TrustIndicatorProps {
  icon: React.ReactNode;
  text: string;
  delay?: number;
}

function TrustIndicator({ icon, text, delay = 0 }: TrustIndicatorProps) {
  return (
    <motion.div 
      variants={hudVariants}
      initial="hidden"
      animate="visible"
      custom={delay}
      transition={{ delay }}
      className="flex items-center gap-4 group"
    >
      {/* Glowing Icon Container with HUD styling */}
      <div 
        className="w-11 h-11 flex items-center justify-center transition-all duration-300 group-hover:scale-110"
        style={{
          background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.25) 0%, rgba(220, 38, 38, 0.1) 100%)',
          border: '1px solid rgba(220, 38, 38, 0.4)',
          boxShadow: '0 0 20px rgba(220, 38, 38, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          clipPath: 'polygon(0 4px, 4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px))',
        }}
      >
        <div 
          className="text-red-400"
          style={{
            filter: 'drop-shadow(0 0 8px rgba(220, 38, 38, 0.9))',
          }}
        >
          {icon}
        </div>
      </div>
      
      {/* Text with DecryptionText Effect */}
      <span 
        className="text-white font-medium text-base tracking-wide"
        style={{ 
          textShadow: '0 0 20px rgba(255, 255, 255, 0.25), 0 0 40px rgba(255, 255, 255, 0.1)',
        }}
      >
        <DecryptionText text={text} delay={delay * 1000 + 200} duration={400} />
      </span>
    </motion.div>
  );
}

// =============================================================================
// Network Pulse Widget (Real-Time Activity Simulator)
// =============================================================================

function NetworkPulseWidget() {
  const [currentMessage, setCurrentMessage] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentMessage((prev) => (prev + 1) % NETWORK_MESSAGES.length);
        setIsVisible(true);
      }, 300);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div 
      className="relative px-4 py-3"
      initial={{ rotateX: 0, rotateY: 0 }}
      animate={{ rotateX: -2, rotateY: 4 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      style={{
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        // Multi-layered borders - opposite tilt from main shard
        borderTop: '1px solid rgba(255, 255, 255, 0.2)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.15)',
        borderRight: '1px solid rgba(255, 3, 3, 0.2)',
        borderBottom: '1px solid rgba(255, 3, 3, 0.4)',
        // Notched corners
        clipPath: 'polygon(0 6px, 6px 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px))',
        // Volumetric shadow
        boxShadow: `
          inset 0 0 15px rgba(255, 255, 255, 0.03),
          inset 0 0 30px rgba(220, 38, 38, 0.05),
          0 15px 35px -5px rgba(0, 0, 0, 0.5),
          0 0 25px rgba(220, 38, 38, 0.1)
        `,
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Top Edge Highlight */}
      <div 
        className="absolute top-0 left-2 right-2 h-px pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
        }}
      />
      
      {/* Header Row */}
      <div className="flex items-center gap-2 mb-2">
        {/* Pulsing Red Dot */}
        <span className="relative flex h-2.5 w-2.5">
          <span 
            className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
            style={{ backgroundColor: 'rgba(220, 38, 38, 0.8)' }}
          />
          <span 
            className="relative inline-flex h-2.5 w-2.5 rounded-full"
            style={{ 
              backgroundColor: '#dc2626',
              boxShadow: '0 0 10px rgba(220, 38, 38, 1)',
            }}
          />
        </span>
        <span 
          className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-medium"
        >
          <DecryptionText text="Simulated Network Activity" delay={1200} duration={400} />
        </span>
      </div>
      
      {/* Rotating Message */}
      <div className="min-h-[20px]">
        <AnimatePresence mode="wait">
          {isVisible && (
            <motion.div
              key={currentMessage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="text-sm text-white font-medium"
              style={{ 
                textShadow: '0 0 15px rgba(220, 38, 38, 0.5)',
              }}
            >
              {NETWORK_MESSAGES[currentMessage]}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// =============================================================================
// Login Form Sub-Component
// =============================================================================

interface LoginFormProps {
  form: ReturnType<typeof useForm<LoginForm>>;
  onSubmit: (data: LoginForm) => Promise<void>;
  isLoading: boolean;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
}

function LoginForm({ form, onSubmit, isLoading, showPassword, setShowPassword }: LoginFormProps) {
  const { register, handleSubmit, formState: { errors } } = form;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Email */}
      <div className="space-y-2">
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          className="glass-input"
          placeholder="Email Address"
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Invalid email address',
            },
          })}
        />
        {errors.email && (
          <p className="text-xs text-red-400 pl-1">{errors.email.message}</p>
        )}
      </div>

      {/* Password */}
      <div className="space-y-2">
        <div className="relative">
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            className="glass-input pr-12"
            placeholder="Password"
            {...register('password', {
              required: 'Password is required',
              minLength: {
                value: 8,
                message: 'Password must be at least 8 characters',
              },
            })}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 transition-colors focus:outline-none"
          >
            {showPassword ? (
              <EyeSlashIcon className="h-5 w-5" />
            ) : (
              <EyeIcon className="h-5 w-5" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-red-400 pl-1">{errors.password.message}</p>
        )}
      </div>

      {/* Remember Me */}
      <div className="flex items-center">
        <input
          id="remember-me"
          type="checkbox"
          className="h-4 w-4 rounded bg-black/40 border-white/20 text-red-500 focus:ring-red-500/50 focus:ring-offset-0"
        />
        <label htmlFor="remember-me" className="ml-2.5 text-sm text-slate-400">
          Remember me
        </label>
      </div>

      {/* Submit Button */}
      <AuthButton isLoading={isLoading} text="Authenticate" loadingText="Authenticating..." />
    </form>
  );
}

// =============================================================================
// Signup Form Sub-Component
// =============================================================================

interface SignupFormProps {
  form: ReturnType<typeof useForm<RegisterForm>>;
  onSubmit: (data: RegisterForm) => Promise<void>;
  isLoading: boolean;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (show: boolean) => void;
  password: string;
}

function SignupForm({
  form,
  onSubmit,
  isLoading,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  password,
}: SignupFormProps) {
  const { register, handleSubmit, formState: { errors } } = form;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Name Fields - Two Column Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <input
            id="firstName"
            type="text"
            autoComplete="given-name"
            className="glass-input"
            placeholder="First Name"
            {...register('firstName', { required: 'Required' })}
          />
          {errors.firstName && (
            <p className="text-xs text-red-400 pl-1">{errors.firstName.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <input
            id="lastName"
            type="text"
            autoComplete="family-name"
            className="glass-input"
            placeholder="Last Name"
            {...register('lastName', { required: 'Required' })}
          />
          {errors.lastName && (
            <p className="text-xs text-red-400 pl-1">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <input
          id="signup-email"
          type="email"
          autoComplete="email"
          className="glass-input"
          placeholder="Email Address"
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Invalid email address',
            },
          })}
        />
        {errors.email && (
          <p className="text-xs text-red-400 pl-1">{errors.email.message}</p>
        )}
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <div className="relative">
          <input
            id="signup-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            className="glass-input pr-12"
            placeholder="Password"
            {...register('password', {
              required: 'Password is required',
              minLength: {
                value: 8,
                message: 'Password must be at least 8 characters',
              },
              pattern: {
                value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                message: 'Must contain uppercase, lowercase, and number',
              },
            })}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 transition-colors focus:outline-none"
          >
            {showPassword ? (
              <EyeSlashIcon className="h-5 w-5" />
            ) : (
              <EyeIcon className="h-5 w-5" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-red-400 pl-1">{errors.password.message}</p>
        )}
      </div>

      {/* Confirm Password */}
      <div className="space-y-1.5">
        <div className="relative">
          <input
            id="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            className="glass-input pr-12"
            placeholder="Confirm Password"
            {...register('confirmPassword', {
              required: 'Please confirm your password',
              validate: (value) => value === password || 'Passwords do not match',
            })}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 transition-colors focus:outline-none"
          >
            {showConfirmPassword ? (
              <EyeSlashIcon className="h-5 w-5" />
            ) : (
              <EyeIcon className="h-5 w-5" />
            )}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="text-xs text-red-400 pl-1">{errors.confirmPassword.message}</p>
        )}
      </div>

      {/* Terms */}
      <div className="flex items-start pt-1">
        <input
          id="terms"
          type="checkbox"
          required
          className="mt-0.5 h-4 w-4 rounded bg-black/40 border-white/20 text-red-500 focus:ring-red-500/50 focus:ring-offset-0"
        />
        <label htmlFor="terms" className="ml-2.5 text-sm text-slate-400 leading-tight">
          I agree to the{' '}
          <a href="#" className="text-red-400 hover:text-red-300">Terms of Service</a>
          {' '}and{' '}
          <a href="#" className="text-red-400 hover:text-red-300">Privacy Policy</a>
        </label>
      </div>

      {/* Submit Button */}
      <div className="pt-1">
        <AuthButton isLoading={isLoading} text="Authenticate" loadingText="Creating Account..." />
      </div>
    </form>
  );
}

// =============================================================================
// Auth Button Component
// =============================================================================

interface AuthButtonProps {
  isLoading: boolean;
  text: string;
  loadingText: string;
}

function AuthButton({ isLoading, text, loadingText }: AuthButtonProps) {
  return (
    <motion.button
      type="submit"
      disabled={isLoading}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="w-full py-4 px-8 rounded-full font-bold uppercase tracking-[0.15em] text-white text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: 'linear-gradient(180deg, #dc2626 0%, #b91c1c 100%)',
        boxShadow: `
          0 15px 35px -8px rgba(220, 38, 38, 0.5),
          0 0 25px rgba(220, 38, 38, 0.25),
          inset 0 1px 0 rgba(255, 255, 255, 0.15)
        `,
      }}
    >
      {isLoading ? (
        <span className="flex items-center justify-center">
          <svg
            className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          {loadingText}
        </span>
      ) : (
        text
      )}
    </motion.button>
  );
}

// =============================================================================
// Wallet Button Component
// =============================================================================

interface WalletButtonProps {
  isLoading: boolean;
  onClick: () => void;
}

function WalletButton({ isLoading, onClick }: WalletButtonProps) {
  return (
    <div>
      <motion.button
        type="button"
        disabled={isLoading}
        onClick={onClick}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="w-full py-3.5 px-6 rounded-full font-medium text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        style={{
          background: 'rgba(255, 255, 255, 0.04)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
        }}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-slate-300">Connecting Wallet...</span>
          </>
        ) : (
          <>
            <img
              src="https://raw.githubusercontent.com/ACStoneCL/docs/gh-pages/assets/images/casper-logo.svg"
              alt="Casper"
              className="h-5 w-5"
            />
            <span>Casper Wallet</span>
          </>
        )}
      </motion.button>
    </div>
  );
}

// =============================================================================
// Demo Button Component (TESTNET ONLY)
// =============================================================================

function DemoButton() {
  const demo = useDemoContext();

  // Log for debugging (can be removed later)
  console.log('[Demo] DEMO_ENABLED:', DEMO_ENABLED, 'env value:', import.meta.env.VITE_DEMO_MODE);
  console.log('[Demo] Demo context available:', !!demo);

  // Show button even if context is initializing - it will work once clicked
  // The button should be visible as long as DEMO_ENABLED is true
  
  const handleStartDemo = () => {
    if (demo) {
      demo.startDemo();
    } else {
      console.error('[Demo] Context not available - ensure ConditionalDemoProvider wraps the app');
    }
  };

  return (
    <div className="mt-6">
      {/* Divider */}
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-3 text-amber-500/80 bg-transparent text-xs uppercase tracking-wider">
            Testnet Demo
          </span>
        </div>
      </div>

      {/* Demo Button */}
      <motion.button
        type="button"
        onClick={handleStartDemo}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full py-3.5 px-6 rounded-full font-semibold text-white transition-all duration-300 flex items-center justify-center gap-3 uppercase tracking-wider text-sm"
        style={{
          background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.2) 0%, rgba(180, 83, 9, 0.2) 100%)',
          border: '1px solid rgba(220, 38, 38, 0.4)',
          boxShadow: `
            0 0 20px rgba(220, 38, 38, 0.2),
            0 4px 15px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.1)
          `,
        }}
      >
        <BeakerIcon className="h-5 w-5 text-red-400" />
        <span>Take Us On A Demo</span>
        <span className="relative flex h-2 w-2 ml-1">
          <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
      </motion.button>

      <p className="mt-2.5 text-xs text-center text-gray-500">
        Experience the full workflow with{' '}
        <span className="text-amber-500/80">automated testnet accounts</span>
      </p>
    </div>
  );
}
