"use client";

import { useEffect, useRef } from 'react';

export default function WaveformVisualizer({ 
  isActive = false, 
  barCount = 48,
  height = 80 
}: { 
  isActive?: boolean; 
  barCount?: number;
  height?: number;
}) {
  const barsRef = useRef<HTMLDivElement>(null);

  return (
    <div 
      ref={barsRef}
      className="flex items-end justify-center gap-[2px] w-full"
      style={{ height }}
    >
      {Array.from({ length: barCount }).map((_, i) => {
        const delay = (i / barCount) * 1.2;
        const baseHeight = Math.sin((i / barCount) * Math.PI) * 60 + 10;
        
        return (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: `${Math.max(100 / barCount - 1, 2)}%`,
              height: isActive ? `${baseHeight}%` : '8%',
              background: isActive 
                ? `linear-gradient(to top, rgba(34,211,238,0.8), rgba(99,102,241,0.6))`
                : 'rgba(255,255,255,0.06)',
              animation: isActive ? `wave-bar 1.2s ease-in-out ${delay}s infinite` : 'none',
              boxShadow: isActive ? '0 0 8px rgba(34,211,238,0.3)' : 'none',
              transition: 'height 0.5s ease, background 0.5s ease, box-shadow 0.5s ease',
            }}
          />
        );
      })}
    </div>
  );
}
