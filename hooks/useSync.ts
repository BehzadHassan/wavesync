import { useState, useEffect, useRef } from 'react';
import * as Ably from 'ably';
import { measureClockOffset } from '../lib/sync-clock';

export type SyncAction =
  | { action: 'play'; audioPosition: number }
  | { action: 'pause'; audioPosition: number }
  | { action: 'seek'; audioPosition: number }
  | { action: 'audio_chunk'; chunkIndex: number; totalChunks: number; data: string; mimeType: string; fileName: string };

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

    measureClockOffset().then(offset => {
      setClockOffset(offset);
    });

    channel.subscribe('sync', (msg) => {
      setLastMessage(msg.data as SyncMessage);
    });

    return () => { 
      channel.presence.leave();
      ably.close(); 
    };
  }, [roomCode, role]);

  const broadcast = (action: SyncAction) => {
    channelRef.current?.publish('sync', {
      ...action,
      // serverTime = localTime - clockOffset
      serverTimestamp: Date.now() - (clockOffset || 0)
    });
  };

  return { broadcast, clockOffset, listenersCount, lastMessage };
}
