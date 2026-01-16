/**
 * HeroSection - Volumetric Cyberpunk Enterprise
 * 
 * A deep, 3D command center aesthetic with:
 * - TRUE 3D isometric cubes with visible faces
 * - Dynamic chain connections with Bezier curves
 * - Luminous typography with bloom effect
 * 
 * Note: Canvas background is now handled by FixedBackground component
 */
import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion';

// Block position type for chain tracking
interface BlockPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  
  // Refs for tracking block positions
  const blockARefs = useRef<HTMLDivElement>(null);
  const blockBRefs = useRef<HTMLDivElement>(null);
  const blockCRefs = useRef<HTMLDivElement>(null);
  
  // Block positions state for chain connections
  const [blockPositions, setBlockPositions] = useState<{
    A: BlockPosition;
    B: BlockPosition;
    C: BlockPosition;
  }>({
    A: { x: 0, y: 0, width: 0, height: 0 },
    B: { x: 0, y: 0, width: 0, height: 0 },
    C: { x: 0, y: 0, width: 0, height: 0 },
  });
  
  // Set ready after a short delay for smooth entry animations
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Mouse position for parallax
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  // Smooth-dampened springs for premium parallax feel
  const springConfig = { damping: 25, stiffness: 40, mass: 1 };
  const smoothMouseX = useSpring(mouseX, springConfig);
  const smoothMouseY = useSpring(mouseY, springConfig);

  // Parallax transforms - significant movement
  const blockAX = useTransform(smoothMouseX, [-800, 800], [35, -35]);
  const blockAY = useTransform(smoothMouseY, [-800, 800], [35, -35]);
  const blockBX = useTransform(smoothMouseX, [-800, 800], [-25, 25]);
  const blockBY = useTransform(smoothMouseY, [-800, 800], [-25, 25]);
  const blockCX = useTransform(smoothMouseX, [-800, 800], [18, -18]);
  const blockCY = useTransform(smoothMouseY, [-800, 800], [18, -18]);
  
  // Update block positions for chain connections
  const updateBlockPositions = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    
    const getPos = (ref: React.RefObject<HTMLDivElement | null>): BlockPosition => {
      if (!ref.current) return { x: 0, y: 0, width: 0, height: 0 };
      const rect = ref.current.getBoundingClientRect();
      return {
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top + rect.height / 2,
        width: rect.width,
        height: rect.height,
      };
    };
    
    setBlockPositions({
      A: getPos(blockARefs),
      B: getPos(blockBRefs),
      C: getPos(blockCRefs),
    });
  }, []);

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
  
  // Initial position update and resize handler
  useEffect(() => {
    const timer = setTimeout(updateBlockPositions, 100);
    window.addEventListener('resize', updateBlockPositions);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateBlockPositions);
    };
  }, [updateBlockPositions]);

  return (
    <section 
      ref={containerRef}
      className="relative h-screen w-full overflow-hidden flex items-center justify-center z-[1]"
    >
      {/* ================================================================== */}
      {/* LAYER 1: Atmospheric Blobs (Volumetric Haze)                      */}
      {/* ================================================================== */}
      <div className="absolute inset-0 pointer-events-none z-[2] overflow-hidden">
        {/* Blob A: Left, Deep Red */}
        <motion.div
          animate={{ 
            x: [0, 40, -20, 0],
            y: [0, -30, 40, 0],
          }}
          transition={{ 
            duration: 25, 
            repeat: Infinity, 
            ease: "easeInOut",
          }}
          className="absolute top-1/4 -left-48"
          style={{
            width: '700px',
            height: '700px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(127, 29, 29, 0.25) 0%, transparent 70%)',
            filter: 'blur(180px)',
            mixBlendMode: 'screen',
          }}
        />
        
        {/* Blob B: Right, Slate Cyber */}
        <motion.div
          animate={{ 
            x: [0, -50, 30, 0],
            y: [0, 40, -40, 0],
          }}
          transition={{ 
            duration: 30, 
            repeat: Infinity, 
            ease: "easeInOut",
          }}
          className="absolute -bottom-48 -right-48"
          style={{
            width: '900px',
            height: '900px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(51, 65, 85, 0.2) 0%, transparent 70%)',
            filter: 'blur(180px)',
            mixBlendMode: 'screen',
          }}
        />
        
        {/* Blob C: Center accent */}
        <motion.div
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ 
            duration: 12, 
            repeat: Infinity, 
            ease: "easeInOut",
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255, 3, 3, 0.08) 0%, transparent 70%)',
            filter: 'blur(100px)',
            mixBlendMode: 'screen',
          }}
        />
      </div>

      {/* ================================================================== */}
      {/* LAYER 3: Infrastructure Cubes + Dynamic Chain Connections        */}
      {/* ================================================================== */}
      <div className="absolute inset-0 pointer-events-none z-[10]">
        {/* Dynamic SVG Chain Connections - positioned absolutely */}
        <DynamicChainConnections positions={blockPositions} isReady={isReady} />
        
        {/* Block A: Top-Right (Large) - NODE */}
        <motion.div
          ref={blockARefs}
          style={{ x: blockAX, y: blockAY }}
          className="absolute top-[16%] right-[12%] md:right-[15%]"
        >
          <IsometricCube size="lg" label="NODE" hash="0x7f3a...c9d2" index={0} />
        </motion.div>

        {/* Block B: Bottom-Left (Medium) - HASH */}
        <motion.div
          ref={blockBRefs}
          style={{ x: blockBX, y: blockBY }}
          className="absolute bottom-[18%] left-[10%] md:left-[12%]"
        >
          <IsometricCube size="md" label="HASH" hash="0x2e8b...4f1a" index={1} />
        </motion.div>

        {/* Block C: Top-Left (Small, distant) - STATE */}
        <motion.div
          ref={blockCRefs}
          style={{ x: blockCX, y: blockCY }}
          className="absolute top-[28%] left-[18%] md:left-[22%] hidden lg:block"
        >
          <IsometricCube size="sm" label="STATE" hash="0x9c4d...8e3f" index={2} />
        </motion.div>
      </div>

      {/* ================================================================== */}
      {/* LAYER 4: Luminous Typography (Centerpiece)                        */}
      {/* ================================================================== */}
      <AnimatePresence>
        {isReady && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            className="relative z-[20] text-center max-w-5xl px-6"
          >
            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.08]"
            >
              <span className="block text-white mb-2 sm:mb-4 drop-shadow-lg">
                Enterprise workflows,
              </span>
              
              {/* The Gradient, Glowing, Breathing Text */}
              <motion.span
                animate={{ 
                  scale: [1, 1.015, 1],
                  opacity: [0.92, 1, 0.92],
                }}
                transition={{ 
                  duration: 4, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
                className="block text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-red-400 to-white/90"
                style={{
                  filter: 'drop-shadow(0 0 20px rgba(255, 3, 3, 0.6)) drop-shadow(0 0 40px rgba(255, 3, 3, 0.3))',
                }}
              >
                anchored in truth.
              </motion.span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 1.2 }}
              className="mt-8 text-lg md:text-xl text-white/45 font-light tracking-wide max-w-2xl mx-auto"
            >
              The efficiency of off-chain collaboration meets the finality of Casper blockchain.
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================================================================== */}
      {/* LAYER 5: Scroll Indicator                                         */}
      {/* ================================================================== */}
      <AnimatePresence>
        {isReady && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.5, duration: 1 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 z-[20]"
          >
            <motion.span 
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="text-[10px] tracking-[0.3em] uppercase text-white/60 font-medium"
            >
              Scroll to Explore
            </motion.span>
            
            {/* Animated data stream line */}
            <div className="relative w-[2px] h-14 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                animate={{ y: [-30, 60] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-transparent via-red-500/80 to-transparent"
                style={{
                  boxShadow: '0 0 8px rgba(255, 3, 3, 0.5)',
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================================================================== */}
      {/* Loading overlay - prevents flicker                                */}
      {/* ================================================================== */}
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: isReady ? 0 : 1 }}
        transition={{ duration: 0.8 }}
        className="absolute inset-0 bg-transparent z-[50] pointer-events-none"
        style={{ display: isReady ? 'none' : 'block' }}
      />
    </section>
  );
}

/* ======================================================================== */
/* DynamicChainConnections - Bezier curves tracking block positions        */
/* Pulsing "data energy" flowing along the connections                     */
/* ======================================================================== */
function DynamicChainConnections({ 
  positions, 
  isReady 
}: { 
  positions: { A: BlockPosition; B: BlockPosition; C: BlockPosition };
  isReady: boolean;
}) {
  // Generate Bezier curve path between two points
  const generateBezierPath = (
    start: BlockPosition, 
    end: BlockPosition,
    curveIntensity: number = 0.3
  ): string => {
    if (!start.x || !end.x) return '';
    
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    
    // Control points for smooth Bezier curve
    const cp1x = start.x + dx * curveIntensity;
    const cp1y = start.y + dy * 0.1 - Math.abs(dx) * 0.15;
    const cp2x = end.x - dx * curveIntensity;
    const cp2y = end.y - dy * 0.1 - Math.abs(dx) * 0.15;
    
    return `M ${start.x} ${start.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${end.x} ${end.y}`;
  };

  const pathAB = generateBezierPath(positions.A, positions.B, 0.4);
  const pathAC = generateBezierPath(positions.A, positions.C, 0.35);
  const pathBC = generateBezierPath(positions.B, positions.C, 0.3);

  if (!isReady) return null;

  return (
    <svg 
      className="absolute inset-0 w-full h-full overflow-visible"
      style={{ zIndex: 0 }}
    >
      <defs>
        {/* Base gradient for chain lines */}
        <linearGradient id="chainBaseGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(255, 60, 60, 0.6)" />
          <stop offset="50%" stopColor="rgba(180, 30, 30, 0.3)" />
          <stop offset="100%" stopColor="rgba(80, 80, 80, 0.15)" />
        </linearGradient>
        
        {/* Glowing filter for rim light effect */}
        <filter id="chainGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        
        {/* Intense glow for pulse */}
        <filter id="pulseGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      
      {/* ============ Chain A→B: Top-right to Bottom-left ============ */}
      <g style={{ opacity: 0.7 }}>
        {/* Background glow path */}
        <motion.path
          d={pathAB}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2.5, delay: 1, ease: 'easeOut' }}
          fill="none"
          stroke="rgba(255, 60, 60, 0.15)"
          strokeWidth="8"
          filter="url(#chainGlow)"
        />
        
        {/* Main segmented chain */}
        <motion.path
          d={pathAB}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2, delay: 1 }}
          fill="none"
          stroke="url(#chainBaseGradient)"
          strokeWidth="2"
          strokeDasharray="8 12"
          strokeLinecap="round"
          filter="url(#chainGlow)"
        />
        
        {/* Traveling energy pulse */}
        <motion.path
          d={pathAB}
          fill="none"
          stroke="rgba(255, 100, 100, 0.9)"
          strokeWidth="3"
          strokeDasharray="20 500"
          strokeLinecap="round"
          filter="url(#pulseGlow)"
          initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: -600 }}
          transition={{ 
            duration: 3, 
            repeat: Infinity, 
            ease: [0.4, 0, 0.2, 1],
            delay: 1.5
          }}
        />
      </g>
      
      {/* ============ Chain A→C: Top-right to Top-left ============ */}
      <g className="hidden lg:block" style={{ opacity: 0.5 }}>
        {/* Background glow */}
        <motion.path
          d={pathAC}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2.5, delay: 1.3 }}
          fill="none"
          stroke="rgba(255, 60, 60, 0.1)"
          strokeWidth="6"
          filter="url(#chainGlow)"
        />
        
        {/* Main segmented chain */}
        <motion.path
          d={pathAC}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2, delay: 1.3 }}
          fill="none"
          stroke="url(#chainBaseGradient)"
          strokeWidth="1.5"
          strokeDasharray="6 10"
          strokeLinecap="round"
          filter="url(#chainGlow)"
        />
        
        {/* Traveling energy pulse */}
        <motion.path
          d={pathAC}
          fill="none"
          stroke="rgba(255, 120, 120, 0.8)"
          strokeWidth="2.5"
          strokeDasharray="15 400"
          strokeLinecap="round"
          filter="url(#pulseGlow)"
          initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: -450 }}
          transition={{ 
            duration: 2.5, 
            repeat: Infinity, 
            ease: [0.4, 0, 0.2, 1],
            delay: 2.2
          }}
        />
      </g>
      
      {/* ============ Chain B→C: Bottom-left to Top-left ============ */}
      <g className="hidden lg:block" style={{ opacity: 0.45 }}>
        {/* Background glow */}
        <motion.path
          d={pathBC}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2.5, delay: 1.6 }}
          fill="none"
          stroke="rgba(255, 60, 60, 0.08)"
          strokeWidth="5"
          filter="url(#chainGlow)"
        />
        
        {/* Main segmented chain */}
        <motion.path
          d={pathBC}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2, delay: 1.6 }}
          fill="none"
          stroke="url(#chainBaseGradient)"
          strokeWidth="1.5"
          strokeDasharray="5 9"
          strokeLinecap="round"
          filter="url(#chainGlow)"
        />
        
        {/* Traveling energy pulse */}
        <motion.path
          d={pathBC}
          fill="none"
          stroke="rgba(255, 140, 140, 0.7)"
          strokeWidth="2"
          strokeDasharray="12 350"
          strokeLinecap="round"
          filter="url(#pulseGlow)"
          initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: -400 }}
          transition={{ 
            duration: 2.8, 
            repeat: Infinity, 
            ease: [0.4, 0, 0.2, 1],
            delay: 2.8
          }}
        />
      </g>
    </svg>
  );
}

/* ======================================================================== */
/* IsometricCube - True 3D Cube with visible faces                         */
/* Top face, front face, and right side face for depth                     */
/* ======================================================================== */
function IsometricCube({ 
  size, 
  label, 
  hash, 
  index 
}: { 
  size: 'sm' | 'md' | 'lg'; 
  label: string;
  hash: string;
  index: number;
}) {
  // Dimensions for each size
  const dimensions = {
    sm: { width: 80, height: 60, depth: 25 },
    md: { width: 120, height: 90, depth: 35 },
    lg: { width: 180, height: 140, depth: 50 },
  };
  
  const { width, height, depth } = dimensions[size];
  const delays = { sm: 1.2, md: 0.8, lg: 0.4 };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, rotateY: -15 }}
      animate={{ 
        opacity: 1,
        scale: 1,
        rotateY: 0,
        y: [0, -8, 0],
      }}
      transition={{ 
        duration: 10, 
        repeat: Infinity, 
        ease: "easeInOut",
        opacity: { duration: 1.2, delay: delays[size] },
        scale: { duration: 1.2, delay: delays[size] },
        rotateY: { duration: 1.5, delay: delays[size] },
      }}
      className="relative"
      style={{
        width: width + depth * 0.7,
        height: height + depth * 0.7,
        transformStyle: 'preserve-3d',
        perspective: '1000px',
      }}
    >
      {/* ========== 3D CUBE STRUCTURE ========== */}
      <div 
        className="absolute inset-0"
        style={{
          transformStyle: 'preserve-3d',
          transform: 'rotateX(-15deg) rotateY(20deg)',
        }}
      >
        {/* FRONT FACE - Main visible face */}
        <div
          className="absolute rounded-lg overflow-hidden"
          style={{
            width: width,
            height: height,
            left: depth * 0.5,
            top: depth * 0.5,
            background: `linear-gradient(
              145deg,
              rgba(20, 20, 22, 0.95) 0%,
              rgba(12, 12, 14, 0.98) 100%
            )`,
            border: '1px solid rgba(255, 60, 60, 0.3)',
            boxShadow: `
              inset 0 1px 0 rgba(255, 255, 255, 0.05),
              inset 0 -1px 0 rgba(0, 0, 0, 0.3),
              0 0 30px rgba(255, 60, 60, 0.1),
              0 20px 40px rgba(0, 0, 0, 0.4)
            `,
            transform: 'translateZ(0px)',
          }}
        >
          {/* Face content */}
          <div className="absolute inset-0 p-3 md:p-4 flex flex-col justify-between">
            {/* Top row: Label + Status */}
            <div className="flex items-center justify-between">
              <span 
                className="text-[9px] md:text-[11px] font-mono tracking-[0.2em] text-white/70 font-medium"
              >
                {label}
              </span>
              <motion.div
                animate={{ 
                  opacity: [0.5, 1, 0.5],
                  scale: [1, 1.3, 1],
                  boxShadow: [
                    '0 0 4px rgba(255, 60, 60, 0.5)',
                    '0 0 12px rgba(255, 60, 60, 0.9)',
                    '0 0 4px rgba(255, 60, 60, 0.5)',
                  ]
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity,
                  delay: index * 0.6,
                }}
                className="w-2 h-2 rounded-full bg-red-500"
              />
            </div>
            
            {/* Center: Decorative grid pattern */}
            <div className="flex-1 flex items-center justify-center opacity-20">
              <svg width="40" height="40" viewBox="0 0 40 40">
                <rect x="0" y="0" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-red-400" />
                <rect x="22" y="0" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-white" />
                <rect x="0" y="22" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-white" />
                <rect x="22" y="22" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-red-400" />
              </svg>
            </div>
            
            {/* Bottom row: Hash */}
            <div className="text-right">
              <span className="text-[7px] md:text-[9px] font-mono text-white/50 tracking-tight">
                {hash}
              </span>
            </div>
          </div>
          
          {/* Animated scan line */}
          <motion.div
            animate={{ y: ['-100%', '300%'] }}
            transition={{ 
              duration: 4, 
              repeat: Infinity, 
              ease: 'linear',
              delay: index * 1.2
            }}
            className="absolute left-0 right-0 h-[1px] pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255, 60, 60, 0.3), transparent)',
            }}
          />
        </div>

        {/* TOP FACE - Angled perspective */}
        <div
          className="absolute rounded-t-lg"
          style={{
            width: width,
            height: depth,
            left: depth * 0.5,
            top: 0,
            background: `linear-gradient(
              180deg,
              rgba(60, 60, 65, 0.9) 0%,
              rgba(30, 30, 35, 0.95) 100%
            )`,
            border: '1px solid rgba(255, 60, 60, 0.25)',
            borderBottom: 'none',
            transform: `rotateX(70deg) translateY(-${depth * 0.35}px)`,
            transformOrigin: 'bottom center',
            boxShadow: 'inset 0 2px 4px rgba(255, 255, 255, 0.08)',
          }}
        >
          {/* Top face glow line */}
          <div 
            className="absolute bottom-0 left-0 right-0 h-[1px]"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255, 60, 60, 0.4), transparent)',
            }}
          />
        </div>

        {/* RIGHT SIDE FACE */}
        <div
          className="absolute rounded-r-lg"
          style={{
            width: depth,
            height: height,
            left: width + depth * 0.5,
            top: depth * 0.5,
            background: `linear-gradient(
              90deg,
              rgba(18, 18, 20, 0.98) 0%,
              rgba(8, 8, 10, 0.99) 100%
            )`,
            border: '1px solid rgba(255, 60, 60, 0.2)',
            borderLeft: 'none',
            transform: `rotateY(-70deg) translateX(${depth * 0.35}px)`,
            transformOrigin: 'left center',
            boxShadow: 'inset -2px 0 4px rgba(0, 0, 0, 0.4)',
          }}
        >
          {/* Side face accent line */}
          <div 
            className="absolute top-0 left-0 bottom-0 w-[1px]"
            style={{
              background: 'linear-gradient(180deg, rgba(255, 60, 60, 0.3), transparent)',
            }}
          />
        </div>
      </div>

      {/* Outer glow aura */}
      <motion.div
        animate={{
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: index * 0.7,
        }}
        className="absolute -inset-4 rounded-2xl pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255, 60, 60, 0.08) 0%, transparent 70%)',
          filter: 'blur(8px)',
        }}
      />

      {/* CSS for additional effects */}
      <style>{`
        @keyframes cubeFloat {
          0%, 100% {
            transform: translateY(0) rotateX(-15deg) rotateY(20deg);
          }
          50% {
            transform: translateY(-8px) rotateX(-14deg) rotateY(21deg);
          }
        }
      `}</style>
    </motion.div>
  );
}
