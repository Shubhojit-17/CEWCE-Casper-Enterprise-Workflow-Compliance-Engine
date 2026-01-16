/**
 * Narrative Lab - Hero Section ("The Constellation")
 * 
 * Premium, enterprise-grade hero with:
 * - Interactive constellation canvas background (nodes + edges)
 * - Atmospheric "aura" glows with breathing animation
 * - Floating glassmorphism blocks with parallax
 * - Typography with staggered entrance
 * - Scroll indicator
 * 
 * Design: Dark, calm, enterprise trust aesthetic
 */
import { useRef, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useConstellationCanvas } from '../hooks/useConstellationCanvas';

export function HeroSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Initialize constellation canvas
  useConstellationCanvas(canvasRef, {
    nodeCount: 80,
    connectionDistance: 150,
    mouseInfluenceRadius: 200,
    mouseInfluenceStrength: 0.02,
  });

  // Mouse position for parallax effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  // Smooth spring physics for parallax
  const springConfig = { damping: 50, stiffness: 100 };
  const smoothMouseX = useSpring(mouseX, springConfig);
  const smoothMouseY = useSpring(mouseY, springConfig);

  // Parallax transforms for floating blocks
  const blockAX = useTransform(smoothMouseX, [-500, 500], [20, -20]);
  const blockAY = useTransform(smoothMouseY, [-500, 500], [20, -20]);
  const blockBX = useTransform(smoothMouseX, [-500, 500], [-15, 15]);
  const blockBY = useTransform(smoothMouseY, [-500, 500], [-15, 15]);
  const blockCX = useTransform(smoothMouseX, [-500, 500], [10, -10]);
  const blockCY = useTransform(smoothMouseY, [-500, 500], [10, -10]);

  // Track mouse position relative to center
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      mouseX.set(e.clientX - centerX);
      mouseY.set(e.clientY - centerY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <section 
      ref={containerRef}
      className="relative h-screen w-full overflow-hidden"
      style={{ backgroundColor: '#0A0A0B' }}
    >
      {/* ================================================================== */}
      {/* LAYER 1: Interactive Constellation Canvas (Background)            */}
      {/* ================================================================== */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ zIndex: 1 }}
      />

      {/* ================================================================== */}
      {/* LAYER 2: Atmospheric "Aura" Glows                                 */}
      {/* ================================================================== */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
        {/* Glow A: Deep red, left of center */}
        <motion.div
          animate={{ 
            scale: [1, 1.05, 1],
            opacity: [0.2, 0.25, 0.2],
          }}
          transition={{ 
            duration: 8, 
            repeat: Infinity, 
            ease: 'easeInOut',
          }}
          className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(127, 29, 29, 0.2) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        
        {/* Glow B: Slate/neutral, right of center */}
        <motion.div
          animate={{ 
            scale: [1, 1.03, 1],
            opacity: [0.1, 0.15, 0.1],
          }}
          transition={{ 
            duration: 10, 
            repeat: Infinity, 
            ease: 'easeInOut',
            delay: 1,
          }}
          className="absolute top-1/2 left-2/3 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(30, 41, 59, 0.15) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
      </div>

      {/* ================================================================== */}
      {/* LAYER 3: Floating Glassmorphism Blocks (Casper blocks metaphor)   */}
      {/* ================================================================== */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 3 }}>
        {/* Block A: Top-right - largest */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5, delay: 0.5 }}
          style={{ x: blockAX, y: blockAY }}
          className="absolute top-[15%] right-[10%] md:right-[15%]"
        >
          <GlassBlock size="lg" />
        </motion.div>

        {/* Block B: Bottom-left - medium */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5, delay: 0.7 }}
          style={{ x: blockBX, y: blockBY }}
          className="absolute bottom-[20%] left-[8%] md:left-[12%]"
        >
          <GlassBlock size="md" />
        </motion.div>

        {/* Block C: Top-left - small */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5, delay: 0.9 }}
          style={{ x: blockCX, y: blockCY }}
          className="absolute top-[25%] left-[5%] md:left-[20%] hidden md:block"
        >
          <GlassBlock size="sm" />
        </motion.div>
      </div>

      {/* ================================================================== */}
      {/* LAYER 4: Typography (Centerpiece)                                 */}
      {/* ================================================================== */}
      <div 
        className="absolute inset-0 flex flex-col items-center justify-center px-6"
        style={{ zIndex: 10 }}
      >
        <div className="text-center max-w-4xl">
          {/* Headline with staggered animation */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.1] tracking-tight mb-6"
          >
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="block"
            >
              Enterprise workflows,
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="block mt-2"
            >
              <span 
                className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-red-500 to-red-400"
                style={{
                  textShadow: '0 0 40px rgba(239, 68, 68, 0.3)',
                }}
              >
                anchored in truth.
              </span>
            </motion.span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className="text-base sm:text-lg md:text-xl text-white/40 max-w-2xl mx-auto leading-relaxed"
          >
            The efficiency of off-chain collaboration meets the finality of Casper blockchain.
          </motion.p>
        </div>
      </div>

      {/* ================================================================== */}
      {/* LAYER 5: Scroll Indicator                                         */}
      {/* ================================================================== */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.8 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
        style={{ zIndex: 10 }}
      >
        <span className="text-white/25 text-xs tracking-[0.2em] uppercase font-light">
          Scroll to explore
        </span>
        
        {/* Mouse icon */}
        <div className="relative w-6 h-10 rounded-full border border-white/20 flex items-start justify-center pt-2">
          <motion.div
            animate={{ 
              y: [0, 6, 0],
              opacity: [0.6, 1, 0.6],
            }}
            transition={{ 
              duration: 1.8, 
              repeat: Infinity, 
              ease: 'easeInOut',
            }}
            className="w-1 h-1.5 rounded-full bg-white/60"
          />
        </div>
      </motion.div>
    </section>
  );
}

/* ======================================================================== */
/* GlassBlock — Floating glassmorphism element representing Casper blocks   */
/* ======================================================================== */
function GlassBlock({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-16 h-16 md:w-20 md:h-20',
    md: 'w-20 h-20 md:w-28 md:h-28',
    lg: 'w-24 h-24 md:w-36 md:h-36',
  };

  return (
    <motion.div
      animate={{ 
        y: [0, -8, 0],
        rotateX: [0, 2, 0],
        rotateY: [0, -2, 0],
      }}
      transition={{ 
        duration: 6 + Math.random() * 2, 
        repeat: Infinity, 
        ease: 'easeInOut',
      }}
      className={`
        ${sizeClasses[size]}
        rounded-xl
        backdrop-blur-md
        border border-white/10
        relative
        overflow-hidden
      `}
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
        boxShadow: `
          0 8px 32px rgba(0, 0, 0, 0.3),
          inset 0 1px 0 rgba(255, 255, 255, 0.1),
          inset 0 -1px 0 rgba(0, 0, 0, 0.2)
        `,
        transform: 'perspective(1000px)',
      }}
    >
      {/* Inner highlight for 3D illusion */}
      <div 
        className="absolute inset-0 rounded-xl"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%)',
        }}
      />
      
      {/* Subtle Casper red accent */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-1/3 rounded-b-xl"
        style={{
          background: 'linear-gradient(to top, rgba(239, 68, 68, 0.05) 0%, transparent 100%)',
        }}
      />
      
      {/* Block "hash" indicator */}
      <div className="absolute bottom-2 left-2 right-2">
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          />
        </div>
      </div>
    </motion.div>
  );
}
