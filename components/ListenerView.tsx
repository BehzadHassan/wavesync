import { useState, useEffect, useRef } from 'react';
import { SyncMessage } from '../hooks/useSync';
import { schedulePlay } from '../lib/audio-player';
import { RadioReceiver, CheckCircle2, PlayCircle, Loader2, Volume2, VolumeX, Scan, Waves } from 'lucide-react';
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
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const chunksRef = useRef<string[]>([]);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);

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

    if (lastMessage.action === 'audio_chunk') {
      setStatus('receiving');
      setFileName(lastMessage.fileName);
      chunksRef.current[lastMessage.chunkIndex] = lastMessage.data;
      
      const downloaded = chunksRef.current.filter(Boolean).length;
      setDownloadProgress(Math.round((downloaded / lastMessage.totalChunks) * 100));

      if (downloaded === lastMessage.totalChunks) {
        const base64 = chunksRef.current.join('');
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        if (audioContextRef.current) {
          audioContextRef.current.decodeAudioData(bytes.buffer).then(buffer => {
            audioBufferRef.current = buffer;
            setStatus('ready');
            chunksRef.current = [];
          });
        }
      }
    } else if (lastMessage.action === 'play') {
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }

      if (audioBufferRef.current && audioContextRef.current && gainNodeRef.current) {
        if (sourceRef.current) sourceRef.current.stop();
        
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBufferRef.current;
        source.connect(gainNodeRef.current);
        
        const localPlayAt = lastMessage.serverTimestamp + clockOffset;
        const delaySeconds = (localPlayAt - Date.now()) / 1000;
        const timePassed = delaySeconds < 0 ? Math.abs(delaySeconds) : 0;
        const startTime = audioContextRef.current.currentTime + Math.max(0, delaySeconds);
        source.start(startTime, lastMessage.audioPosition + timePassed);
        
        sourceRef.current = source;
        setStatus('playing');
      }
    } else if (lastMessage.action === 'pause') {
      if (sourceRef.current) {
        sourceRef.current.stop();
        setStatus('ready');
      }
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
      text: `Downloading Audio Stream`,
      sub: `${downloadProgress}% complete`,
      color: 'cyan',
    },
    ready: {
      icon: <CheckCircle2 className="text-green-400" size={48} />,
      text: 'Node Synchronized',
      sub: 'Waiting for host to press play',
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

        <div className="p-10 flex flex-col items-center justify-center text-center space-y-8 min-h-[420px]">
          
          {/* Central Visual */}
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
          
          {/* Status Text */}
          <div className="space-y-3">
            <h3 className="text-2xl font-black tracking-[0.15em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
              {statusConfig.text}
            </h3>
            <p className="text-xs text-slate-500 tracking-wider font-mono">{statusConfig.sub}</p>
            
            {status === 'receiving' && (
              <div className="w-48 mx-auto h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/5 mt-4">
                <motion.div 
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"
                  style={{ boxShadow: '0 0 12px rgba(34,211,238,0.5)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${downloadProgress}%` }}
                />
              </div>
            )}
          </div>

          {/* Waveform */}
          <div className="w-full px-4">
            <WaveformVisualizer isActive={status === 'playing'} barCount={48} height={50} />
          </div>

          {/* File info */}
          <AnimatePresence>
            {fileName && (
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/5 border border-cyan-500/15 rounded-full text-xs font-mono text-cyan-400 truncate max-w-[280px]"
              >
                <Waves size={12} />
                {fileName}
              </motion.span>
            )}
          </AnimatePresence>

          {/* Volume + Sync Info */}
          <div className="flex items-center justify-center gap-8 w-full">
            <div className="flex items-center gap-3">
              <button onClick={() => setMuted(!muted)} className="text-slate-400 hover:text-white transition-colors">
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input 
                type="range" min="0" max="1" step="0.01"
                value={muted ? 0 : volume}
                onChange={(e) => { setVolume(parseFloat(e.target.value)); setMuted(false); }}
                className="w-24 h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(34,211,238,0.5)]"
              />
            </div>
            
            <div className="flex items-center gap-2 glass px-4 py-1.5 rounded-full">
              <div className={`w-1.5 h-1.5 rounded-full ${clockOffset !== null ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]' : 'bg-slate-600 animate-pulse'}`} />
              <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
                {clockOffset !== null ? `±${Math.abs(clockOffset)}ms` : 'SYNCING'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
