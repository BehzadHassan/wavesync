"use client";

import { useState, useEffect } from 'react';
import { Waves, Shield, Cpu, CircuitBoard, Fingerprint, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function HUDOverlay() {
  const [time, setTime] = useState('');
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour12: false }) + ':' + String(now.getMilliseconds()).padStart(3, '0'));
    }, 50);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      setCoords({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouse);
    return () => window.removeEventListener('mousemove', handleMouse);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {/* Scanline */}
      <div 
        className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent animate-scanline"
      />

      {/* Top-left HUD */}
      <div className="absolute top-6 left-6 font-mono text-[10px] tracking-widest text-cyan-500/40 space-y-1">
        <div className="flex items-center gap-2">
          <Shield size={10} />
          <span>WAVESYNC v2.0.1</span>
        </div>
        <div>{time}</div>
      </div>

      {/* Top-right HUD */}
      <div className="absolute top-6 right-6 font-mono text-[10px] tracking-widest text-cyan-500/40 text-right space-y-1">
        <div className="flex items-center justify-end gap-2">
          <span>SYS.NOMINAL</span>
          <Cpu size={10} />
        </div>
        <div>POS [{coords.x},{coords.y}]</div>
      </div>

      {/* Bottom-left */}
      <div className="absolute bottom-6 left-6 font-mono text-[10px] tracking-widest text-cyan-500/30 flex items-center gap-2">
        <CircuitBoard size={10} />
        <span>QUANTUM AUDIO SYNC ENGINE</span>
      </div>

      {/* Bottom-right */}
      <div className="absolute bottom-6 right-6 font-mono text-[10px] tracking-widest text-cyan-500/30 flex items-center gap-2">
        <span>ENCRYPTED CHANNEL</span>
        <Fingerprint size={10} />
      </div>

      {/* Corner brackets */}
      {/* Top-left */}
      <svg className="absolute top-3 left-3 w-8 h-8 text-cyan-500/20" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M0 12 L0 0 L12 0" />
      </svg>
      {/* Top-right */}
      <svg className="absolute top-3 right-3 w-8 h-8 text-cyan-500/20" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M20 0 L32 0 L32 12" />
      </svg>
      {/* Bottom-left */}
      <svg className="absolute bottom-3 left-3 w-8 h-8 text-cyan-500/20" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M0 20 L0 32 L12 32" />
      </svg>
      {/* Bottom-right */}
      <svg className="absolute bottom-3 right-3 w-8 h-8 text-cyan-500/20" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M20 32 L32 32 L32 20" />
      </svg>
    </div>
  );
}
