export async function captureTabAudio(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { width: 1, height: 1 } as any,   // Chrome requires video: true
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      sampleRate: 44100,
    } as any
  });

  // Remove video track — we only want audio
  stream.getVideoTracks().forEach(t => t.stop());
  return stream;
}
