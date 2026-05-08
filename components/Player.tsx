import { useState, useRef, useEffect } from 'react';
import { SyncAction } from '../hooks/useSync';
import { Play, Pause, Disc3, Mic, UploadCloud, Activity, Volume2, VolumeX, SkipForward, SkipBack, Clock, ListMusic, Trash2, Gauge } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import WaveformVisualizer from './WaveformVisualizer';
import OrbitalRings from './OrbitalRings';

interface Track {
  id: string;
  file: File;
  name: string;
}

export default function Player({ 
  broadcast, 
  clockOffset 
}: { 
  broadcast: (action: SyncAction, delayMs?: number) => void,
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
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const elapsedIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Streaming State
  const streamingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamPositionRef = useRef(0);

  // Playlist State
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

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

  useEffect(() => {
    broadcast({
      action: 'sync_playlist',
      playlist: playlist.map(t => ({ id: t.id, name: t.name })),
      currentIndex
    });
  }, [playlist, currentIndex]);

  const startElapsedTimer = (startOffset: number) => {
    if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    const startedAt = Date.now();
    elapsedIntervalRef.current = setInterval(() => {
      setElapsed(startOffset + ((Date.now() - startedAt) / 1000) * playbackRate);
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

  const handleFilesAdded = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newTracks = files.map(f => ({
      id: Math.random().toString(36).substr(2, 9),
      file: f,
      name: f.name.replace(/\.[^/.]+$/, "")
    }));

    setPlaylist(prev => [...prev, ...newTracks]);
    
    if (playlist.length === 0 && newTracks.length > 0) {
      setTimeout(() => loadTrack(0, [...playlist, ...newTracks]), 100);
    }
  };

  const removeTrack = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setPlaylist(prev => {
      const nextList = [...prev];
      nextList.splice(index, 1);
      return nextList;
    });

    if (index === currentIndex) {
      stopPlayback();
      setCurrentIndex(-1);
    } else if (index < currentIndex) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const stopPlayback = () => {
    if (sourceRef.current) {
      sourceRef.current.onended = null;
      sourceRef.current.stop();
      sourceRef.current = null;
    }
    stopStreaming();
    setIsPlaying(false);
    stopElapsedTimer();
    pausedAtRef.current = 0;
    setElapsed(0);
    audioBufferRef.current = null;
    setDuration(0);
    broadcast({ action: 'pause', audioPosition: 0 });
  };

  const loadTrack = async (index: number, currentPlaylist: Track[] = playlist) => {
    const track = currentPlaylist[index];
    if (!track) return;

    stopPlayback();
    setCurrentIndex(index);
    setLoading(true);
    setPlaybackRate(1);

    const arrayBuffer = await track.file.arrayBuffer();
    
    if (audioContextRef.current) {
      const buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      audioBufferRef.current = buffer;
      setDuration(buffer.duration);
    }
    
    setLoading(false);
    
    setTimeout(() => {
      play(0);
    }, 100);
  };

  // --- Live PCM Streaming Engine ---
  const STREAM_CHUNK_SEC = 0.1; // 100ms slices
  const STREAM_LOOKAHEAD_SEC = 0.8; // Maintain 800ms buffer ahead
  
  const sendNextPcmChunk = () => {
    const buffer = audioBufferRef.current;
    if (!buffer) return false;
    
    const startSec = streamPositionRef.current;
    const endSec = startSec + STREAM_CHUNK_SEC;
    if (startSec >= buffer.duration) return false; // EOF
    
    const startSample = Math.floor(startSec * buffer.sampleRate);
    const endSample = Math.min(Math.floor(endSec * buffer.sampleRate), buffer.length);
    const durationSec = (endSample - startSample) / buffer.sampleRate;
    
    const channelsBase64 = [];
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      const channelData = buffer.getChannelData(i).subarray(startSample, endSample);
      const u8 = new Uint8Array(channelData.buffer, channelData.byteOffset, channelData.byteLength);
      let binary = '';
      for (let j = 0; j < u8.length; j += 8000) {
        binary += String.fromCharCode.apply(null, Array.from(u8.subarray(j, j + 8000)));
      }
      channelsBase64.push(btoa(binary));
    }
    
    broadcast({ 
      action: 'pcm_chunk', 
      startSec, 
      durationSec, 
      channels: channelsBase64 
    });
    
    streamPositionRef.current = endSec;
    return true;
  };

  const streamLoop = () => {
    const hasMore = sendNextPcmChunk();
    if (hasMore) {
      // Loop interval scales with playback rate so the network buffer doesn't starve when playing fast
      const nextCallMs = (STREAM_CHUNK_SEC * 1000) / playbackRate;
      streamingTimeoutRef.current = setTimeout(streamLoop, nextCallMs);
    }
  };

  const startStreaming = (startPos: number) => {
    stopStreaming();
    streamPositionRef.current = startPos;
    
    // Initial burst to build the lookahead buffer on listeners
    const burstCount = Math.floor(STREAM_LOOKAHEAD_SEC / STREAM_CHUNK_SEC);
    for (let i = 0; i < burstCount; i++) {
       sendNextPcmChunk();
    }
    
    // Start continuous loop
    const nextCallMs = (STREAM_CHUNK_SEC * 1000) / playbackRate;
    streamingTimeoutRef.current = setTimeout(streamLoop, nextCallMs);
  };

  const stopStreaming = () => {
    if (streamingTimeoutRef.current) clearTimeout(streamingTimeoutRef.current);
  };
  // ---------------------------------

  const play = (forcedStartPosition?: number) => {
    if (!audioBufferRef.current || !audioContextRef.current || !gainNodeRef.current) return;
    if (isPlaying && forcedStartPosition === undefined) return;
    
    if (sourceRef.current) {
      sourceRef.current.onended = null;
      sourceRef.current.stop();
    }
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.playbackRate.value = playbackRate;
    source.connect(gainNodeRef.current);
    
    // 500ms network delay before exact start time to allow initial burst packets to arrive
    const delayMs = 500; 
    const localPlayAt = Date.now() + delayMs;
    const delaySeconds = delayMs / 1000;
    
    const startPos = forcedStartPosition !== undefined ? forcedStartPosition : pausedAtRef.current;
    
    source.start(audioContextRef.current.currentTime + delaySeconds, startPos);
    startTimeRef.current = audioContextRef.current.currentTime + delaySeconds - startPos;
    sourceRef.current = source;
    
    source.onended = () => {
      setIsPlaying(false);
      stopElapsedTimer();
      stopStreaming();
      pausedAtRef.current = 0;
      setElapsed(0);
      handleNext();
    };
    
    setIsPlaying(true);
    pausedAtRef.current = startPos;
    startElapsedTimer(startPos);
    
    // Immediately tell listeners to seek to position, then start streaming
    broadcast({ action: 'play', audioPosition: startPos, playbackRate }, delayMs);
    startStreaming(startPos);
  };

  const pause = () => {
    if (sourceRef.current && audioContextRef.current) {
      sourceRef.current.onended = null;
      sourceRef.current.stop();
      
      const realSecondsPlayed = Math.max(0, audioContextRef.current.currentTime - startTimeRef.current - pausedAtRef.current);
      pausedAtRef.current = pausedAtRef.current + (realSecondsPlayed * playbackRate);
      
      setIsPlaying(false);
      stopElapsedTimer();
      stopStreaming();
      broadcast({ action: 'pause', audioPosition: pausedAtRef.current });
    }
  };

  const handleNext = () => {
    if (currentIndex < playlist.length - 1) {
      loadTrack(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      loadTrack(currentIndex - 1);
    } else if (duration > 0) {
      handleSeekToTime(0);
    }
  };

  const handleSeekToTime = (newPosition: number) => {
    if (duration === 0 || loading) return;
    
    if (sourceRef.current) {
      sourceRef.current.onended = null;
      sourceRef.current.stop();
    }
    
    setIsPlaying(false);
    stopElapsedTimer();
    stopStreaming();
    pausedAtRef.current = newPosition;
    setElapsed(newPosition);

    if (isPlaying) {
       play(newPosition);
    } else {
       broadcast({ action: 'seek', audioPosition: newPosition });
    }
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    handleSeekToTime(percent * duration);
  };

  const handleSpeedChange = () => {
    const rates = [0.5, 1, 1.5, 2];
    const nextRateIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
    const newRate = rates[nextRateIndex];
    
    if (isPlaying) {
      const realSecondsPlayed = Math.max(0, audioContextRef.current!.currentTime - startTimeRef.current - pausedAtRef.current);
      const currentPos = pausedAtRef.current + (realSecondsPlayed * playbackRate);
      
      setPlaybackRate(newRate); 
      setTimeout(() => play(currentPos), 10);
    } else {
      setPlaybackRate(newRate);
    }
  };

  const currentTrack = currentIndex >= 0 ? playlist[currentIndex] : null;
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
          
          {/* Top Section: Upload & Playlist */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Upload Zone */}
            <div className="relative group/upload cursor-pointer h-48">
              <input 
                type="file" 
                multiple
                accept="audio/*" 
                onChange={handleFilesAdded}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="h-full flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl bg-white/[0.02] group-hover/upload:bg-cyan-500/5 group-hover/upload:border-cyan-500/30 transition-all duration-500 p-8 text-center hud-corners">
                <div className="p-4 rounded-full bg-white/5 border border-white/10 mb-4 group-hover/upload:border-cyan-500/30 transition-all">
                  <UploadCloud className="text-slate-500 group-hover/upload:text-cyan-400 transition-colors" size={24} />
                </div>
                <span className="text-xs font-bold tracking-[0.2em] text-slate-400 uppercase">Add to Playlist</span>
                <span className="text-[10px] text-slate-600 mt-1 font-mono">INSTANT STREAM ENGINE</span>
              </div>
            </div>

            {/* Playlist UI */}
            <div className="h-48 flex flex-col border border-white/5 rounded-2xl bg-white/[0.01] hud-corners overflow-hidden relative">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-black/40">
                <ListMusic size={14} className="text-cyan-400" />
                <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Queue [{playlist.length}]</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {playlist.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-600 font-mono italic">
                    Playlist is empty
                  </div>
                ) : (
                  playlist.map((track, idx) => (
                    <div 
                      key={track.id}
                      onClick={() => !loading && loadTrack(idx)}
                      className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all ${
                        currentIndex === idx 
                          ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400' 
                          : 'hover:bg-white/5 text-slate-400 border border-transparent'
                      } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        {currentIndex === idx ? (
                          <Activity size={12} className={isPlaying ? 'animate-pulse text-cyan-400' : 'text-cyan-500/50'} />
                        ) : (
                          <span className="text-[10px] font-mono text-slate-600 w-3">{idx + 1}</span>
                        )}
                        <span className="text-xs font-mono truncate">{track.name}</span>
                      </div>
                      <button 
                        onClick={(e) => removeTrack(e, idx)}
                        className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-colors p-1"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Loading Indicator */}
          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden flex justify-center py-2"
              >
                <div className="flex items-center gap-2 text-cyan-400 text-[10px] font-mono tracking-wider">
                  <Activity size={12} className="animate-spin" /> DECODING LOCAL AUDIO...
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Now Playing Info */}
          <div className="text-center min-h-[24px]">
            <AnimatePresence mode="wait">
              {currentTrack && !loading ? (
                <motion.div
                  key={currentTrack.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent border-y border-cyan-500/20 text-xs font-mono text-cyan-400 truncate max-w-full"
                >
                  <span className="text-[10px] text-slate-500 mr-2 uppercase tracking-widest">Now Playing</span>
                  {currentTrack.name}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {/* Waveform */}
          <div className="py-2 px-2">
            <WaveformVisualizer isActive={isPlaying} barCount={64} height={60} />
          </div>

          {/* Interactive Progress Bar */}
          <div className="space-y-2 opacity-100 transition-opacity">
            <div 
              className="h-2 bg-white/5 rounded-full overflow-hidden cursor-pointer group relative"
              onClick={handleProgressBarClick}
            >
              <div 
                className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" 
              />
              <div 
                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-100 ease-linear"
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

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 w-1/3">
              <button onClick={() => setMuted(!muted)} className="text-slate-400 hover:text-white transition-colors">
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input 
                type="range" 
                min="0" max="1" step="0.01"
                value={muted ? 0 : volume}
                onChange={(e) => { setVolume(parseFloat(e.target.value)); setMuted(false); }}
                className="w-20 h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(34,211,238,0.5)] hidden sm:block"
              />
            </div>

            <div className="flex items-center justify-center gap-6 w-1/3">
              <button 
                onClick={handlePrev}
                disabled={currentIndex < 0 || loading}
                className="text-slate-400 hover:text-cyan-400 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
              >
                <SkipBack size={24} />
              </button>

              <div className="relative">
                <OrbitalRings size={90} playing={isPlaying} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.button
                    onClick={isPlaying ? pause : () => play()}
                    disabled={!audioBufferRef.current || loading}
                    whileTap={{ scale: 0.9 }}
                    className="relative w-14 h-14 rounded-full bg-black border border-white/10 hover:border-cyan-500/50 flex items-center justify-center text-white disabled:opacity-20 disabled:hover:border-white/10 transition-all neon-border-strong z-10"
                  >
                    {isPlaying ? (
                      <Pause size={24} className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                    ) : (
                      <Play size={24} className="ml-1 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                    )}
                  </motion.button>
                </div>
              </div>

              <button 
                onClick={handleNext}
                disabled={currentIndex >= playlist.length - 1 || loading}
                className="text-slate-400 hover:text-cyan-400 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
              >
                <SkipForward size={24} />
              </button>
            </div>

            <div className="w-1/3 flex justify-end items-center gap-6">
              <button 
                onClick={handleSpeedChange}
                disabled={!audioBufferRef.current || loading}
                className="flex items-center gap-1 text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors disabled:opacity-30"
              >
                <Gauge size={12} />
                {playbackRate}x
              </button>
              
              <div className="flex items-center gap-2 text-slate-500 hidden sm:flex">
                <Clock size={12} />
                <span className="text-[10px] font-mono tabular-nums tracking-wider">{formatTime(elapsed)}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
