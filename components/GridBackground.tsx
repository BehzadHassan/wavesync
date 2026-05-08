"use client";

import { useEffect, useRef } from 'react';

export default function GridBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {/* Gradient base */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.08),transparent)]" />
      
      {/* Grid */}
      <div 
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(34,211,238,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34,211,238,0.5) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Perspective grid floor */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-[40vh] opacity-[0.06]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(34,211,238,0.8) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34,211,238,0.8) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
          transform: 'perspective(400px) rotateX(60deg)',
          transformOrigin: 'bottom center',
          maskImage: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 100%)',
        }}
      />

      {/* Floating orbs */}
      <div className="absolute top-[10%] left-[15%] w-72 h-72 bg-cyan-500/5 rounded-full blur-[100px] animate-float" />
      <div className="absolute top-[30%] right-[10%] w-96 h-96 bg-indigo-500/5 rounded-full blur-[120px] animate-float" style={{ animationDelay: '2s' }} />
      <div className="absolute bottom-[20%] left-[40%] w-80 h-80 bg-blue-500/5 rounded-full blur-[100px] animate-float" style={{ animationDelay: '4s' }} />

      {/* Vertical data streams */}
      {[15, 35, 55, 75, 90].map((left, i) => (
        <div
          key={i}
          className="absolute top-0 w-px h-full"
          style={{ left: `${left}%`, opacity: 0.03 }}
        >
          <div 
            className="w-full h-32 bg-gradient-to-b from-transparent via-cyan-400 to-transparent"
            style={{
              animation: `data-stream ${6 + i * 2}s linear ${i * 1.5}s infinite`,
            }}
          />
        </div>
      ))}
    </div>
  );
}
