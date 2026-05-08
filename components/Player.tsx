import { useState, useRef, useEffect } from 'react';
import { SyncAction } from '../hooks/useSync';
import { Play, Pause, Disc3, Mic, UploadCloud, Activity, Volume2, VolumeX, SkipForward, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import WaveformVisualizer from './WaveformVisualizer';
import OrbitalRings from './OrbitalRings';

export default function Player({ 
  broadcast, 
  clockOffset 
}: { 
  broadcast: (action: SyncAction) => void,
  clockOffset: number | null
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const elapsedIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioContextRef.current = new AudioContextClass();
    gainNodeRef.current = audioContextRef.current.createGain();
    gainNodeRef.current.connect(audioContextRef.current.destination);
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = muted ? 0 : volume;
    }
  }, [volume, muted]);

  const startElapsedTimer = (startOffset: number) => {
    if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    const startedAt = Date.now();
    elapsedIntervalRef.current = setInterval(() => {
      setElapsed(startOffset + (Date.now() - startedAt) / 1000);
    }, 100);
  };

  const stopElapsedTimer = () => {
    if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setLoading(true);
    setUploadProgress(0);
    const arrayBuffer = await file.arrayBuffer();
    
    if (audioContextRef.current) {
      const buffer = await audioContextRef.current.decodeAudioData(arrayBuffer.slice(0));
      audioBufferRef.current = buffer;
      setDuration(buffer.duration);
    }

    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    
    const CHUNK_SIZE = 50000;
    const totalChunks = Math.ceil(base64.length / CHUNK_SIZE);
    
    for (let i = 0; i < totalChunks; i++) {
      broadcast({
        action: 'audio_chunk',
        chunkIndex: i,
        totalChunks,
        data: base64.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
        mimeType: file.type,
        fileName: file.name
      });
      setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
      await new Promise(r => setTimeout(r, 50));
    }
    
    setLoading(false);
  };

  const play = () => {
    if (!audioBufferRef.current || !audioContextRef.current || !gainNodeRef.current) return;
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.connect(gainNodeRef.current);
    
    const delay = 0.5;
    source.start(audioContextRef.current.currentTime + delay, pausedAtRef.current);
    startTimeRef.current = audioContextRef.current.currentTime + delay - pausedAtRef.current;
    sourceRef.current = source;
    
    source.onended = () => {
      setIsPlaying(false);
      stopElapsedTimer();
      pausedAtRef.current = 0;
      setElapsed(0);
    };
    
    setIsPlaying(true);
    startElapsedTimer(pausedAtRef.current);
    broadcast({ action: 'play', audioPosition: pausedAtRef.current });
  };

  const pause = () => {
    if (sourceRef.current && audioContextRef.current) {
      sourceRef.current.onended = null;
      sourceRef.current.stop();
      pausedAtRef.current = audioContextRef.current.currentTime - startTimeRef.current;
      setIsPlaying(false);
      stopElapsedTimer();
      broadcast({ action: 'pause', audioPosition: pausedAtRef.current });
    }
  };

  const progressPercent = duration > 0 ? (elapsed / duration) * 100 : 0;

  return (
    <div className="relative">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/10 via-transparent to-indigo-500/10 rounded-3xl blur-lg pointer-events-none animate-border-flow" />
      
      <div className="relative glass-strong rounded-3xl overflow-hidden neon-border">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <Disc3 className={`text-cyan-400 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} size={18} />
            <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-slate-300">Host Command Terminal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${clockOffset !== null ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]' : 'bg-amber-400 animate-pulse'}`} />
            <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">
              {clockOffset !== null ? `SYNC ±${Math.abs(clockOffset)}ms` : 'CALIBRATING'}
            </span>
          </div>
        </div>

        <div className="p-8 space-y-8">
          
          {/* Upload Zone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative group/upload cursor-pointer">
              <input 
                type="file" 
                accept="audio/*" 
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="h-full flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl bg-white/[0.02] group-hover/upload:bg-cyan-500/5 group-hover/upload:border-cyan-500/30 transition-all duration-500 p-8 text-center hud-corners">
                <div className="p-4 rounded-full bg-white/5 border border-white/10 mb-4 group-hover/upload:border-cyan-500/30 transition-all">
                  <UploadCloud className="text-slate-500 group-hover/upload:text-cyan-400 transition-colors" size={28} />
                </div>
                <span className="text-xs font-bold tracking-[0.2em] text-slate-400 uppercase">Load Audio File</span>
                <span className="text-[10px] text-slate-600 mt-1 font-mono">MP3 · WAV · AAC · OGG · FLAC</span>
              </div>
            </div>
            
            <div className="flex flex-col items-center justify-center border border-white/5 rounded-2xl bg-white/[0.01] p-8 text-center opacity-40 cursor-not-allowed hud-corners">
              <div className="p-4 rounded-full bg-white/5 border border-white/5 mb-4">
                <Mic className="text-slate-600" size={28} />
              </div>
              <span className="text-xs font-bold tracking-[0.2em] text-slate-500 uppercase">Tab Capture</span>
              <span className="text-[10px] text-slate-700 mt-1 font-mono">COMING SOON</span>
            </div>
          </div>

          {/* Upload Progress */}
          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden space-y-3"
              >
                <div className="flex justify-between text-[10px] font-mono tracking-wider">
                  <span className="text-cyan-400 flex items-center gap-2">
                    <Activity size={12} className="animate-pulse" /> BROADCASTING TO NETWORK
                  </span>
                  <span className="text-white tabular-nums">{uploadProgress}%</span>
                </div>
                <div className="h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/5">
                  <motion.div
                    className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"
                    style={{ boxShadow: '0 0 12px rgba(34,211,238,0.5)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ ease: 'easeOut' }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* File Info */}
          <AnimatePresence>
            {fileName && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center gap-3"
              >
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/5 border border-cyan-500/15 rounded-full text-xs font-mono text-cyan-400 truncate max-w-[300px]">
                  <Disc3 size={12} className={isPlaying ? 'animate-spin' : ''} style={{ animationDuration: '2s' }} />
                  {fileName}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Waveform */}
          <div className="py-4 px-2">
            <WaveformVisualizer isActive={isPlaying} barCount={64} height={60} />
          </div>

          {/* Progress Bar */}
          {duration > 0 && (
            <div className="space-y-2">
              <div className="h-1 bg-white/5 rounded-full overflow-hidden cursor-pointer group relative">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-200"
                  style={{ 
                    width: `${progressPercent}%`,
                    boxShadow: isPlaying ? '0 0 8px rgba(34,211,238,0.4)' : 'none',
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-500 tabular-nums tracking-wider">
                <span>{formatTime(elapsed)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-center gap-8">
            {/* Volume */}
            <div className="flex items-center gap-3">
              <button onClick={() => setMuted(!muted)} className="text-slate-400 hover:text-white transition-colors">
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input 
                type="range" 
                min="0" max="1" step="0.01"
                value={muted ? 0 : volume}
                onChange={(e) => { setVolume(parseFloat(e.target.value)); setMuted(false); }}
                className="w-20 h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(34,211,238,0.5)]"
              />
            </div>

            {/* Play Button — Central */}
            <div className="relative">
              <OrbitalRings size={120} playing={isPlaying} />
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.button
                  onClick={isPlaying ? pause : play}
                  disabled={!audioBufferRef.current || loading}
                  whileTap={{ scale: 0.9 }}
                  className="relative w-16 h-16 rounded-full bg-black border border-white/10 hover:border-cyan-500/50 flex items-center justify-center text-white disabled:opacity-20 disabled:hover:border-white/10 transition-all neon-border-strong z-10"
                >
                  {isPlaying ? (
                    <Pause size={28} className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                  ) : (
                    <Play size={28} className="ml-1 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                  )}
                </motion.button>
              </div>
            </div>

            {/* Elapsed timer */}
            <div className="flex items-center gap-2 text-slate-500">
              <Clock size={14} />
              <span className="text-xs font-mono tabular-nums tracking-wider">{formatTime(elapsed)}</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
