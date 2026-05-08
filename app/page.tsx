"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Waves, Zap, Activity, Radio, ChevronRight, Signal, Globe, Hexagon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ParticleField from '../components/ParticleField';
import GridBackground from '../components/GridBackground';
import HUDOverlay from '../components/HUDOverlay';
import OrbitalRings from '../components/OrbitalRings';
import WaveformVisualizer from '../components/WaveformVisualizer';

export default function Home() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);

  const startRoom = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/room', { method: 'POST' });
      const data = await res.json();
      router.push(`/room/${data.code}?role=host`);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length === 4) {
      router.push(`/room/${code.toUpperCase()}?role=listener`);
    }
  };

  if (!mounted) return null;

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
      <GridBackground />
      <ParticleField count={50} />
      <HUDOverlay />

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-lg w-full"
        >
          {/* Hero Section */}
          <div className="text-center mb-12">
            {/* Logo + Orbital */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.8, type: 'spring', bounce: 0.3 }}
              className="flex justify-center mb-10 relative"
            >
              <OrbitalRings size={180} playing={false} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="glass-strong p-4 rounded-2xl neon-border">
                  <Waves size={32} className="text-cyan-400" />
                </div>
              </div>
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-7xl font-black tracking-tighter mb-4 relative"
            >
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 neon-text">
                Wave
              </span>
              <span className="text-white">Sync</span>
              {/* Glitch layer */}
              <span 
                className="absolute inset-0 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 opacity-0 hover:opacity-100"
                style={{ animation: 'text-glitch 3s infinite', animationPlayState: 'paused' }}
                aria-hidden="true"
              >
                WaveSync
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-slate-400 text-sm tracking-[0.15em] uppercase font-light"
            >
              Synchronized audio · Any device · Any network
            </motion.p>

            {/* Live waveform preview */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-8 px-8"
            >
              <WaveformVisualizer isActive={true} barCount={64} height={40} />
            </motion.div>
          </div>

          {/* Action Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="relative"
          >
            {/* Card glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-indigo-500/10 rounded-3xl blur-xl animate-border-flow pointer-events-none" />
            
            <div className="relative glass-strong rounded-3xl overflow-hidden neon-border">
              {/* Scanline effect on card */}
              <div className="absolute inset-0 scanline-overlay pointer-events-none rounded-3xl" />

              {/* Tab Switcher */}
              <div className="relative flex border-b border-white/5">
                <button
                  onClick={() => setActiveTab('create')}
                  className={`flex-1 py-4 px-6 text-xs font-bold tracking-[0.2em] uppercase transition-all relative ${
                    activeTab === 'create' ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Signal size={14} />
                    <span>Initialize Host</span>
                  </div>
                  {activeTab === 'create' && (
                    <motion.div
                      layoutId="tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-400 to-blue-500"
                    />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('join')}
                  className={`flex-1 py-4 px-6 text-xs font-bold tracking-[0.2em] uppercase transition-all relative ${
                    activeTab === 'join' ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Globe size={14} />
                    <span>Connect Node</span>
                  </div>
                  {activeTab === 'join' && (
                    <motion.div
                      layoutId="tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-400 to-blue-500"
                    />
                  )}
                </button>
              </div>

              <div className="p-8">
                <AnimatePresence mode="wait">
                  {activeTab === 'create' ? (
                    <motion.div
                      key="create"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6"
                    >
                      <div className="text-center space-y-2 mb-8">
                        <h2 className="text-lg font-bold tracking-wider uppercase text-white">Create a Broadcast</h2>
                        <p className="text-xs text-slate-500 tracking-wide">Generate a unique access node for synchronized playback</p>
                      </div>

                      {/* Feature pills */}
                      <div className="flex flex-wrap justify-center gap-2 mb-6">
                        {['Sub-50ms Sync', 'Any Audio Source', 'Unlimited Reach'].map((feat, i) => (
                          <motion.span
                            key={feat}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 1 + i * 0.1 }}
                            className="px-3 py-1 bg-white/5 border border-white/5 rounded-full text-[10px] font-mono tracking-widest text-slate-400 uppercase"
                          >
                            {feat}
                          </motion.span>
                        ))}
                      </div>

                      <button
                        onClick={startRoom}
                        disabled={loading}
                        className="group relative w-full overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600 opacity-80 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500 opacity-0 group-hover:opacity-20 blur-xl transition-opacity" />
                        <div className="relative flex items-center justify-center gap-3 py-4 px-8 font-bold text-sm tracking-[0.2em] uppercase text-white">
                          {loading ? (
                            <>
                              <Activity className="animate-spin" size={18} />
                              <span>Generating Node...</span>
                            </>
                          ) : (
                            <>
                              <Zap size={18} />
                              <span>Launch Broadcast</span>
                              <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </>
                          )}
                        </div>
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="join"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6"
                    >
                      <div className="text-center space-y-2 mb-8">
                        <h2 className="text-lg font-bold tracking-wider uppercase text-white">Join a Broadcast</h2>
                        <p className="text-xs text-slate-500 tracking-wide">Enter the 4-character access code to sync</p>
                      </div>

                      <form onSubmit={joinRoom} className="space-y-6">
                        {/* Code Input — Individual boxes */}
                        <div className="flex justify-center gap-3">
                          {[0, 1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className={`relative w-16 h-20 flex items-center justify-center text-3xl font-mono font-black rounded-xl border transition-all duration-300 ${
                                code[i] 
                                  ? 'border-cyan-500/50 bg-cyan-500/5 text-cyan-400 neon-border shadow-[0_0_15px_rgba(34,211,238,0.15)]' 
                                  : 'border-white/10 bg-white/[0.02] text-slate-600'
                              }`}
                            >
                              {code[i] || (
                                <span className="text-slate-700 text-lg">•</span>
                              )}
                              {/* Cursor blink on active slot */}
                              {code.length === i && (
                                <motion.div
                                  animate={{ opacity: [1, 0] }}
                                  transition={{ repeat: Infinity, duration: 0.8 }}
                                  className="absolute bottom-3 w-6 h-0.5 bg-cyan-400"
                                />
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Hidden actual input */}
                        <input
                          type="text"
                          value={code}
                          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                          maxLength={4}
                          className="sr-only"
                          autoFocus
                          id="code-input"
                        />
                        {/* Clickable overlay to focus input */}
                        <label htmlFor="code-input" className="block -mt-28 h-24 cursor-text" />

                        <button
                          type="submit"
                          disabled={code.length !== 4}
                          className="w-full py-4 px-8 bg-white/5 border border-white/10 hover:border-cyan-500/30 hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-white/5 disabled:hover:border-white/10 text-white font-bold text-sm tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-3 group"
                        >
                          <Radio size={16} className="text-cyan-400" />
                          <span>Sync to Node</span>
                          <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform opacity-50" />
                        </button>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Bottom status bar */}
              <div className="border-t border-white/5 px-6 py-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
                  <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">System Online</span>
                </div>
                <div className="flex items-center gap-2">
                  <Hexagon size={10} className="text-cyan-500/30 animate-spin" style={{ animationDuration: '8s' }} />
                  <span className="text-[10px] font-mono tracking-widest text-slate-500">v2.0.1</span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
