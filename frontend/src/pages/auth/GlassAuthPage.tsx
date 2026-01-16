// =============================================================================
// Glassmorphism Auth Page - Unified Login/Signup with Premium UI
// =============================================================================

import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { EyeIcon, EyeSlashIcon, BeakerIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '../../stores/auth';
import { useWalletStore } from '../../stores/wallet';
import { api } from '../../lib/api';
import { ParticleBackground } from '../../components/auth/ParticleBackground';
import { DEMO_ENABLED, useDemoContext } from '../../demo';

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
  // Render
  // =============================================================================
  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
      {/* === Layer 1: Dark Base Background === */}
      <div className="absolute inset-0 bg-[#0a0a0a]" />

      {/* === Layer 2: Blurred Color Blobs (Bokeh) === */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Deep red blob - top right */}
        <div
          className="absolute w-[600px] h-[600px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, #8b0000 0%, transparent 70%)',
            filter: 'blur(100px)',
            top: '-10%',
            right: '-5%',
          }}
        />
        {/* Dark blue/purple blob - bottom left */}
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-25"
          style={{
            background: 'radial-gradient(circle, #1a1a4e 0%, transparent 70%)',
            filter: 'blur(120px)',
            bottom: '-15%',
            left: '-10%',
          }}
        />
        {/* Subtle red blob - center bottom */}
        <div
          className="absolute w-[400px] h-[400px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, #660000 0%, transparent 70%)',
            filter: 'blur(80px)',
            bottom: '10%',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        />
        {/* Purple accent - top left */}
        <div
          className="absolute w-[350px] h-[350px] rounded-full opacity-15"
          style={{
            background: 'radial-gradient(circle, #3d1a5e 0%, transparent 70%)',
            filter: 'blur(90px)',
            top: '20%',
            left: '5%',
          }}
        />
      </div>

      {/* === Layer 3: Particle Constellation === */}
      <ParticleBackground />

      {/* === Main Content === */}
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* === Glassmorphism Container === */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative rounded-3xl overflow-hidden"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: `
              0 25px 50px -12px rgba(0, 0, 0, 0.5),
              0 20px 40px -10px rgba(255, 50, 50, 0.2),
              inset 0 1px 0 0 rgba(255, 255, 255, 0.05)
            `,
          }}
        >
          {/* Red glow at bottom */}
          <div
            className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
            style={{
              background: 'linear-gradient(to top, rgba(255, 50, 50, 0.15), transparent)',
            }}
          />

          <div className="relative p-8 sm:p-10">
            {/* === Header === */}
            <div className="text-center mb-8">
              {/* Logo */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-900/20 border border-red-500/20 flex items-center justify-center mb-6"
                style={{
                  boxShadow: '0 0 30px rgba(255, 50, 50, 0.3)',
                }}
              >
                <svg
                  className="h-8 w-8 text-red-400"
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

              {/* Title */}
              <h1
                className="text-2xl sm:text-3xl font-bold tracking-wider text-white uppercase"
                style={{
                  textShadow: '0 0 30px rgba(255, 255, 255, 0.3)',
                }}
              >
                Access The Engine
              </h1>
              <p className="mt-2 text-sm text-gray-400">
                Casper Enterprise Workflow & Compliance Engine
              </p>
            </div>

            {/* === Tabs === */}
            <div className="relative flex justify-center gap-8 mb-8">
              {(['login', 'signup'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className="relative py-2 text-sm font-semibold uppercase tracking-widest transition-colors duration-300"
                  style={{
                    color: activeTab === tab ? '#ffffff' : '#6b7280',
                    textShadow: activeTab === tab ? '0 0 20px rgba(255, 100, 100, 0.5)' : 'none',
                  }}
                >
                  {tab === 'login' ? 'Log In' : 'Sign Up'}
                  {activeTab === tab && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full"
                      style={{
                        background: 'linear-gradient(90deg, transparent, #ff4444, transparent)',
                        boxShadow: '0 0 10px rgba(255, 68, 68, 0.8), 0 0 20px rgba(255, 68, 68, 0.4)',
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
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
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
                <span className="px-3 text-gray-500 bg-transparent">or continue with</span>
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
                className="text-sm text-gray-400 hover:text-red-400 transition-colors"
              >
                Forgot your password?
              </Link>
            </div>
          </div>
        </motion.div>

        {/* === Bottom Text === */}
        <p className="mt-6 text-center text-xs text-gray-600">
          Secured by Casper Network
        </p>
      </div>
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
      <div>
        <label htmlFor="login-email" className="block text-sm font-medium text-gray-300 mb-2">
          Email address
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          className="glass-input"
          placeholder="you@example.com"
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Invalid email address',
            },
          })}
        />
        {errors.email && (
          <p className="mt-1.5 text-sm text-red-400">{errors.email.message}</p>
        )}
      </div>

      {/* Password */}
      <div>
        <label htmlFor="login-password" className="block text-sm font-medium text-gray-300 mb-2">
          Password
        </label>
        <div className="relative">
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            className="glass-input pr-10"
            placeholder="••••••••"
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
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-400 transition-colors focus:outline-none"
          >
            {showPassword ? (
              <EyeSlashIcon className="h-5 w-5" />
            ) : (
              <EyeIcon className="h-5 w-5" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="mt-1.5 text-sm text-red-400">{errors.password.message}</p>
        )}
      </div>

      {/* Remember Me */}
      <div className="flex items-center">
        <input
          id="remember-me"
          type="checkbox"
          className="h-4 w-4 rounded bg-black/30 border-white/20 text-red-500 focus:ring-red-500/50 focus:ring-offset-0"
        />
        <label htmlFor="remember-me" className="ml-2 text-sm text-gray-400">
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Name Fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-gray-300 mb-2">
            First name
          </label>
          <input
            id="firstName"
            type="text"
            autoComplete="given-name"
            className="glass-input"
            placeholder="John"
            {...register('firstName', { required: 'Required' })}
          />
          {errors.firstName && (
            <p className="mt-1 text-xs text-red-400">{errors.firstName.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-gray-300 mb-2">
            Last name
          </label>
          <input
            id="lastName"
            type="text"
            autoComplete="family-name"
            className="glass-input"
            placeholder="Doe"
            {...register('lastName', { required: 'Required' })}
          />
          {errors.lastName && (
            <p className="mt-1 text-xs text-red-400">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      {/* Email */}
      <div>
        <label htmlFor="signup-email" className="block text-sm font-medium text-gray-300 mb-2">
          Email address
        </label>
        <input
          id="signup-email"
          type="email"
          autoComplete="email"
          className="glass-input"
          placeholder="you@example.com"
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Invalid email address',
            },
          })}
        />
        {errors.email && (
          <p className="mt-1.5 text-sm text-red-400">{errors.email.message}</p>
        )}
      </div>

      {/* Password */}
      <div>
        <label htmlFor="signup-password" className="block text-sm font-medium text-gray-300 mb-2">
          Password
        </label>
        <div className="relative">
          <input
            id="signup-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            className="glass-input pr-10"
            placeholder="••••••••"
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
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-400 transition-colors focus:outline-none"
          >
            {showPassword ? (
              <EyeSlashIcon className="h-5 w-5" />
            ) : (
              <EyeIcon className="h-5 w-5" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="mt-1.5 text-sm text-red-400">{errors.password.message}</p>
        )}
      </div>

      {/* Confirm Password */}
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
          Confirm password
        </label>
        <div className="relative">
          <input
            id="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            className="glass-input pr-10"
            placeholder="••••••••"
            {...register('confirmPassword', {
              required: 'Please confirm your password',
              validate: (value) => value === password || 'Passwords do not match',
            })}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-400 transition-colors focus:outline-none"
          >
            {showConfirmPassword ? (
              <EyeSlashIcon className="h-5 w-5" />
            ) : (
              <EyeIcon className="h-5 w-5" />
            )}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="mt-1.5 text-sm text-red-400">{errors.confirmPassword.message}</p>
        )}
      </div>

      {/* Terms */}
      <div className="flex items-start">
        <input
          id="terms"
          type="checkbox"
          required
          className="mt-0.5 h-4 w-4 rounded bg-black/30 border-white/20 text-red-500 focus:ring-red-500/50 focus:ring-offset-0"
        />
        <label htmlFor="terms" className="ml-2 text-sm text-gray-400">
          I agree to the{' '}
          <a href="#" className="text-red-400 hover:text-red-300">Terms of Service</a>
          {' '}and{' '}
          <a href="#" className="text-red-400 hover:text-red-300">Privacy Policy</a>
        </label>
      </div>

      {/* Submit Button */}
      <AuthButton isLoading={isLoading} text="Create Account" loadingText="Creating..." />
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
      className="w-full py-3.5 px-6 rounded-full font-bold uppercase tracking-wider text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: 'linear-gradient(180deg, #dc2626 0%, #991b1b 100%)',
        boxShadow: '0 10px 30px -5px rgba(220, 38, 38, 0.5), 0 0 20px rgba(220, 38, 38, 0.3)',
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
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full py-3 px-6 rounded-full font-medium text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
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
            Connecting Wallet...
          </>
        ) : (
          <>
            <img
              src="https://raw.githubusercontent.com/ACStoneCL/docs/gh-pages/assets/images/casper-logo.svg"
              alt="Casper"
              className="h-5 w-5"
            />
            Sign in with Casper Wallet
          </>
        )}
      </motion.button>
      <p className="mt-2 text-xs text-center text-gray-500">
        Don't have the Casper Wallet?{' '}
        <a
          href="https://www.casperwallet.io/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-red-400 hover:text-red-300"
        >
          Download here
        </a>
      </p>
    </div>
  );
}

// =============================================================================
// Demo Button Component (TESTNET ONLY)
// =============================================================================

function DemoButton() {
  const demo = useDemoContext();

  // Don't render if demo context is not available
  if (!demo) return null;

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
        onClick={demo.startDemo}
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
