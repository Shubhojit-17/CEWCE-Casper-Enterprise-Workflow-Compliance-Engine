// =============================================================================
// Split-Prism Auth Page - Premium Two-Column Layout
// Left: Engine Core Narrative | Right: Glass Terminal Auth Form
// =============================================================================

import { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
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

      {/* === Header with Logo === */}
      <div className="absolute top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Casper Logo / CEWCE Wordmark */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-600/20">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="text-white font-semibold text-lg tracking-wide">
              Casper
            </span>
          </div>

          {/* Minimal Auth Nav */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleTabChange('login')}
              className={`px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-lg ${
                activeTab === 'login' 
                  ? 'text-white bg-white/5' 
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Log in
            </button>
            <button
              onClick={() => handleTabChange('signup')}
              className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                activeTab === 'signup'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                  : 'bg-red-600/80 text-white hover:bg-red-600 shadow-lg shadow-red-600/20'
              }`}
            >
              Sign up
            </button>
          </div>
        </div>
      </div>

      {/* === Main Split-Prism Layout === */}
      <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">
        
        {/* === LEFT COLUMN: Engine Core Narrative (40%) === */}
        <div className="hidden lg:flex lg:w-[40%] xl:w-[42%] flex-col items-center justify-center px-8 xl:px-16 py-20">
          <div className="max-w-md w-full space-y-12">
            
            {/* Floating Glass Prism Block */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <FloatingPrism />
            </motion.div>

            {/* Trust Indicators */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="space-y-5"
            >
              <TrustIndicator 
                icon={<DocumentCheckIcon className="w-5 h-5" />}
                text="Immutable Audit Trails"
              />
              <TrustIndicator 
                icon={<BoltIcon className="w-5 h-5" />}
                text="Off-Chain Efficiency"
              />
              <TrustIndicator 
                icon={<LinkIcon className="w-5 h-5" />}
                text="On-Chain Finality"
              />
            </motion.div>

            {/* Simulated Network Pulse */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <NetworkPulse />
            </motion.div>
          </div>
        </div>

        {/* === RIGHT COLUMN: Glass Terminal Auth Form (60%) === */}
        <div className="flex-1 lg:w-[60%] xl:w-[58%] flex items-center justify-center px-4 sm:px-8 py-20 lg:py-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="relative w-full max-w-md lg:max-w-lg"
          >
            {/* === Glass Terminal Container === */}
            <div
              className="relative rounded-3xl overflow-hidden"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: `
                  0 30px 60px -15px rgba(0, 0, 0, 0.6),
                  0 25px 50px -12px rgba(255, 50, 50, 0.15),
                  inset 0 1px 0 0 rgba(255, 255, 255, 0.08)
                `,
              }}
            >
              {/* Top-Left Rim Light */}
              <div
                className="absolute top-0 left-0 w-32 h-32 pointer-events-none"
                style={{
                  background: 'radial-gradient(circle at top left, rgba(255, 255, 255, 0.08), transparent 60%)',
                }}
              />

              {/* Bottom Red Glow */}
              <div
                className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
                style={{
                  background: 'linear-gradient(to top, rgba(220, 38, 38, 0.12), transparent)',
                }}
              />

              <div className="relative p-8 sm:p-10 lg:p-12">
                {/* === Header === */}
                <div className="text-center mb-8">
                  {/* Small Logo */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-900/20 border border-red-500/20 flex items-center justify-center mb-5"
                    style={{
                      boxShadow: '0 0 30px rgba(220, 38, 38, 0.25)',
                    }}
                  >
                    <svg
                      className="h-7 w-7 text-red-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </motion.div>

                  {/* Title with Gradient */}
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-wider uppercase">
                    <span className="bg-gradient-to-r from-red-400 via-red-300 to-white bg-clip-text text-transparent">
                      Access The Engine
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
// Floating Glass Prism Component
// =============================================================================

function FloatingPrism() {
  return (
    <motion.div
      animate={{ 
        rotateY: [0, 5, -5, 0],
        rotateX: [0, -3, 3, 0],
        y: [0, -8, 0],
      }}
      transition={{ 
        duration: 8, 
        repeat: Infinity, 
        ease: 'easeInOut' 
      }}
      className="relative mx-auto w-48 h-48 xl:w-56 xl:h-56"
      style={{ perspective: '1000px' }}
    >
      {/* Outer Glow */}
      <div 
        className="absolute inset-0 rounded-3xl"
        style={{
          background: 'radial-gradient(circle at center, rgba(220, 38, 38, 0.2), transparent 70%)',
          filter: 'blur(30px)',
        }}
      />
      
      {/* Glass Cube */}
      <div
        className="absolute inset-4 rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: `
            0 20px 40px -10px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            inset 0 -1px 0 rgba(0, 0, 0, 0.2)
          `,
        }}
      >
        {/* Inner Content - Pulsing Casper Logo */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ 
              scale: [1, 1.05, 1],
              opacity: [0.8, 1, 0.8],
            }}
            transition={{ 
              duration: 3, 
              repeat: Infinity, 
              ease: 'easeInOut' 
            }}
            className="relative"
          >
            {/* Casper "C" Logo */}
            <div className="w-20 h-20 xl:w-24 xl:h-24 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-xl shadow-red-600/30">
              <span className="text-white font-bold text-4xl xl:text-5xl">C</span>
            </div>
            
            {/* Verification Badge Overlay */}
            <motion.div
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-green-500/90 flex items-center justify-center border-2 border-black/50"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>
          </motion.div>
        </div>

        {/* Refraction Lines */}
        <div 
          className="absolute inset-0 rounded-2xl overflow-hidden opacity-30"
          style={{
            background: 'linear-gradient(135deg, transparent 40%, rgba(255, 255, 255, 0.1) 50%, transparent 60%)',
          }}
        />
      </div>
    </motion.div>
  );
}

// =============================================================================
// Trust Indicator Component
// =============================================================================

interface TrustIndicatorProps {
  icon: React.ReactNode;
  text: string;
}

function TrustIndicator({ icon, text }: TrustIndicatorProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
        {icon}
      </div>
      <span 
        className="text-white font-medium text-base tracking-wide"
        style={{ textShadow: '0 0 20px rgba(255, 255, 255, 0.2)' }}
      >
        {text}
      </span>
    </div>
  );
}

// =============================================================================
// Network Pulse Component (Simulated Activity)
// =============================================================================

function NetworkPulse() {
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
    <div className="relative">
      {/* Label */}
      <div className="flex items-center gap-2 mb-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
        <span className="text-xs text-slate-500 uppercase tracking-wider">
          Simulated Network Activity
        </span>
      </div>
      
      {/* Message */}
      <AnimatePresence mode="wait">
        {isVisible && (
          <motion.div
            key={currentMessage}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.3 }}
            className="text-sm text-slate-400 pl-4 border-l border-red-500/30"
            style={{ textShadow: '0 0 10px rgba(220, 38, 38, 0.3)' }}
          >
            {NETWORK_MESSAGES[currentMessage]}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
