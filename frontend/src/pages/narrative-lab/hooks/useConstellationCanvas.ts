/**
 * useConstellationCanvas - Custom hook for interactive constellation background
 * 
 * Creates an organic, living network visualization with:
 * - Floating nodes (white + Casper red)
 * - Dynamic edge connections when nodes are in proximity
 * - Subtle mouse reactivity (gentle gravitation)
 * 
 * Uses pure Canvas API with requestAnimationFrame for performance.
 */
import { useEffect, useRef, useCallback } from 'react';

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  baseX: number;
  baseY: number;
}

interface CanvasConfig {
  nodeCount?: number;
  connectionDistance?: number;
  mouseInfluenceRadius?: number;
  mouseInfluenceStrength?: number;
}

const DEFAULT_CONFIG: Required<CanvasConfig> = {
  nodeCount: 80,
  connectionDistance: 150,
  mouseInfluenceRadius: 200,
  mouseInfluenceStrength: 0.02,
};

export function useConstellationCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  config: CanvasConfig = {}
) {
  const nodesRef = useRef<Node[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animationFrameRef = useRef<number>();
  const configRef = useRef({ ...DEFAULT_CONFIG, ...config });

  // Initialize nodes with random positions and velocities
  const initializeNodes = useCallback((width: number, height: number) => {
    const { nodeCount } = configRef.current;
    const nodes: Node[] = [];
    
    // Casper brand colors
    const colors = [
      'rgba(255, 255, 255, 0.6)',  // White nodes
      'rgba(255, 255, 255, 0.4)',  // Dimmer white
      'rgba(239, 68, 68, 0.7)',    // Casper red (red-500)
      'rgba(220, 38, 38, 0.6)',    // Darker red (red-600)
    ];

    for (let i = 0; i < nodeCount; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      nodes.push({
        x,
        y,
        baseX: x,
        baseY: y,
        // Very slow, organic movement
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 1.5 + 0.5,
        // 70% white, 30% red distribution
        color: colors[i < nodeCount * 0.7 
          ? Math.floor(Math.random() * 2) 
          : 2 + Math.floor(Math.random() * 2)
        ],
      });
    }
    
    nodesRef.current = nodes;
  }, []);

  // Main animation loop
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { connectionDistance, mouseInfluenceRadius, mouseInfluenceStrength } = configRef.current;
    const width = canvas.width;
    const height = canvas.height;
    const mouse = mouseRef.current;
    const nodes = nodesRef.current;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Update and draw nodes
    nodes.forEach((node, i) => {
      // Apply subtle mouse influence (gentle gravitation)
      const dx = mouse.x - node.x;
      const dy = mouse.y - node.y;
      const distToMouse = Math.sqrt(dx * dx + dy * dy);
      
      if (distToMouse < mouseInfluenceRadius && distToMouse > 0) {
        // Gentle pull toward cursor
        const force = (1 - distToMouse / mouseInfluenceRadius) * mouseInfluenceStrength;
        node.vx += dx * force;
        node.vy += dy * force;
      }

      // Return to base position with very gentle spring
      const returnForce = 0.0005;
      node.vx += (node.baseX - node.x) * returnForce;
      node.vy += (node.baseY - node.y) * returnForce;

      // Apply velocity with damping
      node.vx *= 0.99;
      node.vy *= 0.99;
      node.x += node.vx;
      node.y += node.vy;

      // Soft boundary wrapping
      if (node.x < -50) node.x = width + 50;
      if (node.x > width + 50) node.x = -50;
      if (node.y < -50) node.y = height + 50;
      if (node.y > height + 50) node.y = -50;

      // Draw connections to nearby nodes
      for (let j = i + 1; j < nodes.length; j++) {
        const other = nodes[j];
        const edgeDx = other.x - node.x;
        const edgeDy = other.y - node.y;
        const distance = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy);

        if (distance < connectionDistance) {
          // Opacity based on distance (closer = more visible)
          const opacity = (1 - distance / connectionDistance) * 0.15;
          
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(other.x, other.y);
          
          // Subtle glow effect via gradient
          const gradient = ctx.createLinearGradient(node.x, node.y, other.x, other.y);
          gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
          gradient.addColorStop(0.5, `rgba(239, 68, 68, ${opacity * 0.5})`);
          gradient.addColorStop(1, `rgba(255, 255, 255, ${opacity})`);
          
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }

      // Draw node
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.fill();
    });

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [canvasRef]);

  // Handle mouse movement
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, [canvasRef]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    mouseRef.current = { x: -1000, y: -1000 };
  }, []);

  // Handle resize
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    // Set canvas size to match parent
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;

    // Reinitialize nodes for new dimensions
    initializeNodes(canvas.width, canvas.height);
  }, [canvasRef, initializeNodes]);

  // Setup and cleanup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initial setup
    handleResize();

    // Start animation
    animate();

    // Event listeners
    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      // Cleanup
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [canvasRef, animate, handleResize, handleMouseMove, handleMouseLeave]);
}
