// =============================================================================
// Particle Constellation Background
// Uses tsparticles for subtle floating particle effect
// =============================================================================

import { useEffect, useState } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import type { ISourceOptions } from '@tsparticles/engine';

const particlesConfig: ISourceOptions = {
  fullScreen: false,
  fpsLimit: 60,
  particles: {
    number: {
      value: 60,
      density: {
        enable: true,
        width: 800,
        height: 800,
      },
    },
    color: {
      value: ['#ff3333', '#ff6666', '#ffffff', '#ffcccc'],
    },
    shape: {
      type: 'circle',
    },
    opacity: {
      value: { min: 0.3, max: 0.8 },
      animation: {
        enable: true,
        speed: 0.5,
        sync: false,
      },
    },
    size: {
      value: { min: 1, max: 3 },
      animation: {
        enable: true,
        speed: 1,
        sync: false,
      },
    },
    links: {
      enable: true,
      distance: 120,
      color: '#ff4444',
      opacity: 0.2,
      width: 1,
    },
    move: {
      enable: true,
      speed: 0.5,
      direction: 'none',
      random: true,
      straight: false,
      outModes: {
        default: 'bounce',
      },
      attract: {
        enable: false,
      },
    },
  },
  interactivity: {
    detectsOn: 'canvas',
    events: {
      onHover: {
        enable: false,
      },
      onClick: {
        enable: false,
      },
      resize: {
        enable: true,
      },
    },
  },
  detectRetina: true,
  background: {
    color: 'transparent',
  },
};

export function ParticleBackground() {
  const [init, setInit] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => {
      setInit(true);
    });
  }, []);

  if (!init) {
    return null;
  }

  return (
    <Particles
      id="auth-particles"
      options={particlesConfig}
      className="absolute inset-0 z-0"
    />
  );
}
