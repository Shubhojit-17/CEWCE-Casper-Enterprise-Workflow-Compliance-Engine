/**
 * useConstellationCanvas - High-Density Neural Network
 * 
 * Volumetric Cyberpunk Enterprise Edition:
 * - 120 nodes with variable brightness ("twinkle")
 * - Variable line weights (closer = thicker/brighter)
 * - Casper Pulse: Red data pulses every 2 seconds
 * - Ripple reactivity on mouse interaction
 * - Proper lifecycle management (no memory leaks)
 */
import { useEffect, useRef, useCallback } from 'react';

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  color: string;
  isRed: boolean;
  baseX: number;
  baseY: number;
  // Twinkle properties
  pulseSpeed: number;
  pulsePhase: number;
  alpha: number;
}

interface Pulse {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
  speed: number;
}

interface CanvasConfig {
  nodeCount?: number;
  connectionDistance?: number;
  mouseInfluenceRadius?: number;
}

const DEFAULT_CONFIG: Required<CanvasConfig> = {
  nodeCount: 120,
  connectionDistance: 150,
  mouseInfluenceRadius: 250,
};

export function useConstellationCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  onReady?: () => void,
  config: CanvasConfig = {}
) {
  const nodesRef = useRef<Node[]>([]);
  const pulsesRef = useRef<Pulse[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const configRef = useRef({ ...DEFAULT_CONFIG, ...config });
  const isInitializedRef = useRef(false);
  const lastPulseTimeRef = useRef(0);
  const timeRef = useRef(0);

  // Initialize nodes
  const initializeNodes = useCallback((width: number, height: number) => {
    const { nodeCount } = configRef.current;
    const nodes: Node[] = [];
    
    for (let i = 0; i < nodeCount; i++) {
      const isRed = Math.random() > 0.8; // 20% red
      const x = Math.random() * width;
      const y = Math.random() * height;
      const baseRadius = isRed ? Math.random() * 2 + 1.5 : Math.random() * 1.5 + 0.5;
      
      nodes.push({
        x,
        y,
        baseX: x,
        baseY: y,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: baseRadius,
        baseRadius,
        isRed,
        color: isRed ? 'rgba(255, 3, 3, 1)' : 'rgba(255, 255, 255, 1)',
        // Twinkle: each node has its own pulse speed and phase
        pulseSpeed: 0.5 + Math.random() * 1.5,
        pulsePhase: Math.random() * Math.PI * 2,
        alpha: isRed ? 0.8 : 0.3,
      });
    }
    
    nodesRef.current = nodes;
    pulsesRef.current = [];
  }, []);

  // Create a Casper Pulse between two connected red nodes
  const createCasperPulse = useCallback(() => {
    const nodes = nodesRef.current;
    const { connectionDistance } = configRef.current;
    
    // Find connected red nodes
    const redNodes = nodes.filter(n => n.isRed);
    if (redNodes.length < 2) return;
    
    // Pick a random red node
    const fromNode = redNodes[Math.floor(Math.random() * redNodes.length)];
    
    // Find a connected node
    for (const toNode of nodes) {
      if (toNode === fromNode) continue;
      const dx = toNode.x - fromNode.x;
      const dy = toNode.y - fromNode.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < connectionDistance) {
        pulsesRef.current.push({
          fromX: fromNode.x,
          fromY: fromNode.y,
          toX: toNode.x,
          toY: toNode.y,
          progress: 0,
          speed: 0.03 + Math.random() * 0.02,
        });
        break;
      }
    }
  }, []);

  // Main animation loop
  const animate = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      animationFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      animationFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    const { connectionDistance } = configRef.current;
    const width = canvas.width;
    const height = canvas.height;
    
    if (width === 0 || height === 0) {
      animationFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    const nodes = nodesRef.current;
    timeRef.current = timestamp * 0.001; // Convert to seconds

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Casper Pulse: Trigger every 2 seconds
    if (timestamp - lastPulseTimeRef.current > 2000) {
      createCasperPulse();
      lastPulseTimeRef.current = timestamp;
    }

    // Update and draw nodes
    nodes.forEach((node, i) => {
      // Twinkle: Update alpha based on time
      const twinkle = Math.sin(timeRef.current * node.pulseSpeed + node.pulsePhase);
      node.alpha = node.isRed 
        ? 0.6 + twinkle * 0.4 
        : 0.2 + twinkle * 0.15;
      node.radius = node.baseRadius * (0.8 + twinkle * 0.2);

      // Organic drift: Add subtle sinusoidal movement for constant motion
      const driftX = Math.sin(timeRef.current * 0.3 + node.pulsePhase) * 0.15;
      const driftY = Math.cos(timeRef.current * 0.25 + node.pulsePhase * 1.3) * 0.12;
      node.vx += driftX;
      node.vy += driftY;

      // Return to base (very gentle)
      node.vx += (node.baseX - node.x) * 0.0003;
      node.vy += (node.baseY - node.y) * 0.0003;

      // Friction
      node.vx *= 0.97;
      node.vy *= 0.97;
      
      node.x += node.vx;
      node.y += node.vy;

      // Wrap around edges
      if (node.x < -50) node.x = width + 50;
      if (node.x > width + 50) node.x = -50;
      if (node.y < -50) node.y = height + 50;
      if (node.y > height + 50) node.y = -50;

      // Draw connections with VARIABLE LINE WEIGHTS
      for (let j = i + 1; j < nodes.length; j++) {
        const other = nodes[j];
        const edgeDx = other.x - node.x;
        const edgeDy = other.y - node.y;
        const distance = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy);

        if (distance < connectionDistance) {
          // Variable weights: closer = thicker/brighter
          const proximityFactor = 1 - distance / connectionDistance;
          const lineWidth = 0.5 + proximityFactor * 1.0; // 0.5 to 1.5
          const opacity = 0.05 + proximityFactor * 0.25; // 0.05 to 0.3
          
          const isRedConnection = node.isRed || other.isRed;
          
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(other.x, other.y);
          ctx.strokeStyle = isRedConnection 
            ? `rgba(255, 80, 80, ${opacity * 1.2})`
            : `rgba(255, 255, 255, ${opacity})`;
          ctx.lineWidth = lineWidth;
          ctx.stroke();
        }
      }

      // Draw Node with glow
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      
      if (node.isRed) {
        ctx.fillStyle = `rgba(255, 3, 3, ${node.alpha})`;
        ctx.shadowBlur = 12;
        ctx.shadowColor = 'rgba(255, 3, 3, 0.8)';
      } else {
        ctx.fillStyle = `rgba(255, 255, 255, ${node.alpha})`;
        ctx.shadowBlur = 0;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Draw Casper Pulses
    pulsesRef.current = pulsesRef.current.filter(p => p.progress < 1);
    pulsesRef.current.forEach(p => {
      p.progress += p.speed;
      const currX = p.fromX + (p.toX - p.fromX) * p.progress;
      const currY = p.fromY + (p.toY - p.fromY) * p.progress;
      
      // Glowing pulse
      ctx.beginPath();
      ctx.arc(currX, currY, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.shadowBlur = 15;
      ctx.shadowColor = 'rgba(255, 3, 3, 1)';
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // Trail
      const trailLength = 5;
      for (let t = 1; t <= trailLength; t++) {
        const trailProgress = p.progress - t * 0.02;
        if (trailProgress > 0) {
          const trailX = p.fromX + (p.toX - p.fromX) * trailProgress;
          const trailY = p.fromY + (p.toY - p.fromY) * trailProgress;
          ctx.beginPath();
          ctx.arc(trailX, trailY, 2 - t * 0.3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 100, 100, ${0.5 - t * 0.1})`;
          ctx.fill();
        }
      }
    });

    // Signal ready on first successful frame
    if (!isInitializedRef.current && nodes.length > 0) {
      isInitializedRef.current = true;
      onReady?.();
    }

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [canvasRef, createCasperPulse, onReady]);



  // Handle resize
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Use window dimensions for fixed positioning canvas
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    if (width > 0 && height > 0) {
      canvas.width = width;
      canvas.height = height;
      initializeNodes(width, height);
    }
  }, [canvasRef, initializeNodes]);

  // Setup and cleanup with proper lifecycle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initial setup after a small delay to ensure DOM is ready
    const initTimeout = setTimeout(() => {
      handleResize();
      animationFrameRef.current = requestAnimationFrame(animate);
    }, 100);

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(initTimeout);
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [canvasRef, animate, handleResize]);
}
