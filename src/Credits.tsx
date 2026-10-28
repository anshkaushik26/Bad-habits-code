import React, { useEffect, useState } from 'react';
import { AbsoluteFill, continueRender, delayRender, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import '@fontsource/inter/400.css';
import '@fontsource/inter/800.css';
import '@fontsource/jetbrains-mono/700.css';

const W = 1080;
const H = 1920;
const GLOW = '#3794ff';
const MONO = "'JetBrains Mono', Menlo, monospace";
const SANS = 'Inter, sans-serif';
const soft = `0 0 6px rgba(255,255,255,0.6), 0 0 22px rgba(55,148,255,0.55)`;

const HEADER_H = 110;
const ROW_H = 86;
const ROWS = 40;
const FINAL_H = 300;
const GAP1 = 120;
const GAP2 = 200;
const FINAL_CENTER = HEADER_H + GAP1 + ROWS * ROW_H + GAP2 + FINAL_H / 2;

export const Credits: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const dur = durationInFrames / fps;
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    Promise.all([document.fonts.load('800 60px Inter'), document.fonts.load('400 40px Inter'), document.fonts.load("700 40px 'JetBrains Mono'")])
      .then(() => document.fonts.ready)
      .then(() => continueRender(handle));
  }, [handle]);

  // endless credits: constant slow speed, never stops
  const SPEED = 260; // px per second
  const y = H * 0.62 - t * SPEED;
  const fadeIn = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [durationInFrames - 8, durationInFrames - 1], [1, 0], { extrapolateLeft: 'clamp' });

  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>

      <div style={{ position: 'absolute', left: 0, top: 0, width: W, transform: `translateY(${y}px)` }}>
        <div style={{ height: HEADER_H, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontWeight: 800, fontSize: 64, color: '#fff', letterSpacing: 2, textShadow: soft }}>
          wanna know more?
        </div>
        <div style={{ height: GAP1 }} />
        {Array.from({ length: ROWS }).map((_, i) => (
          <div key={i} style={{ height: ROW_H, display: 'flex', alignItems: 'center' }}>
            <div style={{ width: W / 2 - 30, textAlign: 'right', fontFamily: MONO, fontWeight: 700, fontSize: 44, color: '#e8f1ff', textShadow: soft }}>ansh26.exe</div>
            <div style={{ width: 60 }} />
            <div style={{ width: W / 2 - 30, textAlign: 'left', fontFamily: SANS, fontWeight: 400, fontSize: 44, color: '#cfd8e6', textShadow: soft }}>like and follow</div>
          </div>
        ))}
      </div>

      {/* edge fades so text rolls in/out softly */}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, #000 0%, transparent 14%, transparent 86%, #000 100%)' }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(0,0,0,0.75) 100%)' }} />
      <AbsoluteFill style={{ background: '#000', opacity: 1 - fadeIn }} />
    </AbsoluteFill>
  );
};
