import { Copy, Users, Radio, Wifi, Server, Database, Lock, Hexagon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export default function RoomControls({ code, listenersCount, role }: { code: string, listenersCount: number, role: 'host' | 'listener' }) {
  const [copied, setCopied] = useState(false);
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setUptime(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/10 via-transparent to-indigo-500/10 rounded-2xl blur-lg pointer-events-none animate-border-flow" />
      
      <div className="relative glass-strong rounded-2xl overflow-hidden neon-border">
        {/* Top status bar */}
        <div className="flex items-center justify-between px-6 py-2 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
              <div className="w-2 h-2 rounded-full bg-green-400/60" />
              <div className="w-2 h-2 rounded-full bg-green-400/30" />
            </div>
            <span className="text-[10px] font-mono tracking-[0.2em] text-slate-500 uppercase">
              Broadcast Active
            </span>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono text-slate-600">
            <span className="flex items-center gap-1.5"><Lock size={9} /> E2E</span>
            <span className="flex items-center gap-1.5"><Wifi size={9} /> WS</span>
            <span className="flex items-center gap-1.5"><Server size={9} /> UP {formatUptime(uptime)}</span>
          </div>
        </div>

        <div className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-4">
          {/* Access code */}
          <div className="flex flex-col items-center md:items-start">
            <p className="text-slate-500 text-[10px] font-mono tracking-[0.25em] uppercase mb-3 flex items-center gap-2">
              <Radio size={10} className="text-cyan-400" /> Access Code
            </p>
            <div className="flex items-center gap-2">
              {code.split('').map((char, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="w-14 h-16 flex items-center justify-center text-3xl font-mono font-black text-cyan-400 bg-black/60 border border-cyan-500/20 rounded-lg neon-border neon-text-subtle"
                >
                  {char}
                </motion.div>
              ))}
              <motion.button
                onClick={handleCopy}
                whileTap={{ scale: 0.9 }}
                className="relative ml-2 p-3 bg-white/5 border border-white/10 hover:border-cyan-500/30 rounded-lg text-slate-400 hover:text-cyan-400 transition-all"
                title="Copy Code"
              >
                <Copy size={18} />
                {copied && (
                  <motion.span
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: -5 }}
                    exit={{ opacity: 0 }}
                    className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-mono text-cyan-400 bg-black/90 px-2 py-1 rounded border border-cyan-500/30 whitespace-nowrap"
                  >
                    COPIED
                  </motion.span>
                )}
              </motion.button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6">
            {/* Role */}
            <div className="flex flex-col items-center">
              <p className="text-slate-600 text-[10px] font-mono tracking-[0.2em] uppercase mb-2">Role</p>
              <div className="relative">
                <div className={`absolute inset-0 rounded-full blur-md ${role === 'host' ? 'bg-cyan-500/30' : 'bg-indigo-500/30'}`} />
                <span className="relative glass px-4 py-1.5 rounded-full text-[11px] font-bold tracking-[0.2em] uppercase text-white block">
                  {role === 'host' ? '◉ HOST' : '◎ LISTENER'}
                </span>
              </div>
            </div>
            
            <div className="w-px h-12 bg-gradient-to-b from-transparent via-white/10 to-transparent hidden md:block" />
            
            {/* Listeners */}
            <div className="flex flex-col items-center">
              <p className="text-slate-600 text-[10px] font-mono tracking-[0.2em] uppercase mb-2">Nodes</p>
              <div className="flex items-center gap-2 glass px-4 py-1.5 rounded-full">
                <Users size={14} className="text-cyan-400" />
                <span className="text-lg font-mono font-black text-white tabular-nums">{listenersCount}</span>
              </div>
            </div>

            <div className="w-px h-12 bg-gradient-to-b from-transparent via-white/10 to-transparent hidden md:block" />

            {/* Protocol */}
            <div className="flex flex-col items-center hidden md:flex">
              <p className="text-slate-600 text-[10px] font-mono tracking-[0.2em] uppercase mb-2">Protocol</p>
              <div className="flex items-center gap-2 glass px-4 py-1.5 rounded-full">
                <Hexagon size={12} className="text-indigo-400 animate-spin" style={{ animationDuration: '8s' }} />
                <span className="text-[11px] font-mono font-bold text-slate-300 tracking-wider">ABLY-WS</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
