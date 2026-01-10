// =============================================================================
// Forgot Password Page
// =============================================================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';

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
      
      // Demo mode: show reset URL directly
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
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Check your email</h2>
          <p className="mt-2 text-sm text-gray-600">
            If an account exists with that email, we've sent a password reset link.
          </p>
        </div>

        {/* Demo mode: Show direct reset link */}
        {resetUrl && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm font-medium text-yellow-800">Demo Mode</p>
            <p className="text-sm text-yellow-700 mt-1">
              In production, this link would be sent via email. For demo purposes:
            </p>
            <Link
              to={resetUrl}
              className="mt-2 inline-block text-sm font-medium text-enterprise-primary hover:underline"
            >
              Click here to reset your password →
            </Link>
          </div>
        )}

        <div className="pt-4">
          <Link
            to="/auth/login"
            className="text-sm font-medium text-enterprise-primary hover:text-blue-800"
          >
            ← Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Forgot your password?</h2>
        <p className="mt-2 text-sm text-gray-600">
          Enter your email address and we'll send you a link to reset your password.
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
                Sending...
              </>
            ) : (
              'Send reset link'
            )}
          </button>
        </div>
      </form>

      <div className="text-center">
        <Link
          to="/auth/login"
          className="text-sm font-medium text-enterprise-primary hover:text-blue-800"
        >
          ← Back to login
        </Link>
      </div>
    </div>
  );
}
