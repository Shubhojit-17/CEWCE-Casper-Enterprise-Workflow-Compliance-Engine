// =============================================================================
// Forgot Password Page - Glassmorphism Design
// =============================================================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { GlassAuthWrapper } from '../../components/auth/GlassAuthWrapper';

interface ForgotPasswordForm {
  email: string;
}

export function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>();

  const onSubmit = async (data: ForgotPasswordForm) => {
    setIsLoading(true);
    try {
      const response = await api.post<{
        success: boolean;
        message: string;
        _demo?: { resetUrl: string };
      }>('/auth/forgot-password', data);
      
      setIsSubmitted(true);
      toast.success('Check your email for the reset link');
      
      if (response.data._demo?.resetUrl) {
        setResetUrl(response.data._demo.resetUrl);
      }
    } catch (error) {
      console.error('Forgot password failed:', error);
      toast.error('Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <GlassAuthWrapper title="Check Your Email" subtitle="Password reset link sent">
        <div className="space-y-6">
          <p className="text-gray-400 text-center">
            If an account exists with that email, we've sent a password reset link.
          </p>

          {/* Demo mode: Show direct reset link */}
          {resetUrl && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <p className="text-sm font-medium text-yellow-400">Demo Mode</p>
              <p className="text-sm text-yellow-400/70 mt-1">
                In production, this link would be sent via email.
              </p>
              <Link
                to={resetUrl}
                className="mt-2 inline-block text-sm font-medium text-red-400 hover:text-red-300"
              >
                Click here to reset your password →
              </Link>
            </div>
          )}

          <div className="pt-4 text-center">
            <Link
              to="/auth/login"
              className="text-sm font-medium text-gray-400 hover:text-red-400 transition-colors"
            >
              ← Back to login
            </Link>
          </div>
        </div>
      </GlassAuthWrapper>
    );
  }

  return (
    <GlassAuthWrapper 
      title="Reset Password" 
      subtitle="Enter your email to receive a reset link"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
            Email address
          </label>
          <input
            id="email"
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
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Sending...
            </span>
          ) : (
            'Send Reset Link'
          )}
        </motion.button>
      </form>

      <div className="mt-6 text-center">
        <Link
          to="/auth/login"
          className="text-sm font-medium text-gray-400 hover:text-red-400 transition-colors"
        >
          ← Back to login
        </Link>
      </div>
    </GlassAuthWrapper>
  );
}
