// =============================================================================
// Login Page
// =============================================================================

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../stores/auth';
import { useWalletStore } from '../../stores/wallet';
import { api } from '../../lib/api';

interface LoginForm {
  email: string;
  password: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isWalletLoading, setIsWalletLoading] = useState(false);
  const { login } = useAuthStore();
  const { connect, publicKey, isConnected, disconnect } = useWalletStore();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      await login(data.email, data.password);
      toast.success('Welcome back!');
    } catch (error) {
      // Error handling is done by API interceptor
      console.error('Login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWalletSignIn = async () => {
    setIsWalletLoading(true);
    try {
      // Step 1: Connect wallet if not connected
      let walletPublicKey = publicKey;
      if (!isConnected || !publicKey) {
        await connect();
        walletPublicKey = useWalletStore.getState().publicKey;
        
        if (!walletPublicKey) {
          toast.error('Failed to connect wallet. Please try again.');
          return;
        }
      }

      // Step 2: Request nonce from backend
      const nonceResponse = await api.post<{
        success: boolean;
        data: { nonce: string; message: string; expiresAt: string };
      }>('/auth/nonce', { publicKey: walletPublicKey });

      const { nonce, message } = nonceResponse.data.data;

      // Step 3: Sign the message with wallet
      const walletStore = useWalletStore.getState();
      const signature = await walletStore.signMessage(message);

      if (!signature) {
        toast.error('Signature cancelled or failed');
        return;
      }

      // Step 4: Verify signature and get JWT
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

      // Step 5: Set auth state
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      useAuthStore.setState({
        token,
        user: {
          id: user.id,
          email: null,
          publicKey: user.publicKey,
          accountHash: user.accountHash,
          firstName: null,
          lastName: null,
          avatar: null,
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
      
      // Fetch wallet balance now that we're logged in
      setTimeout(() => {
        useWalletStore.getState().fetchBalance();
      }, 100);
      
      navigate('/dashboard');
    } catch (error) {
      console.error('Wallet sign-in failed:', error);
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Wallet sign-in failed. Please try again.');
      disconnect();
    } finally {
      setIsWalletLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Sign in to your account</h2>
        <p className="mt-2 text-sm text-gray-600">
          Or{' '}
          <Link to="/auth/register" className="font-medium text-enterprise-primary hover:text-blue-800">
            create a new account
          </Link>
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label htmlFor="email" className="label">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input"
            {...register('email', {
              required: 'Email is required',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Invalid email address',
              },
            })}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="input"
            {...register('password', {
              required: 'Password is required',
              minLength: {
                value: 8,
                message: 'Password must be at least 8 characters',
              },
            })}
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-enterprise-primary focus:ring-enterprise-primary"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
              Remember me
            </label>
          </div>

          <div className="text-sm">
            <Link 
              to="/auth/forgot-password" 
              className="font-medium text-enterprise-primary hover:text-blue-800"
            >
              Forgot your password?
            </Link>
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full"
          >
            {isLoading ? (
              <>
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
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </div>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-2 text-gray-500">Or continue with</span>
        </div>
      </div>

      <div>
        <button
          type="button"
          disabled={isWalletLoading}
          className="btn-secondary w-full flex items-center justify-center"
          onClick={handleWalletSignIn}
        >
          {isWalletLoading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5"
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
                className="h-5 w-5 mr-2"
              />
              Sign in with Casper Wallet
            </>
          )}
        </button>
        <p className="mt-2 text-xs text-center text-gray-500">
          Don't have the Casper Wallet?{' '}
          <a
            href="https://www.casperwallet.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-enterprise-primary hover:underline"
          >
            Download here
          </a>
        </p>
      </div>
    </div>
  );
}
