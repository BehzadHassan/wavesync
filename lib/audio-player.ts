export function schedulePlay(
  audioBuffer: AudioBuffer,
  serverPlayAt: number,
  clockOffset: number,
  audioCtx: AudioContext,
  startOffset: number = 0
): AudioBufferSourceNode {
  // localTime = serverTime + clockOffset
  const localPlayAt = serverPlayAt + clockOffset;
  const delaySeconds = (localPlayAt - Date.now()) / 1000;

  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioCtx.destination);
  
  // start(when, offset)
  // when is relative to audioCtx.currentTime
  const startTime = audioCtx.currentTime + Math.max(0, delaySeconds);
  
  // If the scheduled time has already passed, we might need to skip into the audio
  const timePassed = delaySeconds < 0 ? Math.abs(delaySeconds) : 0;
  
  source.start(startTime, startOffset + timePassed);

  return source;
}
