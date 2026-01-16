// =============================================================================
// Glass Auth Wrapper - Reusable glassmorphism container for auth pages
// =============================================================================

import { motion } from 'framer-motion';
import { ParticleBackground } from './ParticleBackground';

interface GlassAuthWrapperProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function GlassAuthWrapper({ children, title, subtitle }: GlassAuthWrapperProps) {
  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
      {/* === Layer 1: Dark Base Background === */}
      <div className="absolute inset-0 bg-[#0a0a0a]" />

      {/* === Layer 2: Blurred Color Blobs (Bokeh) === */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-[600px] h-[600px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, #8b0000 0%, transparent 70%)',
            filter: 'blur(100px)',
            top: '-10%',
            right: '-5%',
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-25"
          style={{
            background: 'radial-gradient(circle, #1a1a4e 0%, transparent 70%)',
            filter: 'blur(120px)',
            bottom: '-15%',
            left: '-10%',
          }}
        />
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
      </div>

      {/* === Layer 3: Particle Constellation === */}
      <ParticleBackground />

      {/* === Main Content === */}
      <div className="relative z-10 w-full max-w-md mx-4">
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
            {/* Header */}
            <div className="text-center mb-8">
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

              <h1
                className="text-2xl sm:text-3xl font-bold tracking-wider text-white uppercase"
                style={{
                  textShadow: '0 0 30px rgba(255, 255, 255, 0.3)',
                }}
              >
                {title}
              </h1>
              {subtitle && (
                <p className="mt-2 text-sm text-gray-400">{subtitle}</p>
              )}
            </div>

            {/* Content */}
            {children}
          </div>
        </motion.div>

        <p className="mt-6 text-center text-xs text-gray-600">
          Secured by Casper Network
        </p>
      </div>
    </div>
  );
}
