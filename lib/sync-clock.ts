const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function pingServer(): Promise<number> {
  const res = await fetch('/api/time', { cache: 'no-store' });
  if (!res.ok) throw new Error('Network error');
  const data = await res.json();
  return data.serverTime;
}

export async function measureClockOffset(): Promise<number> {
  const samples: number[] = [];

  for (let i = 0; i < 5; i++) {
    const t0 = Date.now();
    try {
      const serverTime = await pingServer();
      const t1 = Date.now();
      const rtt = t1 - t0;
      // clockOffset = localTime - serverTime
      samples.push((t0 + rtt / 2) - serverTime);
    } catch (e) {
      console.warn("Ping failed", e);
    }
    await sleep(100);
  }

  if (samples.length === 0) return 0;
  // Return median
  return samples.sort((a, b) => a - b)[Math.floor(samples.length / 2)];
}
