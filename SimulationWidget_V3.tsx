import React, { useState, useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
}

interface GWWave {
  r: number;
  maxR: number;
  speed: number;
  alpha: number;
  color: string;
  isConvertible: boolean;
}

interface RadioPhoton {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
}

interface Pulsar {
  x: number;
  y: number;
  z: number;
  pulsePeriod: number;
  pulsePhase: number;
  jitter: number;
  name: string;
  color: string;
}

export const SimulationWidget_V3: React.FC = () => {
  const [simMode, setSimMode] = useState<'web' | 'quake' | 'pointing'>('web');

  // Mode A Parameters
  const [phaseMismatch, setPhaseMismatch] = useState<number>(1.8); // 0 (constructive) to PI (destructive)
  const [baryonPressure, setBaryonPressure] = useState<number>(0.6); // Random thermal noise

  // Mode B Parameters
  const [slipVelocity, setSlipVelocity] = useState<number>(0.8); // Speed of stress build-up
  const [ruptureThreshold, setRuptureThreshold] = useState<number>(75); // S_crit

  // Global refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const gwWavesRef = useRef<GWWave[]>([]);
  const photonsRef = useRef<RadioPhoton[]>([]);
  const requestRef = useRef<number | null>(null);
  const frameCountRef = useRef<number>(0);
  const stressRef = useRef<number>(0);
  const stressHistoryRef = useRef<number[]>([]);
  const gertsenshteinFlashRef = useRef<number>(0); // Flash alpha

  // Mode C state
  const pulsarsRef = useRef<Pulsar[]>([]);
  const pointingStatusRef = useRef<'scanning' | 'warning' | 'locked' | 'burst'>('scanning');
  const targetIndexRef = useRef<number>(0);
  const reticlePosRef = useRef<{ x: number; y: number }>({ x: 300, y: 210 });
  const pointingProgressRef = useRef<number>(0); // 0 to 100

  // 3D View angle tracking for Mode B/C
  const angleXRef = useRef<number>(15 * Math.PI / 180);
  const angleYRef = useRef<number>(30 * Math.PI / 180);
  const isDragging = useRef<boolean>(false);
  const prevMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const resetSimulation = () => {
    particlesRef.current = [];
    gwWavesRef.current = [];
    photonsRef.current = [];
    stressRef.current = 0;
    stressHistoryRef.current = Array(120).fill(0);
    gertsenshteinFlashRef.current = 0;
    frameCountRef.current = 0;

    // Mode C Reset
    pointingStatusRef.current = 'scanning';
    pointingProgressRef.current = 0;
    targetIndexRef.current = 0;

    // Initialize particles for Mode A (Cosmic Web)
    if (simMode === 'web') {
      for (let i = 0; i < 280; i++) {
        particlesRef.current.push({
          x: Math.random() * 600,
          y: Math.random() * 420,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          size: 1 + Math.random() * 2,
          color: `hsl(${180 + Math.random() * 40}, 75%, ${70 + Math.random() * 20}%)`
        });
      }
    }

    // Initialize Pulsars for Mode C
    if (simMode === 'pointing') {
      const names = ['Pulsar A', 'Pulsar B', 'Pulsar C', 'Pulsar D', 'Pulsar E', 'Pulsar F', 'Pulsar G'];
      const colors = ['#3b82f6', '#60a5fa', '#34d399', '#a855f7', '#fbbf24', '#f87171', '#38bdf8'];
      pulsarsRef.current = [];
      for (let i = 0; i < 7; i++) {
        // Distribute in 3D coordinate space
        const theta = (i / 7) * 2 * Math.PI;
        const radius = 100 + Math.random() * 60;
        pulsarsRef.current.push({
          x: Math.cos(theta) * radius,
          y: Math.sin(theta) * radius,
          z: (Math.random() - 0.5) * 80,
          pulsePeriod: 25 + Math.floor(Math.random() * 25),
          pulsePhase: Math.random() * 100,
          jitter: 0,
          name: names[i],
          color: colors[i]
        });
      }
    }
  };

  useEffect(() => {
    resetSimulation();
  }, [simMode, phaseMismatch, baryonPressure, slipVelocity, ruptureThreshold]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (simMode === 'web') return;
    isDragging.current = true;
    prevMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging.current || simMode === 'web') return;
    const dx = e.clientX - prevMousePos.current.x;
    const dy = e.clientY - prevMousePos.current.y;
    angleYRef.current += dx * 0.007;
    angleXRef.current = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, angleXRef.current - dy * 0.007));
    prevMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUpOrLeave = () => {
    isDragging.current = false;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ① Retina display DPI scaling
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 600 * dpr;
    canvas.height = 420 * dpr;
    canvas.style.width = '100%';
    canvas.style.maxWidth = '600px';
    canvas.style.height = 'auto';
    ctx.scale(dpr, dpr);

    let animId: number;

    const render = () => {
      frameCountRef.current += 1;
      const width = 600;
      const height = 420;

      // Dark Cosmic background
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, width, height);

      // ③ Glow effect via Screen Blend Mode
      ctx.globalCompositeOperation = 'screen';

      if (simMode === 'web') {
        // ==========================================
        // Mode A: Cosmic Web Emergence (Interference)
        // ==========================================
        const cx = width * 0.65;
        const cy = height / 2;

        // Define fault grid lines
        const vertX = cx;
        const horizY = cy;

        // Draw phase domain boundaries (visual representation of fault lines)
        // Check if phaseMismatch is constructive (near 0) or destructive (near PI)
        const isVertConstructive = (phaseMismatch < 1.0);
        const isHorizConstructive = (phaseMismatch < 1.4);

        // Draw domains labels
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = 'rgba(113, 113, 122, 0.4)';
        ctx.fillText(`Domain 0 (θ=0)`, cx - 120, cy - 80);
        ctx.fillText(`Domain 1 (θ=${phaseMismatch.toFixed(2)})`, cx + 60, cy - 80);
        ctx.fillText(`Domain 2 (θ=0)`, cx - 120, cy + 90);
        ctx.fillText(`Domain 3 (θ=${phaseMismatch.toFixed(2)})`, cx + 60, cy + 90);

        // Update & Render matter particles
        particlesRef.current.forEach((p) => {
          // Compute drift force based on distance to boundaries
          const dx = p.x - vertX;
          const dy = p.y - horizY;

          let forceX = 0;
          let forceY = 0;

          // Vertical fault force (attract if constructive, repel if destructive)
          const distSqX = dx * dx + 800;
          if (isVertConstructive) {
            forceX = -dx * 0.08 / distSqX; // Attraction
          } else {
            forceX = dx * (phaseMismatch * 0.08) / distSqX; // Repulsion
          }

          // Horizontal fault force
          const distSqY = dy * dy + 800;
          if (isHorizConstructive) {
            forceY = -dy * 0.06 / distSqY; // Attraction
          } else {
            forceY = dy * (phaseMismatch * 0.06) / distSqY; // Repulsion
          }

          // Apply forces & baryon pressure noise
          p.vx += forceX + (Math.random() - 0.5) * baryonPressure * 0.15;
          p.vy += forceY + (Math.random() - 0.5) * baryonPressure * 0.15;

          // Drag / friction to avoid infinite acceleration
          p.vx *= 0.95;
          p.vy *= 0.95;

          p.x += p.vx;
          p.y += p.vy;

          // Boundary bounce
          if (p.x < 240) { p.x = 240; p.vx *= -1; }
          if (p.x > width) { p.x = width; p.vx *= -1; }
          if (p.y < 0) { p.y = 0; p.vy *= -1; }
          if (p.y > height) { p.y = height; p.vy *= -1; }

          // Draw particle
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI);
          ctx.fill();
        });

        // Draw Glowing Fault lines
        ctx.save();
        // Vertical Fault Line
        ctx.strokeStyle = isVertConstructive ? 'rgba(16, 185, 129, 0.45)' : 'rgba(168, 85, 247, 0.2)';
        ctx.shadowColor = isVertConstructive ? '#10b981' : '#a855f7';
        ctx.shadowBlur = isVertConstructive ? 8 : 2;
        ctx.lineWidth = isVertConstructive ? 3.0 : 1.5;
        if (!isVertConstructive) ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(vertX, 10);
        ctx.lineTo(vertX, height - 10);
        ctx.stroke();

        // Horizontal Fault Line
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = isHorizConstructive ? 'rgba(16, 185, 129, 0.45)' : 'rgba(168, 85, 247, 0.2)';
        ctx.shadowColor = isHorizConstructive ? '#10b981' : '#a855f7';
        ctx.shadowBlur = isHorizConstructive ? 8 : 2;
        ctx.lineWidth = isHorizConstructive ? 3.0 : 1.5;
        if (!isHorizConstructive) ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(250, horizY);
        ctx.lineTo(width - 10, horizY);
        ctx.stroke();
        ctx.restore();

        // Reset composite operation for UI drawing
        ctx.globalCompositeOperation = 'source-over';

        // Left Side Panel: Density Profile Graph
        const gx = 45;
        const gy = 80;
        const gw = 170;
        const gh = 240;

        ctx.save();
        ctx.strokeStyle = '#27272a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(gx - 10, gy - 20, gw + 20, gh + 40, 8);
        ctx.stroke();
        ctx.fillStyle = 'rgba(9, 9, 11, 0.7)';
        ctx.fill();

        ctx.strokeStyle = '#3f3f46';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx, gy + gh);
        ctx.lineTo(gx + gw, gy + gh);
        ctx.stroke();

        // Axis Labels
        ctx.fillStyle = '#a1a1aa';
        ctx.font = '8px monospace';
        ctx.fillText('Matter Density', gx - 5, gy - 8);
        ctx.fillText('X Profile (Void->Filament)', gx + 15, gy + gh + 12);

        // Draw theoretical density distribution curve
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let x = 0; x <= gw; x++) {
          const normX = (x / gw) - 0.5; // -0.5 to 0.5
          // Sigmoid/Exponential mapping representing constructive peak or empty void
          let val = 0;
          if (isVertConstructive) {
            val = Math.exp(-normX * normX * 18.0) * (gh - 30);
          } else {
            val = (1.0 - Math.exp(-normX * normX * 8.0)) * (gh - 50) + 10;
          }
          const px = gx + x;
          const py = gy + gh - val;
          x === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Legend details
        ctx.font = 'bold 8.5px monospace';
        ctx.fillStyle = isVertConstructive ? '#10b981' : '#a855f7';
        ctx.fillText(isVertConstructive ? 'Constructive (Filament)' : 'Destructive (Void)', gx + 15, gy + 18);
        ctx.fillStyle = '#71717a';
        ctx.fillText(`Phase Discordance: Δθ=${phaseMismatch.toFixed(2)}`, gx + 15, gy + 32);
        ctx.restore();

        // Title Info
        ctx.fillStyle = '#f4f4f5';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('COSMIC WEB EMERGENCE (INTERFERENCE)', 20, 30);

      } else if (simMode === 'quake') {
        // ==========================================
        // Mode B: Cosmic Quake & Gertsenshtein Converter
        // ==========================================
        const centerX = width * 0.62;
        const centerY = height / 2;
        const scale = 50;

        // 3D projection helper
        const project = (x: number, y: number, z: number) => {
          const cosY = Math.cos(angleYRef.current), sinY = Math.sin(angleYRef.current);
          const x1 = x * cosY - y * sinY;
          const y1 = x * sinY + y * cosY;
          const cosX = Math.cos(angleXRef.current), sinX = Math.sin(angleXRef.current);
          const z2 = z * cosX - y1 * sinX;
          const y2 = z * sinX + y1 * cosX;
          const projX = (x1 * 8) / (y2 + 8) * scale + centerX;
          const projY = centerY - (z2 * 8) / (z2 + 8) * scale;
          return { px: projX, py: projY, depth: y2 };
        };

        // Update Stress
        stressRef.current += slipVelocity * 0.2;
        stressHistoryRef.current.push(stressRef.current);
        if (stressHistoryRef.current.length > 120) stressHistoryRef.current.shift();

        // Check for Rupture Trigger
        let didRupture = false;
        if (stressRef.current >= ruptureThreshold) {
          stressRef.current = 0;
          didRupture = true;

          // Spawn high-frequency GW burst rings
          for (let i = 0; i < 4; i++) {
            gwWavesRef.current.push({
              r: 5,
              maxR: 200,
              speed: 4 + i * 0.6,
              alpha: 1.0,
              color: '#a855f7',
              isConvertible: true
            });
          }
        }

        // Stick-slip micro-vibrations (nHz background ripples)
        if (frameCountRef.current % 30 === 0 && stressRef.current > 15) {
          gwWavesRef.current.push({
            r: 5,
            maxR: 120,
            speed: 1.5,
            alpha: 0.4,
            color: '#3b82f6', // nHz waves are blue
            isConvertible: false
          });
        }

        // Draw 3D tectonic fault grids (deforming near x = 0 based on stress)
        ctx.strokeStyle = 'rgba(63, 63, 70, 0.3)';
        ctx.lineWidth = 0.8;

        const uSteps = 10, vSteps = 10;
        const gridPoints: { px: number; py: number; depth: number }[][] = [];

        for (let i = 0; i <= uSteps; i++) {
          const u = (i / uSteps - 0.5) * 200;
          gridPoints[i] = [];
          for (let j = 0; j <= vSteps; j++) {
            const v = (j / vSteps - 0.5) * 200;

            // Shift plates vertically (Tectonic sliding)
            // Left plate (u < 0) slides down, right plate (u >= 0) slides up
            let slipOffset = (u < 0) ? -stressRef.current * 0.15 : stressRef.current * 0.15;

            // Elastic locking deformation: grid lines pull and bend at the interface boundary u=0
            const decay = Math.exp(-Math.abs(u) * 0.03);
            slipOffset *= (1.0 - decay);

            gridPoints[i].push(project(u, v, slipOffset));
          }
        }

        // Render space grid lines
        for (let i = 0; i <= uSteps; i++) {
          ctx.beginPath();
          for (let j = 0; j <= vSteps; j++) {
            j === 0 ? ctx.moveTo(gridPoints[i][j].px, gridPoints[i][j].py) : ctx.lineTo(gridPoints[i][j].px, gridPoints[i][j].py);
          }
          ctx.stroke();
        }
        for (let j = 0; j <= vSteps; j++) {
          ctx.beginPath();
          for (let i = 0; i <= uSteps; i++) {
            i === 0 ? ctx.moveTo(gridPoints[i][j].px, gridPoints[i][j].py) : ctx.lineTo(gridPoints[i][j].px, gridPoints[i][j].py);
          }
          ctx.stroke();
        }

        // Draw Fault interface (sliding boundary)
        ctx.save();
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.45)';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        const topFaultProj = project(0, -100, 0);
        const bottomFaultProj = project(0, 100, 0);
        ctx.moveTo(topFaultProj.px, topFaultProj.py);
        ctx.lineTo(bottomFaultProj.px, bottomFaultProj.py);
        ctx.stroke();
        ctx.restore();

        // Gertsenshtein Converter Zone (strong magnetic column) at u = 55
        const magColZ = 55;
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.lineWidth = 12;
        const topMagProj = project(magColZ, -100, 0);
        const bottomMagProj = project(magColZ, 100, 0);
        ctx.beginPath();
        ctx.moveTo(topMagProj.px, topMagProj.py);
        ctx.lineTo(bottomMagProj.px, bottomMagProj.py);
        ctx.stroke();
        ctx.restore();

        // Render waves (GW) and handle Gertsenshtein conversion
        const centerProj = project(0, 0, 0);

        gwWavesRef.current.forEach((w) => {
          w.r += w.speed;
          w.alpha -= 0.007;

          // Draw wave ring
          ctx.save();
          ctx.strokeStyle = w.color;
          ctx.globalAlpha = Math.max(0, w.alpha);
          ctx.lineWidth = w.color === '#a855f7' ? 2.0 : 1.0;
          ctx.beginPath();
          ctx.arc(centerProj.px, centerProj.py, w.r, 0, 2 * Math.PI);
          ctx.stroke();
          ctx.restore();

          // Gertsenshtein conversion condition:
          if (w.isConvertible && w.r > 38 && w.r < 46) {
            w.isConvertible = false; // Convert once
            gertsenshteinFlashRef.current = 1.0; // Trigger screen flash

            // Spawn radio photons shooting left and right
            for (let angle = 0; angle < 2 * Math.PI; angle += Math.PI / 4) {
              photonsRef.current.push({
                x: centerProj.px + Math.cos(angle) * w.r,
                y: centerProj.py + Math.sin(angle) * w.r,
                vx: Math.cos(angle) * 7.5,
                vy: Math.sin(angle) * 7.5,
                color: '#fbbf24', // EM is golden yellow
                alpha: 1.0
              });
            }
          }
        });
        gwWavesRef.current = gwWavesRef.current.filter((w) => w.alpha > 0);

        // Render EM Radio Photons (FRB bursts)
        photonsRef.current.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 0.015;

          ctx.save();
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#fbbf24';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.5, 0, 2 * Math.PI);
          ctx.fill();
          ctx.restore();
        });
        photonsRef.current = photonsRef.current.filter((p) => p.alpha > 0);

        // Draw Gertsenshtein Conversion Warning
        if (gertsenshteinFlashRef.current > 0) {
          ctx.save();
          ctx.fillStyle = `rgba(251, 191, 36, ${gertsenshteinFlashRef.current * 0.12})`;
          ctx.fillRect(0, 0, width, height);

          ctx.font = 'bold 8.5px monospace';
          ctx.fillStyle = `rgba(251, 191, 36, ${gertsenshteinFlashRef.current})`;
          ctx.fillText('⚡ GERTSENSHTEIN CONVERSION (GW ➝ EM FRB)', centerProj.px - 100, centerProj.py - 120);
          ctx.restore();

          gertsenshteinFlashRef.current -= 0.035;
        }

        // Reset composite operation for UI drawing
        ctx.globalCompositeOperation = 'source-over';

        // Left Side Panel: Seismograph Graph
        const gx = 45;
        const gy = 80;
        const gw = 170;
        const gh = 100;

        ctx.save();
        ctx.strokeStyle = '#27272a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(gx - 10, gy - 20, gw + 20, gh + 40, 8);
        ctx.stroke();
        ctx.fillStyle = 'rgba(9, 9, 11, 0.7)';
        ctx.fill();

        ctx.strokeStyle = '#3f3f46';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx, gy + gh);
        ctx.lineTo(gx + gw, gy + gh);
        ctx.stroke();

        ctx.fillStyle = '#a1a1aa';
        ctx.font = '8px monospace';
        ctx.fillText('Stress S_μν', gx - 5, gy - 8);
        ctx.fillText('t (Time)', gx + gw - 35, gy + gh + 12);

        // Plot stress history
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        stressHistoryRef.current.forEach((val, idx) => {
          const px = gx + (idx / 120) * gw;
          const py = gy + gh - (val / ruptureThreshold) * (gh - 15);
          idx === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        });
        ctx.stroke();
        ctx.restore();

        // Left Side Panel Bottom: Frequency Spectrum
        const gx2 = 45;
        const gy2 = 230;
        const gw2 = 170;
        const gh2 = 100;

        ctx.save();
        ctx.strokeStyle = '#27272a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(gx2 - 10, gy2 - 20, gw2 + 20, gh2 + 40, 8);
        ctx.stroke();
        ctx.fillStyle = 'rgba(9, 9, 11, 0.7)';
        ctx.fill();

        ctx.strokeStyle = '#3f3f46';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(gx2, gy2);
        ctx.lineTo(gx2, gy2 + gh2);
        ctx.lineTo(gx2 + gw2, gy2 + gh2);
        ctx.stroke();

        ctx.fillStyle = '#a1a1aa';
        ctx.font = '8px monospace';
        ctx.fillText('Power P(f)', gx2 - 5, gy2 - 8);
        ctx.fillText('f (nHz ➝ GHz)', gx2 + gw2 - 65, gy2 + gh2 + 12);

        // Plot frequency spectrum
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let f = 0; f <= gw2; f++) {
          const normF = f / gw2;
          let val = 0;
          // nHz background noise spike
          const nHzSpike = Math.exp(-normF * normF * 120) * (stressRef.current * 0.35);
          // GHz rupture burst spike (flashing on rupture)
          const isQuaking = (stressRef.current < 5 && stressHistoryRef.current[stressHistoryRef.current.length - 2] > ruptureThreshold - 5);
          const ghzSpike = isQuaking ? Math.exp(-(normF - 0.85) * (normF - 0.85) * 80) * (gh2 - 20) : 0;
          
          val = nHzSpike + ghzSpike + Math.random() * 2;
          const px = gx2 + f;
          const py = gy2 + gh2 - val;
          f === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();

        // UI Tips
        ctx.fillStyle = '#9ca3af';
        ctx.font = '9px monospace';
        ctx.fillText('🔄 Click & Drag canvas to rotate fault plane geometry', 20, height - 20);

        // Title Info
        ctx.fillStyle = '#f4f4f5';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('COSMIC QUAKE & GERTSENSHTEIN EFFECT', 20, 30);

      } else if (simMode === 'pointing') {
        // ==========================================
        // Mode C: POINTING Early Warning Protocol
        // ==========================================
        const centerX = width * 0.65;
        const centerY = height / 2;
        const scale = 50;

        const project = (x: number, y: number, z: number) => {
          const cosY = Math.cos(angleYRef.current), sinY = Math.sin(angleYRef.current);
          const x1 = x * cosY - y * sinY;
          const y1 = x * sinY + y * cosY;
          const cosX = Math.cos(angleXRef.current), sinX = Math.sin(angleXRef.current);
          const z2 = z * cosX - y1 * sinX;
          const y2 = z * sinX + y1 * cosX;
          const projX = (x1 * 8) / (y2 + 8) * scale + centerX;
          const projY = centerY - (z2 * 8) / (z2 + 8) * scale;
          return { px: projX, py: projY, depth: y2 };
        };

        // Scenario state machine logic
        pointingProgressRef.current += 0.5; // Climb stress simulation
        if (pointingProgressRef.current > 100) {
          pointingProgressRef.current = 0;
          pointingStatusRef.current = 'scanning';
        }

        const progress = pointingProgressRef.current;
        let activeStatus = pointingStatusRef.current;

        // Transitions based on progress
        if (progress > 85) {
          activeStatus = 'burst';
        } else if (progress > 60) {
          activeStatus = 'locked';
        } else if (progress > 38) {
          activeStatus = 'warning';
        } else {
          activeStatus = 'scanning';
        }

        // Pick a target index once at the beginning of warning
        if (progress > 38 && progress < 39) {
          targetIndexRef.current = Math.floor(Math.random() * pulsarsRef.current.length);
        }

        // Draw connections / constellation lines
        ctx.strokeStyle = 'rgba(63, 63, 70, 0.15)';
        ctx.lineWidth = 0.8;
        const pulsarPoints = pulsarsRef.current.map((p) => {
          const jitterVal = activeStatus !== 'scanning' ? (Math.random() - 0.5) * (progress * 0.12) : 0;
          return project(p.x + jitterVal, p.y + jitterVal, p.z);
        });

        for (let i = 0; i < pulsarPoints.length; i++) {
          ctx.beginPath();
          ctx.moveTo(pulsarPoints[i].px, pulsarPoints[i].py);
          const nextIndex = (i + 1) % pulsarPoints.length;
          ctx.lineTo(pulsarPoints[nextIndex].px, pulsarPoints[nextIndex].py);
          ctx.stroke();
        }

        // Draw Pulsars (stars)
        pulsarsRef.current.forEach((p, idx) => {
          const pt = pulsarPoints[idx];

          // Compute pulse size using modulo phase
          const pulseVal = Math.sin(frameCountRef.current * (2 * Math.PI / p.pulsePeriod) + p.pulsePhase);
          const isTarget = (idx === targetIndexRef.current && activeStatus !== 'scanning');

          ctx.save();
          ctx.shadowBlur = isTarget ? 15 : 6;
          ctx.shadowColor = p.color;

          // Draw Core Pulsar Sphere
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(pt.px, pt.py, 4 + pulseVal * 2, 0, 2 * Math.PI);
          ctx.fill();
          ctx.restore();

          // Draw Pulsar beams (concentric pulses propagating)
          if (frameCountRef.current % 12 === 0) {
            ctx.save();
            ctx.strokeStyle = p.color + '33';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(pt.px, pt.py, 15 + pulseVal * 8, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.restore();
          }

          // Pulsar Label
          ctx.fillStyle = '#71717a';
          ctx.font = '8px monospace';
          ctx.fillText(p.name, pt.px - 15, pt.py - 10);
        });

        // Reticle Tracking Scenario
        const targetPt = pulsarPoints[targetIndexRef.current];
        if (activeStatus === 'warning') {
          // Pan reticle position towards target
          reticlePosRef.current.x += (targetPt.px - reticlePosRef.current.x) * 0.1;
          reticlePosRef.current.y += (targetPt.py - reticlePosRef.current.y) * 0.1;

          // Draw Scanning reticle
          ctx.save();
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(reticlePosRef.current.x, reticlePosRef.current.y, 22, 0, 2 * Math.PI);
          ctx.stroke();

          // Draw crosshair lines
          ctx.beginPath();
          ctx.moveTo(reticlePosRef.current.x - 30, reticlePosRef.current.y);
          ctx.lineTo(reticlePosRef.current.x + 30, reticlePosRef.current.y);
          ctx.moveTo(reticlePosRef.current.x, reticlePosRef.current.y - 30);
          ctx.lineTo(reticlePosRef.current.x, reticlePosRef.current.y + 30);
          ctx.stroke();
          ctx.restore();

        } else if (activeStatus === 'locked' || activeStatus === 'burst') {
          // Lock onto target coordinate
          reticlePosRef.current = { x: targetPt.px, y: targetPt.py };

          // Draw Lock Box
          ctx.save();
          ctx.strokeStyle = activeStatus === 'burst' ? '#ef4444' : '#10b981';
          ctx.lineWidth = 1.8;
          ctx.strokeRect(reticlePosRef.current.x - 18, reticlePosRef.current.y - 18, 36, 36);

          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = activeStatus === 'burst' ? '#ef4444' : '#10b981';
          ctx.fillText(activeStatus === 'burst' ? 'BURST DETECTED!' : 'POINTING LOCKED', reticlePosRef.current.x - 40, reticlePosRef.current.y - 24);
          ctx.restore();

          // Spawn Rupture Explosion rings on Burst
          if (activeStatus === 'burst' && progress > 86 && progress < 88) {
            gwWavesRef.current.push({
              r: 2,
              maxR: 90,
              speed: 4.5,
              alpha: 1.0,
              color: '#fbbf24', // EM flare
              isConvertible: false
            });
          }
        }

        // Draw POINTING warnings & flares
        gwWavesRef.current.forEach((w) => {
          w.r += w.speed;
          w.alpha -= 0.02;
          ctx.save();
          ctx.strokeStyle = w.color;
          ctx.globalAlpha = Math.max(0, w.alpha);
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(reticlePosRef.current.x, reticlePosRef.current.y, w.r, 0, 2 * Math.PI);
          ctx.stroke();
          ctx.restore();
        });
        gwWavesRef.current = gwWavesRef.current.filter((w) => w.alpha > 0);

        // Reset composite operation for UI drawing
        ctx.globalCompositeOperation = 'source-over';

        // Left Side Panel: Neural Network Analyzer
        const gx = 45;
        const gy = 80;
        const gw = 170;
        const gh = 100;

        ctx.save();
        ctx.strokeStyle = '#27272a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(gx - 10, gy - 20, gw + 20, gh + 40, 8);
        ctx.stroke();
        ctx.fillStyle = 'rgba(9, 9, 11, 0.7)';
        ctx.fill();

        ctx.fillStyle = '#a1a1aa';
        ctx.font = '8px monospace';
        ctx.fillText('Neural Net Signal Decoder', gx - 5, gy - 8);

        // Draw Neural Network Nodes (3 Input, 4 Hidden, 2 Output)
        const inputs = [25, 50, 75];
        const hiddens = [15, 38, 62, 85];
        const outputs = [35, 65];

        // Draw node connection lines
        ctx.strokeStyle = 'rgba(113, 113, 122, 0.15)';
        ctx.lineWidth = 0.8;
        inputs.forEach(iy => {
          hiddens.forEach(hy => {
            ctx.beginPath(); ctx.moveTo(gx + 25, gy + iy); ctx.lineTo(gx + 85, gy + hy); ctx.stroke();
          });
        });
        hiddens.forEach(hy => {
          outputs.forEach(oy => {
            ctx.beginPath(); ctx.moveTo(gx + 85, gy + hy); ctx.lineTo(gx + 145, gy + oy); ctx.stroke();
          });
        });

        // Draw nodes
        const drawNode = (nx: number, ny: number, color: string, active: boolean) => {
          ctx.fillStyle = active ? color : '#27272a';
          ctx.beginPath(); ctx.arc(nx, ny, 4, 0, 2 * Math.PI); ctx.fill();
        };

        const activityColor = activeStatus === 'scanning' ? '#3b82f6' : activeStatus === 'warning' ? '#fbbf24' : '#ef4444';
        const isPulseActive = (frameCountRef.current % 10 < 5);

        inputs.forEach(iy => drawNode(gx + 25, gy + iy, '#3b82f6', isPulseActive));
        hiddens.forEach(hy => drawNode(gx + 85, gy + hy, activityColor, activeStatus !== 'scanning' && isPulseActive));
        outputs.forEach(oy => drawNode(gx + 145, gy + oy, '#10b981', activeStatus === 'locked' || activeStatus === 'burst'));

        ctx.restore();

        // Left Side Panel Bottom: Rupture Probability Gauge
        const gx2 = 45;
        const gy2 = 230;
        const gw2 = 170;
        const gh2 = 100;

        ctx.save();
        ctx.strokeStyle = '#27272a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(gx2 - 10, gy2 - 20, gw2 + 20, gh2 + 40, 8);
        ctx.stroke();
        ctx.fillStyle = 'rgba(9, 9, 11, 0.7)';
        ctx.fill();

        ctx.fillStyle = '#a1a1aa';
        ctx.font = '8px monospace';
        ctx.fillText('Rupture Probability P_quake', gx2 - 5, gy2 - 8);

        // Circular Gauge
        const rx = gx2 + gw2 / 2;
        const ry = gy2 + gh2 / 2 + 5;
        const rad = 32;

        ctx.strokeStyle = '#27272a';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(rx, ry, rad, 0, 2 * Math.PI);
        ctx.stroke();

        // Colored progress arc
        const progressRad = (progress / 100) * 2 * Math.PI;
        ctx.strokeStyle = activeStatus === 'scanning' ? '#3b82f6' : activeStatus === 'warning' ? '#fbbf24' : activeStatus === 'locked' ? '#10b981' : '#ef4444';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(rx, ry, rad, -Math.PI / 2, -Math.PI / 2 + progressRad);
        ctx.stroke();

        // Percentage text inside
        ctx.fillStyle = '#f4f4f5';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(progress)}%`, rx, ry + 3);
        ctx.restore();

        // Alert banners
        if (activeStatus === 'warning') {
          ctx.save();
          ctx.fillStyle = 'rgba(251, 191, 36, 0.1)';
          ctx.fillRect(230, 45, width - 240, 30);
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 1;
          ctx.strokeRect(230, 45, width - 240, 30);
          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('⚠️ POINTING PROTOCOL: SGWB PRECURSOR TIMING JITTER DETECTED', width * 0.62, 63);
          ctx.restore();
        } else if (activeStatus === 'locked') {
          ctx.save();
          ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
          ctx.fillRect(230, 45, width - 240, 30);
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 1;
          ctx.strokeRect(230, 45, width - 240, 30);
          ctx.fillStyle = '#10b981';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('📡 TARGET LOCKED: POINTING AUTO-SCAN COORDINATES MATCHED', width * 0.62, 63);
          ctx.restore();
        } else if (activeStatus === 'burst') {
          ctx.save();
          ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
          ctx.fillRect(230, 45, width - 240, 30);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1;
          ctx.strokeRect(230, 45, width - 240, 30);
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('⚡ ALERT: GHz FRB SHOCKWAVE DETECTED IN FLUX CONVERTER!', width * 0.62, 63);
          ctx.restore();
        }

        ctx.fillStyle = '#9ca3af';
        ctx.font = '9px monospace';
        ctx.fillText('🔄 Click & Drag canvas to rotate pulsar network view', 20, height - 20);

        // Title Info
        ctx.fillStyle = '#f4f4f5';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('POINTING EARLY WARNING PROTOCOL (DECISION)', 20, 30);
      }
    };

    const loop = () => {
      render();
      animId = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [simMode, phaseMismatch, baryonPressure, slipVelocity, ruptureThreshold]);

  return (
    <div className="w-full">
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* Simulator Area */}
        <div className="flex-1 w-full space-y-4">
          {/* Tab Selector */}
          <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800 gap-1 w-full max-w-lg">
            <button
              onClick={() => setSimMode('web')}
              className={`flex-1 py-1.5 px-3 rounded-md text-[10px] md:text-xs font-mono font-bold transition-all ${simMode === 'web' ? 'bg-[#10b981] text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Mode A: Cosmic Web
            </button>
            <button
              onClick={() => setSimMode('quake')}
              className={`flex-1 py-1.5 px-3 rounded-md text-[10px] md:text-xs font-mono font-bold transition-all ${simMode === 'quake' ? 'bg-[#a855f7] text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Mode B: Cosmic Quake
            </button>
            <button
              onClick={() => setSimMode('pointing')}
              className={`flex-1 py-1.5 px-3 rounded-md text-[10px] md:text-xs font-mono font-bold transition-all ${simMode === 'pointing' ? 'bg-[#fbbf24] text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Mode C: POINTING
            </button>
          </div>

          {/* Canvas block */}
          <div className="bg-zinc-900/50 rounded-xl overflow-hidden border border-zinc-800 p-2">
            <canvas
              ref={canvasRef}
              width={600}
              height={420}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              className="w-full h-auto rounded-lg shadow-inner"
            />
          </div>
        </div>

        {/* Controllers Panel */}
        <div className="w-full lg:w-72 flex flex-col space-y-4 bg-zinc-900/40 p-5 rounded-xl border border-zinc-800">
          <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono">Parameters Control</h4>

          {simMode === 'web' && (
            <>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-zinc-400 font-mono">
                  <span>Phase Discordance (Δθ)</span>
                  <span className="text-emerald-400 font-mono">{phaseMismatch.toFixed(2)} rad</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="3.14"
                  step="0.05"
                  value={phaseMismatch}
                  onChange={(e) => setPhaseMismatch(Number(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              <div className="space-y-1 mt-2">
                <div className="flex justify-between text-xs text-zinc-400 font-mono">
                  <span>Baryon Gas Pressure (σ)</span>
                  <span className="text-emerald-400 font-mono">{baryonPressure.toFixed(2)} GeV</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.5"
                  step="0.05"
                  value={baryonPressure}
                  onChange={(e) => setBaryonPressure(Number(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
            </>
          )}

          {simMode === 'quake' && (
            <>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-zinc-400 font-mono">
                  <span>Plate Slip Velocity (v)</span>
                  <span className="text-purple-400 font-mono">{slipVelocity.toFixed(1)} c</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="2.0"
                  step="0.1"
                  value={slipVelocity}
                  onChange={(e) => setSlipVelocity(Number(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              <div className="space-y-1 mt-2">
                <div className="flex justify-between text-xs text-zinc-400 font-mono">
                  <span>Critical Stress (S_crit)</span>
                  <span className="text-purple-400 font-mono">{ruptureThreshold} N/m²</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="100"
                  step="1"
                  value={ruptureThreshold}
                  onChange={(e) => setRuptureThreshold(Number(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            </>
          )}

          {simMode === 'pointing' && (
            <>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-zinc-400 font-mono">
                  <span>POINTING Protocol Status</span>
                  <span className="text-amber-400 font-mono">Automatic Loop</span>
                </div>
                <div className="p-3 bg-zinc-950 rounded border border-zinc-850 font-mono text-[9px] text-zinc-500 space-y-1.5 leading-relaxed">
                  <div>1. PTA Timing Jitter Detection</div>
                  <div>2. Neural Net Decodes Precursors</div>
                  <div>3. Target Lock & Warning Alarm</div>
                  <div>4. Anticipated FRB Capture</div>
                </div>
              </div>
            </>
          )}

          {/* Reset button */}
          <button
            onClick={resetSimulation}
            className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-mono font-bold transition-all shadow-inner mt-4"
          >
            Reset Simulation
          </button>
        </div>
      </div>
    </div>
  );
};
