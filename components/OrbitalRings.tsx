"use client";

export default function OrbitalRings({ size = 200, playing = false }: { size?: number; playing?: boolean }) {
  return (
    <div className="relative" style={{ width: size, height: size, perspective: '600px' }}>
      {/* Ring 1 */}
      <div
        className="absolute inset-0 rounded-full border border-cyan-500/20 animate-ring-spin"
        style={{ transformStyle: 'preserve-3d' }}
      />
      {/* Ring 2 */}
      <div
        className="absolute rounded-full border border-indigo-500/15 animate-ring-spin-reverse"
        style={{ 
          inset: `${size * 0.1}px`,
          transformStyle: 'preserve-3d',
        }}
      />
      {/* Ring 3 — dashed */}
      <div
        className="absolute rounded-full border border-dashed border-cyan-500/10 animate-ring-spin"
        style={{ 
          inset: `${size * 0.2}px`,
          transformStyle: 'preserve-3d',
          animationDuration: '15s',
        }}
      />
      
      {/* Orbiting dots */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: size,
            height: size,
          }}
        >
          <div
            className="animate-orbit"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              '--orbit-radius': `${size * 0.35 + i * 15}px`,
              '--orbit-duration': `${8 + i * 4}s`,
              animationDirection: i % 2 === 0 ? 'normal' : 'reverse',
            } as React.CSSProperties}
          >
            <div 
              className="w-2 h-2 rounded-full bg-cyan-400"
              style={{
                boxShadow: playing 
                  ? '0 0 10px rgba(34,211,238,0.8), 0 0 20px rgba(34,211,238,0.4)' 
                  : '0 0 6px rgba(34,211,238,0.4)',
                opacity: playing ? 1 : 0.5,
              }}
            />
          </div>
        </div>
      ))}
      
      {/* Center glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div 
          className={`rounded-full transition-all duration-1000 ${playing ? 'animate-glow-pulse' : ''}`}
          style={{
            width: size * 0.2,
            height: size * 0.2,
            background: `radial-gradient(circle, rgba(34,211,238,${playing ? 0.4 : 0.1}) 0%, transparent 70%)`,
          }}
        />
      </div>
    </div>
  );
}
