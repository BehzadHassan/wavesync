"use client";

import { useSearchParams, useParams } from 'next/navigation';
import { useSync } from '../../../hooks/useSync';
import RoomControls from '../../../components/RoomControls';
import Player from '../../../components/Player';
import ListenerView from '../../../components/ListenerView';
import { Waves, Hexagon } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function RoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  
  const code = params.code as string;
  const role = (searchParams.get('role') || 'listener') as 'host' | 'listener';

  const { broadcast, clockOffset, listenersCount, lastMessage } = useSync(code, role);

  return (
    <div className="relative min-h-screen bg-black text-slate-100 p-4 md:p-8 font-sans overflow-hidden selection:bg-cyan-500/30">
      
      {/* Background Grid & Glows */}
      <div className="absolute inset-0 z-0 opacity-10 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none"></div>
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="relative z-10 max-w-4xl mx-auto space-y-8">
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between py-4"
        >
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute -inset-1 bg-cyan-500/50 blur opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"></div>
              <div className="relative bg-black border border-white/10 p-2.5 rounded-xl">
                <Waves size={20} className="text-cyan-400" />
              </div>
            </div>
            <span className="text-xl font-bold tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              WaveSync
            </span>
          </Link>

          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full backdrop-blur-sm">
            <Hexagon size={14} className="text-cyan-400 animate-spin-slow" />
            <span className="text-xs font-mono tracking-widest text-slate-300">NODE ACTIVE</span>
          </div>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <RoomControls code={code} listenersCount={listenersCount} role={role} />
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8"
        >
          {role === 'host' ? (
            <Player broadcast={broadcast} clockOffset={clockOffset} />
          ) : (
            <ListenerView lastMessage={lastMessage} clockOffset={clockOffset} />
          )}
        </motion.div>
      </div>
    </div>
  );
}
