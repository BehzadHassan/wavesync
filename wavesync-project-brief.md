# WaveSync — Project Brief & Build Prompt

> **Suggested project name: WaveSync**
> *Wave* = audio waveform + synchronized playback across devices. Clean, memorable, and descriptive.

---

## Project Overview

WaveSync is a web application that synchronizes audio playback across multiple devices in real time, with sub-100ms latency. Any device on any network can join a room and hear the exact same audio simultaneously — turning multiple phones into a single distributed speaker system.

The host plays audio from **any source** (Spotify, YouTube, local files, any browser tab) and all listener devices stay perfectly in sync via a shared server clock.

---

## Core Goals

- Play one song across many phones at the same time to amplify collective volume
- Work on **any network** (not just local WiFi) — devices can be across the internet
- Support **any audio source** on the host (Spotify, YouTube, browser tabs, local files)
- Achieve the **lowest possible latency** — target under 100ms sync drift
- Deploy on **Vercel** with zero infrastructure management

---

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | Next.js 14 (App Router) | Vercel-native, React Server Components |
| Styling | Tailwind CSS | Rapid UI development |
| Realtime | Ably (WebSockets) | Persistent WS connections on Vercel edge |
| Room state | Upstash Redis | Serverless Redis compatible with Vercel |
| Audio playback | Web Audio API | Sub-millisecond scheduling precision |
| Audio capture | `getDisplayMedia()` | Captures any tab/system audio on host |
| Clock sync | NTP-style RTT measurement | Aligns all device clocks to server time |

---

## Architecture

```
Host Device
  └─ Tab audio capture (getDisplayMedia)
  └─ WebSocket connection → Ably → Next.js API
        └─ Broadcasts: { action, serverTimestamp, audioPosition }
              └─ Listener 1 → clockOffset → AudioContext.start(scheduledTime)
              └─ Listener 2 → clockOffset → AudioContext.start(scheduledTime)
              └─ Listener N → clockOffset → AudioContext.start(scheduledTime)
```

### Clock Synchronization Algorithm

Each client measures its clock offset against the server using 5 round-trip samples:

```
clockOffset = serverTime - localTime - (rtt / 2)
```

On receiving a play command:
```
localPlayAt  = serverTimestamp + clockOffset
audioDelay   = (localPlayAt - Date.now()) / 1000   // seconds
source.start(audioCtx.currentTime + audioDelay)
```

This achieves **±20–50ms accuracy** in practice — imperceptible when used as distributed speakers.

---

## Project Structure

```
wavesync/
├── app/
│   ├── api/
│   │   ├── room/
│   │   │   └── route.ts           # POST: create room, GET: room state
│   │   └── ably-token/
│   │       └── route.ts           # Ably auth token endpoint
│   ├── room/
│   │   └── [code]/
│   │       └── page.tsx           # Main player page (host + listener views)
│   └── page.tsx                   # Landing page — create or join a room
│
├── lib/
│   ├── sync-clock.ts              # NTP-style clock offset measurement
│   ├── audio-capture.ts           # getDisplayMedia wrapper (tab audio)
│   └── audio-player.ts            # Web Audio API scheduling engine
│
├── components/
│   ├── Player.tsx                 # Playback controls (host only)
│   ├── RoomControls.tsx           # Room code display, share, listener count
│   └── ListenerView.tsx           # Passive listener UI with sync indicator
│
├── hooks/
│   └── useSync.ts                 # Combined Ably + clock sync React hook
│
└── .env.local
    # ABLY_API_KEY=
    # UPSTASH_REDIS_REST_URL=
    # UPSTASH_REDIS_REST_TOKEN=
```

---

## Feature Requirements

### Room management
- Host creates a room and receives a 4-character alphanumeric code (e.g. `B3KX`)
- Listeners enter the code on any device, any network
- Room state stored in Upstash Redis with a 4-hour TTL
- Show live listener count on host UI
- Room auto-destroys when host disconnects

### Host capabilities
- Upload a local audio file (MP3, WAV, AAC, OGG, FLAC)
- OR capture audio from any browser tab using `getDisplayMedia({ audio: true })`
- Play, pause, seek controls
- Real-time broadcast of all state changes to all listeners
- Volume control (affects only local device)

### Listener capabilities
- Join by entering a room code
- Receive audio data and play back on precise schedule
- Visual sync indicator (green = in sync, yellow = drifting, red = lost)
- Volume control (local only)
- No controls over playback — host is the single source of truth

### Sync engine behavior
- On join: measure clock offset (5 RTT samples, median)
- On play command: schedule `AudioContext.start()` at the exact calculated future timestamp
- Drift correction: re-sync every 30 seconds if listener drifts more than 200ms
- On network interruption: buffer and re-sync when reconnected

---

## Key Code Implementations

### Clock sync (`lib/sync-clock.ts`)

```typescript
export async function measureClockOffset(channel: Ably.RealtimeChannel): Promise<number> {
  const samples: number[] = []

  for (let i = 0; i < 5; i++) {
    const t0 = Date.now()
    const serverTime = await pingServer(channel) // server echoes Date.now()
    const t1 = Date.now()
    const rtt = t1 - t0
    samples.push(serverTime - t0 - rtt / 2)
    await sleep(100)
  }

  // Return median (trim outliers)
  return samples.sort((a, b) => a - b)[Math.floor(samples.length / 2)]
}
```

### Scheduled audio playback (`lib/audio-player.ts`)

```typescript
export function schedulePlay(
  audioBuffer: AudioBuffer,
  serverPlayAt: number,
  clockOffset: number,
  audioCtx: AudioContext
): AudioBufferSourceNode {
  const localPlayAt = serverPlayAt + clockOffset
  const delaySeconds = (localPlayAt - Date.now()) / 1000

  const source = audioCtx.createBufferSource()
  source.buffer = audioBuffer
  source.connect(audioCtx.destination)
  source.start(audioCtx.currentTime + Math.max(0, delaySeconds))

  return source
}
```

### Tab audio capture (`lib/audio-capture.ts`)

```typescript
export async function captureTabAudio(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { width: 1, height: 1 },   // Chrome requires video: true
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      sampleRate: 44100,
    }
  })

  // Remove video track — we only want audio
  stream.getVideoTracks().forEach(t => t.stop())
  return stream
}
```

### WebSocket sync hook (`hooks/useSync.ts`)

```typescript
export function useSync(roomCode: string, role: 'host' | 'listener') {
  const [clockOffset, setClockOffset] = useState(0)
  const [listeners, setListeners] = useState(0)
  const channelRef = useRef<Ably.RealtimeChannel | null>(null)

  useEffect(() => {
    const ably = new Ably.Realtime({ authUrl: '/api/ably-token' })
    const channel = ably.channels.get(`wavesync:${roomCode}`)
    channelRef.current = channel

    // Measure clock offset on join
    measureClockOffset(channel).then(setClockOffset)

    channel.subscribe('sync', (msg) => {
      // Host broadcasts: { action: 'play'|'pause'|'seek', serverTimestamp, audioPosition }
      handleSyncMessage(msg.data, clockOffset)
    })

    return () => { ably.close() }
  }, [roomCode])

  const broadcast = (action: SyncAction) => {
    channelRef.current?.publish('sync', {
      ...action,
      serverTimestamp: Date.now()
    })
  }

  return { broadcast, clockOffset, listeners }
}
```

---

## Sync Message Protocol

All messages sent over Ably follow this schema:

```typescript
type SyncMessage =
  | { action: 'play';  serverTimestamp: number; audioPosition: number }
  | { action: 'pause'; serverTimestamp: number; audioPosition: number }
  | { action: 'seek';  serverTimestamp: number; audioPosition: number }
  | { action: 'ping';  serverTimestamp: number }
  | { action: 'pong';  serverTimestamp: number; clientTimestamp: number }
```

---

## Environment Variables

```env
# Ably (realtime WebSockets)
ABLY_API_KEY=your_key_here

# Upstash Redis (room state)
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here
```

---

## Deployment Steps

1. `npx create-next-app@latest wavesync --typescript --tailwind --app`
2. `npm install ably @upstash/redis`
3. Create a free account at [ably.com](https://ably.com) → copy API key
4. Create a free Redis DB at [upstash.com](https://upstash.com) → copy REST URL + token
5. Add `.env.local` with all three keys
6. `vercel deploy`

---

## Known Constraints & Browser Support

| Constraint | Details |
|---|---|
| Tab audio capture | Chrome/Edge only — Firefox blocks `getDisplayMedia` audio-only |
| iOS Safari | Cannot capture audio; can join as listener |
| Spotify DRM | Audio is captured at the system/tab level post-DRM decode — legal for personal use |
| Latency floor | ~20–50ms is realistic; true 0ms is physically impossible over a network |
| Listener limit | Ably free tier supports 100 concurrent connections |
| File size | Large audio files (>50MB) should be streamed in chunks, not uploaded whole |

---

## UI Screens

### Screen 1 — Landing (`/`)
- App name + tagline
- Two CTAs: "Start a room" and "Join a room"
- Code input field for joining

### Screen 2 — Host Room (`/room/[code]`)
- Room code displayed prominently with copy button
- Upload audio file OR "Capture tab audio" button
- Audio player: waveform, progress bar, play/pause/seek controls
- Live listener count badge
- Volume slider

### Screen 3 — Listener Room (`/room/[code]`)
- Room code confirmation
- "Waiting for host..." state
- Sync status indicator (dot: green/yellow/red)
- Volume slider
- Currently playing track name (sent from host via Ably)

---

## Out of Scope (v1)

- Chat / messaging between participants
- Queue / playlist management
- Mobile app (PWA support is fine)
- Equalizer or audio effects
- Recording the session
- Peer-to-peer audio (WebRTC) — server relay only for v1

---

*Built with Next.js 14 · Ably · Upstash · Web Audio API · Deployed on Vercel*
