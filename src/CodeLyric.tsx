import React, { useEffect, useMemo, useState } from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  continueRender,
  delayRender,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import cfgJson from './data/lyrics.json';
import beatsJson from './data/beats.json';
import { runs } from './highlight';
import {
  Config,
  Fx,
  FPS,
  H,
  L,
  W,
  buildTerminal,
  changedLinesSinceCommit,
  currentLine,
  cursorWorld,
  lastTypeTime,
  parse,
  simulateCamera,
  typedChars,
  visibleTerm,
} from './engine';

const cfg = cfgJson as unknown as Config;
const beats = beatsJson as { beats: number[]; kicks: number[] };

const MONO = "'JetBrains Mono', Menlo, monospace";
const UI = "Inter, -apple-system, 'Segoe UI', sans-serif";
const ACCENT = '#3794ff';
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ---------------- helpers ----------------
const decay = (tv: number, times: number[], tau: number) => {
  let best = 0;
  for (const t of times) if (t <= tv) best = Math.max(best, Math.exp(-(tv - t) / tau));
  return best;
};

// ---------------- world: the editor window ----------------
const Icon: React.FC<{ y: number; kind: string; active?: boolean; badge?: number }> = ({ y, kind, active, badge }) => {
  const c = active ? '#ffffff' : '#858585';
  return (
    <div style={{ position: 'absolute', left: 0, top: y, width: L.actW, height: 64 }}>
      {active && <div style={{ position: 'absolute', left: 0, top: 8, width: 3, height: 48, background: '#fff' }} />}
      <svg width={L.actW} height={64} viewBox="0 0 68 64" fill="none" stroke={c} strokeWidth={2.4}>
        {kind === 'files' && (
          <>
            <rect x={22} y={16} width={20} height={26} rx={2} />
            <path d="M27 16 V12 H46 V36 H42" />
          </>
        )}
        {kind === 'search' && (
          <>
            <circle cx={36} cy={28} r={9} />
            <path d="M29 35 L21 43" />
          </>
        )}
        {kind === 'git' && (
          <>
            <circle cx={26} cy={18} r={4} />
            <circle cx={26} cy={46} r={4} />
            <circle cx={42} cy={24} r={4} />
            <path d="M26 22 V42 M42 28 C42 36 26 34 26 42" />
          </>
        )}
        {kind === 'ext' && (
          <>
            <rect x={20} y={28} width={10} height={10} />
            <rect x={30} y={28} width={10} height={10} />
            <rect x={20} y={38} width={10} height={10} />
            <rect x={34} y={14} width={10} height={10} />
          </>
        )}
      </svg>
      {!!badge && (
        <div
          style={{
            position: 'absolute', left: 36, top: 34, minWidth: 22, height: 22, borderRadius: 11,
            background: '#0078d4', color: '#fff', fontFamily: UI, fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {badge}
        </div>
      )}
    </div>
  );
};

const Squiggle: React.FC<{ x: number; y: number; w: number }> = ({ x, y, w }) => {
  let d = `M0 3`;
  for (let i = 0; i <= w; i += 5) d += ` L${i} ${i % 10 === 0 ? 0 : 6}`;
  return (
    <svg style={{ position: 'absolute', left: x, top: y }} width={w} height={8}>
      <path d={d} stroke="#f14c4c" strokeWidth={2} fill="none" />
    </svg>
  );
};

const Editor: React.FC<{
  tv: number;
  p: ReturnType<typeof parse>;
  term: ReturnType<typeof buildTerminal>['term'];
  events: ReturnType<typeof buildTerminal>['events'];
  dof: number;
  glitch: number;
}> = ({ tv, p, term, events, dof, glitch }) => {
  const cur = cursorWorld(p.lines, tv);
  const changed = changedLinesSinceCommit(p, events, tv);
  const maxLine = Math.max(cur.li, 0);
  const idle = tv - lastTypeTime(p.lines, tv);
  const cursorOn = idle < 0.45 || Math.floor((idle - 0.45) / 0.5) % 2 === 0;
  const squiggles = p.fx.filter((f) => f.type === 'squiggle' && tv >= f.t);
  const errors = squiggles.length;
  const conflict = events.find((e) => e.kind === 'conflict' && tv >= e.t && tv < e.end);
  const conflictFlicker = conflict ? (tv - conflict.t < 0.25 ? Math.floor((tv - conflict.t) * 30) % 2 === 0 : true) : false;
  const ca = 0.7 + glitch * 4;
  const shadow = `${-ca}px 0 rgba(255,40,90,0.45), ${ca}px 0 rgba(40,170,255,0.45), 0 0 9px rgba(120,170,255,0.25)`;
  const unsaved = changed.length > 0;

  return (
    <div style={{ position: 'absolute', width: W, height: H, background: '#1e1e1e', overflow: 'hidden', borderRadius: 18, boxShadow: '0 0 0 1px #333, 0 40px 120px rgba(0,0,0,0.7)' }}>
      {/* title bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: L.titleH, background: '#181818', borderBottom: '1px solid #2b2b2b' }}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c, i) => (
          <div key={c} style={{ position: 'absolute', left: 20 + i * 24, top: 15, width: 14, height: 14, borderRadius: 7, background: c }} />
        ))}
        <div style={{ position: 'absolute', width: W, top: 11, textAlign: 'center', fontFamily: UI, fontSize: 17, color: '#9d9d9d' }}>
          {cfg.fileName} — {cfg.folder}
        </div>
      </div>
      {/* activity bar */}
      <div style={{ position: 'absolute', left: 0, top: L.titleH, width: L.actW, height: L.statusY - L.titleH, background: '#181818', borderRight: '1px solid #2b2b2b' }}>
        <Icon y={8} kind="files" active />
        <Icon y={76} kind="search" />
        <Icon y={144} kind="git" badge={changed.length} />
        <Icon y={212} kind="ext" />
      </div>
      {/* tabs */}
      <div style={{ position: 'absolute', left: L.actW, top: L.tabsY, width: W - L.actW, height: L.tabsH, background: '#181818', borderBottom: '1px solid #2b2b2b' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: L.tabsH, width: 300, background: '#1e1e1e', borderTop: `2px solid ${ACCENT}`, display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 18, fontFamily: UI, fontSize: 19, color: '#fff' }}>
          <span style={{ color: '#cbcb41', fontWeight: 600, fontSize: 15, fontFamily: MONO }}>JS</span>
          <span>{cfg.fileName}</span>
          <span style={{ marginLeft: 'auto', marginRight: 16, color: '#ccc', fontSize: unsaved ? 22 : 18 }}>{unsaved ? '●' : '×'}</span>
        </div>
        <div style={{ position: 'absolute', left: 300, top: 0, height: L.tabsH, width: 220, display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 18, fontFamily: UI, fontSize: 19, color: '#8b8b8b', borderRight: '1px solid #2b2b2b' }}>
          <span style={{ color: '#519aba', fontSize: 15, fontFamily: MONO }}>MD</span>
          <span>README.md</span>
        </div>
      </div>
      {/* breadcrumb */}
      <div style={{ position: 'absolute', left: L.actW + 18, top: L.crumbY + 6, fontFamily: UI, fontSize: 17, color: '#a9a9a9' }}>
        src › <span style={{ color: '#cbcb41' }}>JS</span> {cfg.fileName} › line {cur.li + 1}
      </div>

      {/* current line highlight */}
      <div style={{ position: 'absolute', left: L.gutterX, top: L.codeTop + cur.li * L.lineH, width: L.minimapX - L.gutterX, height: L.lineH, background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(255,255,255,0.06)', boxSizing: 'border-box' }} />

      {/* gutter: numbers + git decorations */}
      {Array.from({ length: maxLine + 1 }).map((_, i) => {
        const blur = Math.min(Math.abs(i - cur.li), 3) * 1.3 * dof;
        return (
          <div key={'g' + i} style={{ position: 'absolute', left: L.gutterX, top: L.codeTop + i * L.lineH, width: 78, height: L.lineH, textAlign: 'right', fontFamily: MONO, fontSize: 26, lineHeight: `${L.lineH}px`, color: i === cur.li ? '#c6c6c6' : '#6e7681', filter: blur > 0.2 ? `blur(${blur}px)` : undefined }}>
            {i + 1}
          </div>
        );
      })}
      {changed.map((i) => (
        <div key={'d' + i} style={{ position: 'absolute', left: L.gutterX + 88, top: L.codeTop + i * L.lineH + 6, width: 5, height: L.lineH - 12, background: '#2ea043' }} />
      ))}

      {/* code */}
      {p.lines.map((line, i) => {
        const n = typedChars(line, tv);
        if (n <= 0) return null;
        const blur = Math.min(Math.abs(i - cur.li), 3) * 1.4 * dof;
        return (
          <div key={'l' + i} style={{ position: 'absolute', left: L.codeX, top: L.codeTop + i * L.lineH, height: L.lineH, lineHeight: `${L.lineH}px`, fontFamily: MONO, fontSize: L.font, whiteSpace: 'pre', textShadow: shadow, filter: blur > 0.2 ? `blur(${blur}px)` : undefined }}>
            {runs(line.text, line.colors, n).map((r, k) => (
              <span key={k} style={{ color: r.color }}>{r.text}</span>
            ))}
          </div>
        );
      })}

      {/* squiggles */}
      {squiggles.map((f, k) => {
        const line = p.lines[f.line ?? 0];
        const seg = line?.segs[f.seg ?? 0];
        if (!seg) return null;
        const s = Math.max(seg.start, line.indent);
        const word = line.text.slice(s, seg.end).replace(/[,;()\s]+$/, '');
        return <Squiggle key={'s' + k} x={L.codeX + s * L.charW} y={L.codeTop + (f.line ?? 0) * L.lineH + L.lineH - 12} w={word.length * L.charW} />;
      })}

      {/* merge-conflict markers */}
      {conflict && conflictFlicker && (
        <>
          <div style={{ position: 'absolute', left: L.codeX + Math.max(0, cur.x - L.codeX - 10 * L.charW), top: L.codeTop + (cur.li - 1) * L.lineH - 30, whiteSpace: 'pre', fontFamily: UI, fontSize: 16, color: '#9d9d9d' }}>
            Accept Current Change | Accept Incoming Change | Accept Both Changes
          </div>
          <div style={{ position: 'absolute', left: L.gutterX + 94, top: L.codeTop + (cur.li - 1) * L.lineH, width: L.minimapX - L.gutterX - 94, height: L.lineH, background: 'rgba(40,160,90,0.55)', fontFamily: MONO, fontSize: L.font, lineHeight: `${L.lineH}px`, paddingLeft: L.codeX - L.gutterX - 94, color: '#e8e8e8', whiteSpace: 'pre', boxSizing: 'border-box' }}>
            <span style={{ position: 'absolute', left: Math.max(0, cur.x - L.codeX - 10 * L.charW) + L.codeX - L.gutterX - 94 }}>{'<<<<<<< HEAD (Current Change)'}</span>
          </div>
          <div style={{ position: 'absolute', left: L.gutterX + 94, top: L.codeTop + (cur.li + 1) * L.lineH, width: L.minimapX - L.gutterX - 94, height: L.lineH, background: 'rgba(30,110,200,0.6)', fontFamily: MONO, fontSize: L.font, lineHeight: `${L.lineH}px`, paddingLeft: L.codeX - L.gutterX - 94, color: '#e8e8e8', whiteSpace: 'pre', boxSizing: 'border-box' }}>
            <span style={{ position: 'absolute', left: Math.max(0, cur.x - L.codeX - 10 * L.charW) + L.codeX - L.gutterX - 94 }}>{'>>>>>>> origin/' + cfg.branch + ' (Incoming Change)'}</span>
          </div>
        </>
      )}

      {/* cursor */}
      {cursorOn && (
        <div style={{ position: 'absolute', left: cur.x + 1, top: L.codeTop + cur.li * L.lineH + 8, width: L.charW * 0.9, height: L.lineH - 16, background: ACCENT, boxShadow: `0 0 18px ${ACCENT}, 0 0 4px #fff` }} />
      )}

      {/* minimap */}
      <div style={{ position: 'absolute', left: L.minimapX, top: L.codeTop, width: 80, height: 300 }}>
        <div style={{ position: 'absolute', left: 0, top: Math.max(0, cur.li * 5 - 20), width: 80, height: 70, background: 'rgba(121,121,121,0.18)' }} />
        {p.lines.map((line, i) =>
          runs(line.text, line.colors, typedChars(line, tv)).reduce<{ x: number; el: React.ReactNode[] }>(
            (acc, r, k) => {
              if (r.text.trim()) acc.el.push(<div key={i + '-' + k} style={{ position: 'absolute', left: acc.x * 1.6, top: i * 5, width: r.text.length * 1.6, height: 3, background: r.color, opacity: 0.7 }} />);
              acc.x += r.text.length;
              return acc;
            },
            { x: 0, el: [] },
          ).el,
        )}
      </div>

      {/* panel */}
      <div style={{ position: 'absolute', left: L.actW, top: L.panelY, width: W - L.actW, height: L.statusY - L.panelY, background: '#181818', borderTop: '1px solid #2b2b2b' }}>
        <div style={{ display: 'flex', gap: 34, paddingLeft: 30, height: L.panelTabsH, alignItems: 'center', fontFamily: UI, fontSize: 16, letterSpacing: 0.6, color: '#9d9d9d' }}>
          <span>
            PROBLEMS{' '}
            {errors > 0 && <span style={{ background: '#616161', color: '#fff', borderRadius: 9, padding: '1px 7px', fontSize: 13 }}>{errors}</span>}
          </span>
          <span>OUTPUT</span>
          <span>DEBUG CONSOLE</span>
          <span style={{ color: '#e7e7e7', borderBottom: `2px solid ${ACCENT}`, paddingBottom: 6, marginTop: 8 }}>TERMINAL</span>
        </div>
      </div>
      {visibleTerm(term, tv).map((tl, i) => {
        const y = L.termTop + i * L.termLineH;
        const style: React.CSSProperties = { position: 'absolute', left: L.termX, top: y, fontFamily: MONO, fontSize: L.termFont, lineHeight: `${L.termLineH}px`, whiteSpace: 'pre', textShadow: '0 0 6px rgba(120,170,255,0.2)' };
        if (tl.prompt) {
          const typed = tl.cmd ? Math.floor(clamp((tv - (tl.typeStart ?? 0)) / Math.max(0.001, tl.typeDur ?? 0), 0, 1) * tl.cmd.length) : 0;
          const isLast = i === visibleTerm(term, tv).length - 1;
          const blink = isLast && Math.floor(tv * 2) % 2 === 0;
          return (
            <div key={'t' + i} style={style}>
              <span style={{ color: '#3b8eea' }}>~/{cfg.folder} </span>
              <span style={{ color: '#d670d6' }}>({cfg.branch})</span>
              <span style={{ color: '#e5e5e5' }}> $ </span>
              <span style={{ color: '#e5e5e5' }}>{(tl.cmd ?? '').slice(0, typed)}</span>
              {isLast && (blink || typed < (tl.cmd?.length ?? 0)) && <span style={{ background: '#e5e5e5', color: '#e5e5e5' }}> </span>}
            </div>
          );
        }
        return (
          <div key={'t' + i} style={style}>
            {tl.spans?.map((s, k) => (
              <span key={k} style={{ color: s.color }}>{s.text}</span>
            ))}
          </div>
        );
      })}

      {/* status bar */}
      <div style={{ position: 'absolute', left: 0, top: L.statusY, width: W, height: H - L.statusY, background: '#0078d4', display: 'flex', alignItems: 'center', fontFamily: UI, fontSize: 17, color: '#fff', gap: 26, paddingLeft: 18 }}>
        <span>⎇ {cfg.branch}{unsaved ? '*' : ''}</span>
        <span>⊗ {errors}  ⚠ 0</span>
        <span style={{ marginLeft: 'auto' }}>Ln {cur.li + 1}, Col {cur.col + 1}</span>
        <span>Spaces: 2</span>
        <span>UTF-8</span>
        <span style={{ marginRight: 22 }}>{'{ }'} JavaScript</span>
      </div>
    </div>
  );
};

// ---------------- screen-space popup ----------------
const Popup: React.FC<{ tv: number; frame: number; p: ReturnType<typeof parse> }> = ({ tv, frame, p }) => {
  const f = p.fx.find((x) => x.type === 'popup' && tv >= x.t && tv < x.t + (x.dur ?? 2.2));
  if (!f) return null;
  const d = f.dur ?? 2.2;
  const local = tv - f.t;
  const inS = spring({ frame: Math.round(local * FPS), fps: FPS, config: { damping: 13, stiffness: 190 } });
  const out = clamp((local - (d - 0.28)) / 0.28, 0, 1);
  const s = inS * (1 - out * 0.35);
  const pressed = local > d * 0.62;
  const flash = pressed ? Math.exp(-(local - d * 0.62) / 0.15) : 0;
  void frame;
  return (
    <AbsoluteFill style={{ background: `rgba(0,0,0,${0.35 * inS * (1 - out)})` }}>
      <div style={{ position: 'absolute', left: W / 2 - 400, top: H * 0.4 - 160, width: 800, perspective: 1300 }}>
        <div
          style={{
            transform: `rotateX(${12 - 8 * inS}deg) rotateY(-14deg) rotateZ(-2deg) scale(${0.6 + 0.4 * s})`,
            opacity: clamp(inS * 1.4, 0, 1) * (1 - out),
            filter: out > 0 ? `blur(${out * 14}px)` : undefined,
            background: '#252526',
            border: '1px solid #454545',
            borderRadius: 16,
            boxShadow: `0 30px 90px rgba(0,0,0,0.75), 0 0 60px rgba(55,148,255,${0.2 + flash * 0.4})`,
            padding: '34px 36px 30px',
            fontFamily: UI,
          }}
        >
          <div style={{ display: 'flex', gap: 22, alignItems: 'flex-start' }}>
            <svg width={56} height={56} viewBox="0 0 24 24">
              <path d="M12 2 L23 21 H1 Z" fill="#cca700" />
              <rect x={11} y={8} width={2} height={7} fill="#252526" />
              <rect x={11} y={17} width={2} height={2} fill="#252526" />
            </svg>
            <div>
              <div style={{ fontSize: 34, fontWeight: 600, color: '#fff' }}>{f.title ?? 'Force push?'}</div>
              <div style={{ fontSize: 24, color: '#bdbdbd', marginTop: 12, lineHeight: 1.4 }}>{f.body ?? ''}</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 30 }}>
            <div style={{ padding: '12px 28px', borderRadius: 8, background: '#3a3d41', color: '#ddd', fontSize: 22 }}>Cancel</div>
            <div style={{ padding: '12px 28px', borderRadius: 8, background: pressed ? '#1177bb' : '#0e639c', color: '#fff', fontSize: 22, fontWeight: 600, transform: `scale(${1 - flash * 0.06})`, boxShadow: `0 0 ${30 * flash}px ${ACCENT}` }}>
              Force Push
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------- screen-space image (album cover, photos) ----------------
const ImageCard: React.FC<{ f: Fx; tv: number }> = ({ f, tv }) => {
  const d = f.dur ?? 2;
  const local = tv - f.t;
  const inS = spring({ frame: Math.max(0, Math.round(local * FPS)), fps: FPS, config: { damping: 14, stiffness: 170 } });
  const out = clamp((local - (d - 0.3)) / 0.3, 0, 1);
  const glitch = Math.max(local < 0.3 ? 1 - local / 0.3 : 0, out);
  const fr = Math.round(tv * FPS);
  const src = staticFile(f.src ?? '');
  const name = (f.src ?? '').split('/').pop();
  const imgStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' };
  const sliced =
    glitch > 0.05 ? (
      [0, 1, 2, 3, 4, 5].map((k) => (
        <div key={k} style={{ position: 'absolute', inset: 0, clipPath: `inset(${k * 16.66}% 0 ${100 - (k + 1) * 16.66}% 0)`, transform: `translateX(${(random(`${fr}-${k}-${f.t}`) - 0.5) * 90 * glitch}px)` }}>
          <Img src={src} style={imgStyle} />
        </div>
      ))
    ) : (
      <Img src={src} style={imgStyle} />
    );
  const split = `drop-shadow(${8 * glitch}px 0 rgba(255,0,70,0.75)) drop-shadow(${-8 * glitch}px 0 rgba(0,160,255,0.75))`;

  if (f.style === 'polaroid') {
    const y = (1 - inS) * 1200 - out * 1400;
    const rot = -6 + (1 - inS) * 18 + local * 1.5;
    return (
      <AbsoluteFill style={{ perspective: 1400 }}>
        <div style={{ position: 'absolute', left: W / 2 - 340, top: H * 0.4 - 400, width: 680, background: '#f2efe8', padding: '30px 30px 120px', boxSizing: 'border-box', boxShadow: '0 50px 120px rgba(0,0,0,0.75)', transform: `translateY(${y}px) rotateZ(${rot}deg) rotateX(${10 - 10 * inS}deg)`, filter: `${split}${out > 0 ? ` blur(${out * 10}px)` : ''}` }}>
          <div style={{ position: 'relative', width: 620, height: 620, overflow: 'hidden' }}>{sliced}</div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 40, textAlign: 'center', fontFamily: MONO, fontSize: 30, color: '#2b2b2b' }}>{f.caption ?? name}</div>
        </div>
      </AbsoluteFill>
    );
  }

  const s = inS * (1 - out * 0.3);
  return (
    <AbsoluteFill style={{ background: `rgba(0,0,0,${0.4 * inS * (1 - out)})` }}>
      <div style={{ position: 'absolute', left: W / 2 - 390, top: H * 0.4 - 450, width: 780, perspective: 1400 }}>
        <div style={{ transform: `rotateX(${10 - 6 * inS}deg) rotateY(-12deg) rotateZ(-2deg) scale(${0.55 + 0.45 * s})`, opacity: clamp(inS * 1.5, 0, 1) * (1 - out), filter: `${split}${out > 0 ? ` blur(${out * 12}px)` : ''}`, background: '#1e1e1e', border: '1px solid #3c3c3c', borderRadius: 14, overflow: 'hidden', boxShadow: '0 40px 110px rgba(0,0,0,0.8), 0 0 70px rgba(55,148,255,0.25)' }}>
          <div style={{ height: 56, background: '#181818', borderBottom: '1px solid #2b2b2b', display: 'flex', alignItems: 'center' }}>
            <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '0 22px', background: '#1e1e1e', borderTop: `2px solid ${ACCENT}`, fontFamily: UI, fontSize: 21, color: '#fff' }}>
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#a074c4" strokeWidth={2}>
                <rect x={3} y={4} width={18} height={16} rx={2} />
                <circle cx={9} cy={10} r={2} />
                <path d="M21 17 L15 11 L5 20" />
              </svg>
              <span>{name}</span>
              <span style={{ color: '#aaa', marginLeft: 10 }}>×</span>
            </div>
          </div>
          <div style={{ padding: 24, background: 'repeating-conic-gradient(#232323 0% 25%, #1b1b1b 0% 50%) 0 0 / 24px 24px' }}>
            <div style={{ position: 'relative', width: 732, height: 732, overflow: 'hidden' }}>{sliced}</div>
          </div>
          <div style={{ height: 40, background: '#0078d4', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 24, paddingRight: 20, fontFamily: UI, fontSize: 16, color: '#fff' }}>
            <span>{f.caption ?? 'Image Preview'}</span>
            <span>100%</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Images: React.FC<{ tv: number; p: ReturnType<typeof parse> }> = ({ tv, p }) => (
  <>
    {p.fx
      .filter((f) => f.type === 'image' && f.src && tv >= f.t && tv < f.t + (f.dur ?? 2))
      .map((f, i) => (
        <ImageCard key={i} f={f} tv={tv} />
      ))}
  </>
);

// ---------------- main composition ----------------
export const CodeLyric: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    Promise.all([
      document.fonts.load(`34px 'JetBrains Mono'`),
      document.fonts.load(`700 34px 'JetBrains Mono'`),
      document.fonts.load(`20px Inter`),
      document.fonts.load(`600 20px Inter`),
    ])
      .then(() => document.fonts.ready)
      .then(() => continueRender(handle));
  }, [handle]);

  const lead = cfg.lead ?? 0;
  const p = useMemo(() => parse(cfg), []);
  const { term, events } = useMemo(() => buildTerminal(p, cfg), [p]);
  const cams = useMemo(() => simulateCamera(p, term, events, durationInFrames, lead), [p, term, events, durationInFrames, lead]);

  const tv = frame / FPS + lead;
  const cam = cams[frame];
  const prev = cams[Math.max(0, frame - 1)];

  // music-driven motion
  const kick = decay(tv, beats.kicks ?? [], 0.13);
  const shakeTimes = p.fx.filter((f) => f.type === 'shake').map((f) => f.t);
  const glitch = decay(tv, shakeTimes, 0.28);
  const z = cam.z * (1 + 0.035 * kick + 0.08 * glitch);
  const shx = (random(`x${frame}`) - 0.5) * 40 * glitch + (random(`kx${frame}`) - 0.5) * 4 * kick;
  const shy = (random(`y${frame}`) - 0.5) * 40 * glitch;

  const ending = events.find((e) => e.kind === 'ending' && tv >= e.t);
  const t = tv;
  const rx = 9 + 3 * Math.sin(0.27 * t + 1);
  const ry = -7 + 5 * Math.sin(0.35 * t) - clamp(cam.vx * 0.005, -14, 14);
  const rz = -1.5 + 1.2 * Math.sin(0.21 * t) + glitch * (random(`r${frame}`) - 0.5) * 4;

  // motion blur from camera velocity (screen space)
  const dx = (cam.x - prev.x) * cam.z - (cam.ax - prev.ax) * W;
  const dy = (cam.y - prev.y) * cam.z - (cam.ay - prev.ay) * H;
  const mbx = clamp(Math.abs(dx) * 0.45, 0, 60);
  const mby = clamp(Math.abs(dy) * 0.45, 0, 60);
  const hasMb = mbx + mby > 0.6;

  const dof = clamp((cam.z - 1.3) / 1.5, 0, 1);
  const ax = cam.ax * W + shx;
  const ay = cam.ay * H + shy;
  const fadeIn = clamp(frame / 12, 0, 1);
  const fadeOut = clamp((durationInFrames - 1 - frame) / 18, 0, 1);
  const endGlow = ending ? clamp((tv - ending.t) / 1.5, 0, 1) : 0;

  return (
    <AbsoluteFill style={{ background: '#07090d', overflow: 'hidden' }}>
      <Audio src={staticFile(cfg.audio)} />
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        <filter id="mb" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation={`${mbx} ${mby}`} />
        </filter>
      </svg>

      {/* ambient light */}
      <AbsoluteFill style={{ background: `radial-gradient(circle at 30% 35%, rgba(0,120,212,${0.18 + 0.12 * kick + 0.25 * endGlow}) 0%, transparent 60%)` }} />

      <AbsoluteFill style={{ filter: hasMb ? 'url(#mb)' : undefined }}>
        <AbsoluteFill style={{ perspective: 1700, perspectiveOrigin: `${ax}px ${ay}px` }}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: W,
              height: H,
              transformOrigin: `${cam.x}px ${cam.y}px`,
              transform: `translate(${ax - cam.x}px, ${ay - cam.y}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${z})`,
            }}
          >
            <Editor tv={tv} p={p} term={term} events={events} dof={dof} glitch={glitch} />
          </div>
        </AbsoluteFill>
      </AbsoluteFill>

      <Popup tv={tv} frame={frame} p={p} />
      <Images tv={tv} p={p} />

      {/* film look: vignette, grain, flashes */}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 55% 48%, transparent 45%, rgba(0,0,0,0.72) 100%)' }} />
      <AbsoluteFill style={{ mixBlendMode: 'overlay', opacity: 0.16 }}>
        <svg width={W} height={H}>
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves={2} seed={frame % 97} stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width={W} height={H} filter="url(#grain)" />
        </svg>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `rgba(55,148,255,${0.1 * glitch})`, mixBlendMode: 'screen' }} />
      <AbsoluteFill style={{ background: '#000', opacity: 1 - fadeIn * fadeOut }} />
    </AbsoluteFill>
  );
};

export { currentLine };
