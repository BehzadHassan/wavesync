import { useState, useEffect, useRef } from 'react';
import { SyncMessage } from '../hooks/useSync';
import { schedulePlay } from '../lib/audio-player';
import { RadioReceiver, CheckCircle2, PlayCircle, Loader2, Volume2, VolumeX, Scan, Waves, ListMusic, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import WaveformVisualizer from './WaveformVisualizer';
import OrbitalRings from './OrbitalRings';

export default function ListenerView({ 
  lastMessage,
  clockOffset
}: { 
  lastMessage: SyncMessage | null,
  clockOffset: number | null
}) {
  const [status, setStatus] = useState<'waiting' | 'receiving' | 'ready' | 'playing'>('waiting');
  const [fileName, setFileName] = useState<string>('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);

  // Playback state
  const playRef = useRef({ serverTimestamp: 0, audioPosition: 0, rate: 1 });
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Playlist state
  const [playlist, setPlaylist] = useState<{id: string, name: string}[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  useEffect(() => {
    const handleInteraction = () => {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.connect(audioContextRef.current.destination);
        setHasInteracted(true);
      }
    };
    
    window.addEventListener('click', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);
    
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      audioContextRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = muted ? 0 : volume;
    }
  }, [volume, muted]);

  useEffect(() => {
    if (!lastMessage || clockOffset === null) return;

    if (lastMessage.action === 'sync_playlist') {
      setPlaylist(lastMessage.playlist);
      setCurrentIndex(lastMessage.currentIndex);
    } 
    else if (lastMessage.action === 'play') {
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
      
      playRef.current = {
        serverTimestamp: lastMessage.serverTimestamp,
        audioPosition: lastMessage.audioPosition,
        rate: lastMessage.playbackRate || 1
      };
      
      // Stop all currently scheduled chunks (if seeking)
      activeSourcesRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
      });
      activeSourcesRef.current.clear();
      
      setStatus('playing');
    }
    else if (lastMessage.action === 'pcm_chunk') {
      if (!audioContextRef.current || !gainNodeRef.current) return;
      
      const { startSec, durationSec, channels } = lastMessage;
      const sampleRate = audioContextRef.current.sampleRate;
      const length = Math.floor(durationSec * sampleRate);
      
      const buffer = audioContextRef.current.createBuffer(channels.length, length, sampleRate);
      
      for (let i = 0; i < channels.length; i++) {
        const binary = atob(channels[i]);
        const u8 = new Uint8Array(binary.length);
        for (let j = 0; j < binary.length; j++) {
          u8[j] = binary.charCodeAt(j);
        }
        const f32 = new Float32Array(u8.buffer);
        buffer.getChannelData(i).set(f32);
      }
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = playRef.current.rate;
      source.connect(gainNodeRef.current);
      
      // Calculate exact start time
      // The true zero-point of the track is T0 - startPos
      const trackVirtualStart = playRef.current.serverTimestamp - (playRef.current.audioPosition * 1000 / playRef.current.rate);
      
      // This chunk belongs at startSec
      const chunkPlayAt = trackVirtualStart + (startSec * 1000 / playRef.current.rate);
      const localPlayAt = chunkPlayAt + clockOffset;
      const delaySeconds = (localPlayAt - Date.now()) / 1000;
      
      if (delaySeconds < 0) {
        // Chunk is in the past, maybe partially playable
        const timePassed = Math.abs(delaySeconds) * playRef.current.rate;
        if (timePassed < durationSec) {
          source.start(audioContextRef.current.currentTime, timePassed);
          activeSourcesRef.current.add(source);
        }
      } else {
        const startTime = audioContextRef.current.currentTime + delaySeconds;
        source.start(startTime);
        activeSourcesRef.current.add(source);
      }
      
      source.onended = () => {
        activeSourcesRef.current.delete(source);
      };
      
    } else if (lastMessage.action === 'pause') {
      activeSourcesRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
      });
      activeSourcesRef.current.clear();
      setStatus('ready');
      
    } else if (lastMessage.action === 'seek') {
      activeSourcesRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
      });
      activeSourcesRef.current.clear();
      setStatus('ready');
    }
  }, [lastMessage, clockOffset]);

  const statusConfig = {
    waiting: {
      icon: <RadioReceiver className="text-slate-500" size={48} />,
      text: 'Awaiting Host Signal',
      sub: 'The host has not started broadcasting yet',
      color: 'slate',
    },
    receiving: {
      icon: <Loader2 className="text-cyan-400 animate-spin" size={48} />,
      text: `Buffering Track`,
      sub: `Optimizing stream...`,
      color: 'cyan',
    },
    ready: {
      icon: <CheckCircle2 className="text-green-400" size={48} />,
      text: 'Node Synchronized',
      sub: 'Ready for live stream packets',
      color: 'green',
    },
    playing: {
      icon: <PlayCircle className="text-cyan-400" size={48} />,
      text: 'Audio Synchronized',
      sub: 'Playing in perfect sync',
      color: 'cyan',
    },
  }[status];

  return (
    <div className="relative">
      <div className={`absolute -inset-0.5 rounded-3xl blur-lg pointer-events-none transition-all duration-1000 ${
        status === 'playing' 
          ? 'bg-gradient-to-r from-cyan-500/20 via-blue-500/15 to-indigo-500/20 animate-border-flow' 
          : 'bg-white/5'
      }`} />
      
      <div className="relative glass-strong rounded-3xl overflow-hidden neon-border">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <Waves className={`text-cyan-400 ${status === 'playing' ? 'animate-pulse' : ''}`} size={18} />
            <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-slate-300">Listener Node</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              status === 'playing' ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]' :
              status === 'ready' ? 'bg-green-400/60' :
              status === 'receiving' ? 'bg-cyan-400 animate-pulse' :
              'bg-slate-600 animate-pulse'
            }`} />
            <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">
              {status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Tap to init overlay */}
        <AnimatePresence>
          {!hasInteracted && (
            <motion.div
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center cursor-pointer"
              onClick={() => {}}
            >
              <OrbitalRings size={160} playing={false} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="p-6 glass rounded-full neon-border-strong mb-6"
                >
                  <Scan size={40} className="text-cyan-400" />
                </motion.div>
                <h3 className="text-xl font-black tracking-[0.2em] uppercase text-white mb-2">Initialize Audio</h3>
                <p className="text-xs text-slate-500 tracking-wider">Tap anywhere to activate receiver</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2">
          
          {/* Main Visualizer */}
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-8 border-b md:border-b-0 md:border-r border-white/5">
            <div className="relative">
              <OrbitalRings size={180} playing={status === 'playing'} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="glass p-6 rounded-full neon-border">
                  <motion.div
                    animate={status === 'playing' ? { scale: [1, 1.15, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  >
                    {statusConfig.icon}
                  </motion.div>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h3 className="text-xl sm:text-2xl font-black tracking-[0.15em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
                {statusConfig.text}
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-500 tracking-wider font-mono uppercase">{statusConfig.sub}</p>
            </div>

            <div className="w-full px-4">
              <WaveformVisualizer isActive={status === 'playing'} barCount={32} height={40} />
            </div>

            <div className="flex items-center justify-center gap-6 w-full">
              <div className="flex items-center gap-3">
                <button onClick={() => setMuted(!muted)} className="text-slate-400 hover:text-white transition-colors">
                  {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <input 
                  type="range" min="0" max="1" step="0.01"
                  value={muted ? 0 : volume}
                  onChange={(e) => { setVolume(parseFloat(e.target.value)); setMuted(false); }}
                  className="w-20 h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(34,211,238,0.5)]"
                />
              </div>
              
              <div className="flex items-center gap-2 glass px-3 py-1.5 rounded-full">
                <div className={`w-1.5 h-1.5 rounded-full ${clockOffset !== null ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]' : 'bg-slate-600 animate-pulse'}`} />
                <span className="text-[9px] font-mono tracking-widest text-slate-400 uppercase">
                  {clockOffset !== null ? `±${Math.abs(clockOffset)}ms` : 'SYNCING'}
                </span>
              </div>
            </div>
          </div>

          {/* Playlist Panel */}
          <div className="flex flex-col bg-black/20">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/40">
              <div className="flex items-center gap-2 text-cyan-400">
                <ListMusic size={16} />
                <span className="text-xs font-bold tracking-widest uppercase text-slate-300">Live Broadcast Queue</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar max-h-[300px] md:max-h-full">
              {playlist.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
                  <Waves size={32} className="text-slate-600 mb-4" />
                  <p className="text-xs text-slate-500 font-mono tracking-widest uppercase">Waiting for host to add tracks...</p>
                </div>
              ) : (
                playlist.map((track, idx) => (
                  <div 
                    key={track.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      currentIndex === idx 
                        ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shadow-[inset_0_0_15px_rgba(34,211,238,0.1)]' 
                        : 'bg-white/[0.02] border border-white/5 text-slate-400'
                    }`}
                  >
                    <div className="w-4 flex justify-center">
                      {currentIndex === idx ? (
                        <Activity size={14} className={status === 'playing' ? 'animate-pulse text-cyan-400' : 'text-cyan-500/50'} />
                      ) : (
                        <span className="text-[10px] font-mono text-slate-600">{idx + 1}</span>
                      )}
                    </div>
                    <span className="text-xs font-mono truncate">{track.name}</span>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-white/5 bg-black/60 p-4">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-slate-600 font-bold uppercase tracking-[0.2em]">Currently Selected</span>
                <span className="text-xs font-mono text-cyan-400 truncate">
                  {currentIndex >= 0 && playlist[currentIndex] ? playlist[currentIndex].name : 'None'}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
