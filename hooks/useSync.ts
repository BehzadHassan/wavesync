import { useState, useEffect, useRef } from 'react';
import * as Ably from 'ably';
import { measureClockOffset } from '../lib/sync-clock';

export type SyncAction =
  | { action: 'play'; audioPosition: number; playbackRate: number }
  | { action: 'pause'; audioPosition: number }
  | { action: 'seek'; audioPosition: number }
  | { action: 'pcm_chunk'; startSec: number; durationSec: number; channels: string[] }
  | { action: 'sync_playlist'; playlist: { id: string; name: string }[]; currentIndex: number };

export type SyncMessage = SyncAction & { serverTimestamp: number };

export function useSync(roomCode: string, role: 'host' | 'listener') {
  const [clockOffset, setClockOffset] = useState<number | null>(null);
  const [listenersCount, setListenersCount] = useState(0);
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);
  const [lastMessage, setLastMessage] = useState<SyncMessage | null>(null);

  useEffect(() => {
    if (!roomCode) return;

    const ably = new Ably.Realtime({ authUrl: '/api/ably-token' });
    const channel = ably.channels.get(`wavesync:${roomCode}`);
    channelRef.current = channel;

    channel.presence.enter(role);

    channel.presence.subscribe(async () => {
      try {
        const members = await channel.presence.get();
        const count = members.filter(m => m.data === 'listener').length;
        setListenersCount(count);
      } catch (e) {
        console.warn('Failed to get presence', e);
      }
    });

    const measure = () => {
      measureClockOffset().then(offset => {
        setClockOffset(offset);
      });
    };
    
    measure();
    const syncInterval = setInterval(measure, 30000);

    channel.subscribe('sync', (msg) => {
      setLastMessage(msg.data as SyncMessage);
    });

    return () => { 
      clearInterval(syncInterval);
      channel.presence.leave().catch(() => {});
      ably.close(); 
    };
  }, [roomCode, role]);

  const broadcast = (action: SyncAction, delayMs: number = 0) => {
    channelRef.current?.publish('sync', {
      ...action,
      // serverTime = localTime - clockOffset + delay
      serverTimestamp: Date.now() - (clockOffset || 0) + delayMs
    });
  };

  return { broadcast, clockOffset, listenersCount, lastMessage };
}
