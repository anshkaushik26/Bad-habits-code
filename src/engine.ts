// Timeline engine: turns lyrics.json + beats.json into everything the video needs
// at a given time (typed characters, cursor, terminal, camera path).
import { colorize } from './highlight';

export const FPS = 30;
export const W = 1080;
export const H = 1920;

// ---- World layout (the VS Code-style window, 1080x1920) ----
export const L = {
  titleH: 44,
  actW: 68,
  tabsY: 44,
  tabsH: 52,
  crumbY: 96,
  crumbH: 36,
  codeTop: 150,
  gutterX: 68,
  codeX: 172,
  font: 34,
  charW: 34 * 0.6,
  lineH: 58,
  minimapX: 992,
  panelY: 1250,
  panelTabsH: 54,
  termX: 100,
  termTop: 1330,
  termFont: 25,
  termCharW: 25 * 0.6,
  termLineH: 40,
  termRows: 13,
  statusY: 1880,
};

export type Fx = {
  t: number;
  type: 'shake' | 'commit' | 'squiggle' | 'conflict' | 'popup' | 'ending' | 'overview' | 'image';
  dur?: number;
  line?: number;
  seg?: number;
  msg?: string;
  title?: string;
  body?: string;
  src?: string; // image file inside public/, e.g. "images/cover.jpg"
  style?: 'window' | 'polaroid';
  caption?: string;
};

export type Config = {
  fileName: string;
  folder: string;
  branch: string;
  audio: string;
  offset: number;
  lead: number;
  lines: { text: string; times: number[] }[];
  fx: Fx[];
};

export type Seg = { text: string; t: number; start: number; end: number; dur: number };
export type Line = { text: string; segs: Seg[]; indent: number; t0: number; colors: string[] };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function parse(cfg: Config) {
  const off = cfg.offset || 0;
  const lines: Line[] = cfg.lines.map((l) => {
    const parts = l.text.split('|');
    const text = parts.join('');
    const indent = text.length - text.trimStart().length;
    let idx = 0;
    const last = l.times.length ? l.times[l.times.length - 1] : 0;
    const segs = parts.map((p, i) => {
      const s: Seg = { text: p, t: (l.times[i] ?? last) + off, start: idx, end: idx + p.length, dur: 0.1 };
      idx += p.length;
      return s;
    });
    return { text, segs, indent, t0: segs[0]?.t ?? 0, colors: colorize(text) };
  });
  // typing duration per segment: spread letters over the sung length, but never sluggish
  const flat = lines.flatMap((l) => l.segs.map((s) => ({ s, l })));
  flat.forEach(({ s, l }, i) => {
    const next = flat[i + 1];
    const gap = next ? Math.max(0.05, next.s.t - s.t) : 0.8;
    const chars = s.end - Math.max(s.start, l.indent);
    s.dur = clamp(Math.min(gap * 0.85, chars * 0.075), 0.04, 1.2);
  });
  const fx = cfg.fx.map((f) => ({ ...f, t: f.t + off })).sort((a, b) => a.t - b.t);
  return { lines, fx };
}

export type Parsed = ReturnType<typeof parse>;

export function typedChars(line: Line, tv: number) {
  if (tv < line.t0) return 0;
  let count = line.indent;
  for (const s of line.segs) {
    if (tv < s.t) break;
    const from = Math.max(s.start, line.indent);
    const len = s.end - from;
    if (len <= 0) continue;
    const p = clamp((tv - s.t) / s.dur, 0, 1);
    count = Math.max(count, from + Math.ceil(len * p));
  }
  return count;
}

export function currentLine(lines: Line[], tv: number) {
  let cur = 0;
  for (let i = 0; i < lines.length; i++) if (lines[i].t0 <= tv) cur = i;
  return cur;
}

// time the most recent character appeared (for cursor blink)
export function lastTypeTime(lines: Line[], tv: number) {
  let last = -10;
  for (const l of lines)
    for (const s of l.segs) if (s.t <= tv) last = Math.max(last, Math.min(tv, s.t + s.dur));
  return last;
}

export function cursorWorld(lines: Line[], tv: number) {
  const li = currentLine(lines, tv);
  const col = typedChars(lines[li], tv);
  return {
    li,
    col,
    x: L.codeX + col * L.charW,
    y: L.codeTop + li * L.lineH + L.lineH / 2,
  };
}

// ---------- Git / terminal ----------
export type TermSpan = { text: string; color: string };
export type TermLine = {
  t: number; // when it appears
  prompt?: boolean;
  cmd?: string;
  typeStart?: number;
  typeDur?: number;
  spans?: TermSpan[];
};

const hashOf = (n: number) => {
  let x = (n + 7) * 2654435761;
  let s = '';
  for (let i = 0; i < 7; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    s += '0123456789abcdef'[(x >>> 16) & 15];
  }
  return s;
};

export type GitEvent = { t: number; kind: string; end: number; camera: boolean; hash?: string; msg?: string };

export function buildTerminal(p: Parsed, cfg: Config) {
  const term: TermLine[] = [];
  const events: GitEvent[] = [];
  const P = (t: number) => term.push({ t, prompt: true, cmd: '', typeStart: Infinity, typeDur: 0 });
  const out = (t: number, spans: TermSpan[]) => term.push({ t, spans });
  const W_ = '#cccccc';
  // pre-existing history
  term.push({ t: -1, prompt: true, cmd: 'git status', typeStart: -1, typeDur: 0 });
  out(-1, [{ text: `On branch ${cfg.branch}`, color: W_ }]);
  out(-1, [{ text: 'nothing to commit, working tree clean', color: W_ }]);
  P(-1);

  const run = (t: number, cmd: string, outputs: TermSpan[][]) => {
    const pl = term[term.length - 1];
    pl.cmd = cmd;
    pl.typeStart = t;
    pl.typeDur = Math.min(0.55, cmd.length * 0.016);
    let tt = t + pl.typeDur + 0.12;
    for (const o of outputs) {
      out(tt, o);
      tt += 0.07;
    }
    P(tt + 0.05);
    return tt + 0.05;
  };

  let commitN = 0;
  let lastCommitLine = -1;
  const commits: { hash: string; msg: string }[] = [];
  const lineAt = (t: number) => currentLine(p.lines, t);
  const msgFor = (li: number) => {
    const t = p.lines[li].text.trim();
    const str = t.match(/["'`]([^"'`]{3,})["'`]/);
    return (str ? str[1] : t.replace(/^\/\/\s*/, '')).replace(/"/g, "'").slice(0, 46);
  };

  for (const f of p.fx) {
    if (f.type === 'commit') {
      const li = lineAt(f.t);
      const msg = (f.msg ?? msgFor(li)).replace(/"/g, "'");
      const hash = hashOf(++commitN);
      const changed = Math.max(1, li - lastCommitLine);
      lastCommitLine = li;
      commits.push({ hash, msg });
      const end = run(f.t, `git commit -am "${msg}"`, [
        [
          { text: `[${cfg.branch} `, color: W_ },
          { text: hash, color: '#e5c07b' },
          { text: `] ${msg}`, color: W_ },
        ],
        [
          { text: ` 1 file changed, `, color: W_ },
          { text: `${changed} insertions(+)`, color: '#73c991' },
        ],
      ]);
      events.push({ t: f.t, kind: 'commit', end: end + 0.45, camera: true, hash, msg });
    } else if (f.type === 'conflict') {
      const end = run(f.t, 'git pull', [
        [{ text: `Auto-merging ${cfg.fileName}`, color: W_ }],
        [{ text: `CONFLICT (content): Merge conflict in ${cfg.fileName}`, color: '#f14c4c' }],
      ]);
      events.push({ t: f.t, kind: 'conflict', end: f.t + (f.dur ?? 1.4), camera: false });
      void end;
    } else if (f.type === 'popup') {
      const d = f.dur ?? 2.2;
      const h1 = hashOf(++commitN);
      const h0 = commits.length ? commits[commits.length - 1].hash : hashOf(99);
      run(f.t + d * 0.7, `git push --force origin ${cfg.branch}`, [
        [
          { text: ` + ${h0}...${h1} `, color: '#e5c07b' },
          { text: `${cfg.branch} -> ${cfg.branch} (forced update)`, color: W_ },
        ],
      ]);
      events.push({ t: f.t, kind: 'popup', end: f.t + d, camera: false });
    } else if (f.type === 'image' && f.src) {
      run(f.t, `open ${f.src}`, []);
    } else if (f.type === 'ending') {
      // git log of every lyric line, newest first
      const all = p.lines
        .map((l, i) => ({ msg: l.text.trim().replace(/^\/\/\s*/, '').replace(/"/g, "'").slice(0, 52), i }))
        .filter((x) => x.msg.length > 0)
        .reverse();
      const outputs = all.map((x, k) => [
        { text: hashOf(200 + x.i), color: '#e5c07b' },
        ...(k === 0 ? [{ text: ` (HEAD -> ${cfg.branch})`, color: '#4fc1ff' }] : []),
        { text: ` ${x.msg}`, color: W_ },
      ]);
      run(f.t + 0.6, 'git log --oneline', outputs);
      events.push({ t: f.t, kind: 'ending', end: 1e9, camera: true });
    }
  }
  return { term, events };
}

// Which terminal rows are visible at time tv (auto-scroll)
export function visibleTerm(term: TermLine[], tv: number) {
  const vis = term.filter((l) => l.t <= tv);
  return vis.slice(Math.max(0, vis.length - L.termRows));
}

export function changedLinesSinceCommit(p: Parsed, events: GitEvent[], tv: number) {
  let base = -1;
  for (const e of events) if (e.kind === 'commit' && e.t + 0.8 <= tv) base = currentLine(p.lines, e.t);
  const cur = currentLine(p.lines, tv);
  const set: number[] = [];
  for (let i = base + 1; i <= cur; i++) if (typedChars(p.lines[i], tv) > 0) set.push(i);
  return set;
}

// ---------- Camera ----------
export type Cam = { x: number; y: number; z: number; ax: number; ay: number; vx: number; vy: number };

export function simulateCamera(
  p: Parsed,
  term: TermLine[],
  events: GitEvent[],
  frames: number,
  lead: number,
) {
  const target = (tv: number) => {
    const ending = events.find((e) => e.kind === 'ending' && tv >= e.t);
    if (ending) return { x: W / 2, y: H / 2 + 20, z: 0.86, ax: 0.5, ay: 0.5 };
    const visit = events.find((e) => e.camera && tv >= e.t && tv < e.end);
    if (visit) {
      const vis = visibleTerm(term, tv);
      const row = Math.max(0, vis.length - 2);
      return {
        x: L.termX + 22 * L.termCharW,
        y: L.termTop + row * L.termLineH,
        z: 2.0,
        ax: 0.5,
        ay: 0.52,
      };
    }
    const c = cursorWorld(p.lines, tv + 0.08);
    const sinceLine = tv - p.lines[c.li].t0;
    const dip = sinceLine >= 0 && sinceLine < 0.22 && c.li > 0 ? 0.8 : 1;
    return { x: c.x, y: c.y, z: 3.0 * dip, ax: 0.6, ay: 0.46 };
  };

  const st = { ...target(lead), vx: 0, vy: 0, vz: 0, vax: 0, vay: 0 };
  const out: Cam[] = [];
  const sub = 6;
  const dt = 1 / FPS / sub;
  const spring = (x: number, v: number, tgt: number, w: number, z: number) => {
    const a = w * w * (tgt - x) - 2 * z * w * v;
    v += a * dt;
    x += v * dt;
    return [x, v];
  };
  for (let f = 0; f < frames; f++) {
    for (let s = 0; s < sub; s++) {
      const tv = (f + s / sub) / FPS + lead;
      const T = target(tv);
      const endMode = T.z < 1.5;
      [st.x, st.vx] = spring(st.x, st.vx, T.x, endMode ? 4 : 10, 0.85);
      [st.y, st.vy] = spring(st.y, st.vy, T.y, endMode ? 4 : 13, 0.9);
      [st.z, st.vz] = spring(st.z, st.vz, T.z, endMode ? 3 : 8, 0.95);
      [st.ax, st.vax] = spring(st.ax, st.vax, T.ax, 5, 1);
      [st.ay, st.vay] = spring(st.ay, st.vay, T.ay, 5, 1);
    }
    out.push({ x: st.x, y: st.y, z: st.z, ax: st.ax, ay: st.ay, vx: st.vx, vy: st.vy });
  }
  return out;
}
