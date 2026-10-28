import React, { useEffect, useState } from 'react';
import { AbsoluteFill, continueRender, delayRender, interpolate, random, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import '@fontsource/inter/400.css';
import '@fontsource/inter/800.css';

const W = 1080;
const H = 1920;
const GLOW = '#3794ff';
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// Neon "flicker-on": each letter blinks randomly before it locks on.
const NeonWord: React.FC<{
  text: string;
  start: number; // seconds
  t: number;
  size: number;
  weight: number;
  spacing?: number;
  color?: string;
  glow?: string;
  seed: string;
}> = ({ text, start, t, size, weight, spacing = 0, color = '#ffffff', glow = GLOW, seed }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', letterSpacing: spacing }}>
      {text.split('').map((ch, i) => {
        const ls = start + i * 0.045; // letter start
        const local = t - ls;
        let on = 0;
        if (local >= 0) {
          const settle = 0.32;
          if (local > settle) on = 1;
          else {
            const f = Math.floor(local * 30);
            on = random(`${seed}-${i}-${f}`) < 0.35 + (local / settle) * 0.6 ? 1 : 0.12;
          }
        }
        const lift = interpolate(local, [0, 0.35], [24, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
        const blur = interpolate(local, [0, 0.3], [10, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              whiteSpace: 'pre',
              fontFamily: 'Inter, sans-serif',
              fontWeight: weight,
              fontSize: size,
              color,
              opacity: local < 0 ? 0 : on,
              transform: `translateY(${lift}px)`,
              filter: blur > 0.2 ? `blur(${blur}px)` : undefined,
              textShadow: `0 0 6px #ffffff, 0 0 18px ${glow}, 0 0 40px ${glow}, 0 0 90px ${glow}, -2px 0 rgba(255,40,90,0.55), 2px 0 rgba(40,170,255,0.55)`,
            }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
};

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const t = frame / fps;
  const dur = durationInFrames / fps;
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    Promise.all([document.fonts.load('800 100px Inter'), document.fonts.load('400 40px Inter')])
      .then(() => document.fonts.ready)
      .then(() => continueRender(handle));
  }, [handle]);

  // slow camera push + drift
  const z = interpolate(t, [0, dur], [1.0, 1.1]);
  const rx = 8 + 2 * Math.sin(t * 0.9);
  const ry = -10 + 4 * Math.sin(t * 0.7);
  const pulse = 0.85 + 0.15 * Math.sin(t * 6);
  // glitch-out at the end
  const outT = clamp((t - (dur - 0.35)) / 0.35, 0, 1);
  const gx = outT > 0 ? (random(`g${frame}`) - 0.5) * 60 * outT : 0;
  const fadeIn = clamp(frame / 6, 0, 1);

  return (
    <AbsoluteFill style={{ background: '#05070b', overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, rgba(0,120,212,${0.28 * pulse}) 0%, transparent 55%)` }} />
      <AbsoluteFill style={{ perspective: 1600 }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: W,
            height: H,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            transform: `translateX(${gx}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${z})`,
            opacity: 1 - outT,
            filter: outT > 0 ? `blur(${outT * 16}px)` : undefined,
          }}
        >
          <NeonWord text="LIKE" start={0.15} t={t} size={230} weight={800} spacing={12} seed="like" />
          <NeonWord text="& FOLLOW" start={0.7} t={t} size={150} weight={800} spacing={8} seed="follow" />
          <div style={{ height: 40 }} />
          <NeonWord text="for more edits" start={1.35} t={t} size={64} weight={400} spacing={14} color="#cfe3ff" seed="edits" />
        </div>
      </AbsoluteFill>
      {/* scanlines + vignette + grain */}
      <AbsoluteFill style={{ background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 2px, transparent 4px)' }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 48%, transparent 40%, rgba(0,0,0,0.78) 100%)' }} />
      <AbsoluteFill style={{ mixBlendMode: 'overlay', opacity: 0.16 }}>
        <svg width={W} height={H}>
          <filter id="g2">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves={2} seed={frame % 97} stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width={W} height={H} filter="url(#g2)" />
        </svg>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: '#000', opacity: 1 - fadeIn }} />
    </AbsoluteFill>
  );
};
