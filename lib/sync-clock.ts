const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function pingServer(): Promise<number> {
  const res = await fetch('/api/time', { cache: 'no-store' });
  if (!res.ok) throw new Error('Network error');
  const data = await res.json();
  return data.serverTime;
}

export async function measureClockOffset(): Promise<number> {
  const samples: { rtt: number; offset: number }[] = [];

  // Warmup request (discarded) to establish TLS/DNS and avoid cold start
  try { await pingServer(); } catch (e) {}

  for (let i = 0; i < 8; i++) {
    const t0 = Date.now();
    try {
      const serverTime = await pingServer();
      const t1 = Date.now();
      const rtt = t1 - t0;
      // clockOffset = localTime - serverTime
      const offset = (t0 + rtt / 2) - serverTime;
      samples.push({ rtt, offset });
    } catch (e) {
      console.warn("Ping failed", e);
    }
    await sleep(50);
  }

  if (samples.length === 0) return 0;
  
  // Sort by RTT and take the fastest 3 samples (they have the most symmetric network delay)
  samples.sort((a, b) => a.rtt - b.rtt);
  const bestSamples = samples.slice(0, 3);
  
  // Average the offsets of the best samples
  const avgOffset = bestSamples.reduce((sum, s) => sum + s.offset, 0) / bestSamples.length;
  
  return Math.round(avgOffset);
}
