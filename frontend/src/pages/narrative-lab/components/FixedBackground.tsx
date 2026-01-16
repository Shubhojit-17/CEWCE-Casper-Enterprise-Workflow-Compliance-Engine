/**
 * FixedBackground - Fixed constellation canvas that covers the entire viewport
 * 
 * This component stays fixed during scrolling, providing a consistent
 * animated background across all sections of the landing page.
 */
import { useRef, useState } from 'react';
import { useConstellationCanvas } from '../hooks/useConstellationCanvas';

export function FixedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady, setIsReady] = useState(false);

  // Initialize constellation canvas with onReady callback
  useConstellationCanvas(
    canvasRef,
    () => setIsReady(true),
    {
      nodeCount: 120,
      connectionDistance: 150,
      mouseInfluenceRadius: 250,
    }
  );

  return (
    <div 
      className="fixed inset-0 pointer-events-none"
      style={{ 
        zIndex: 0,
        backgroundColor: '#0A0A0B',
      }}
    >
      {/* Noise Texture Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
        }}
      />

      {/* Constellation Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ 
          opacity: isReady ? 0.85 : 0,
          transition: 'opacity 0.8s ease-out',
        }}
      />

      {/* Atmospheric gradient overlay - subtle depth */}
      <div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% 0%, rgba(127, 29, 29, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 20% 80%, rgba(127, 29, 29, 0.05) 0%, transparent 40%),
            radial-gradient(ellipse 50% 30% at 80% 60%, rgba(51, 65, 85, 0.04) 0%, transparent 40%)
          `,
        }}
      />
    </div>
  );
}
