// Tiny JS-flavoured syntax highlighter -> one colour per character.
// Colours follow a VS Code "Dark+"-style palette.

export const C = {
  ctrl: '#c586c0', // if / else / while / import / export ...
  store: '#569cd6', // const / let / new / function ...
  fn: '#dcdcaa', // functionCall(
  variable: '#9cdcfe',
  str: '#ce9178',
  num: '#b5cea8',
  comment: '#6a9955',
  type: '#4ec9b0', // Capitalised names
  punc: '#d4d4d4',
};

const BRACKETS = ['#ffd700', '#da70d6', '#179fff'];

const KW_CTRL = new Set([
  'if', 'else', 'while', 'for', 'return', 'import', 'export', 'from', 'default', 'do',
  'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'await', 'yield',
]);
const KW_STORE = new Set([
  'const', 'let', 'var', 'new', 'function', 'class', 'this', 'true', 'false', 'null',
  'undefined', 'async', 'typeof', 'of', 'in', 'void', 'delete',
]);

export function colorize(line: string): string[] {
  const out: string[] = new Array(line.length).fill(C.punc);
  let i = 0;
  let depth = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '/' && line[i + 1] === '/') {
      for (let k = i; k < line.length; k++) out[k] = C.comment;
      break;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < line.length && line[j] !== ch) {
        if (line[j] === '\\') j++;
        j++;
      }
      for (let k = i; k <= Math.min(j, line.length - 1); k++) out[k] = C.str;
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < line.length && /[0-9._]/.test(line[j])) j++;
      for (let k = i; k < j; k++) out[k] = C.num;
      i = j;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < line.length && /[A-Za-z0-9_$]/.test(line[j])) j++;
      const w = line.slice(i, j);
      let k = j;
      while (line[k] === ' ') k++;
      let col: string;
      if (KW_CTRL.has(w)) col = C.ctrl;
      else if (KW_STORE.has(w)) col = C.store;
      else if (/^[A-Z]/.test(w)) col = C.type;
      else if (line[k] === '(') col = C.fn;
      else col = C.variable;
      for (let m = i; m < j; m++) out[m] = col;
      i = j;
      continue;
    }
    if ('([{'.includes(ch)) {
      out[i] = BRACKETS[depth % 3];
      depth++;
      i++;
      continue;
    }
    if (')]}'.includes(ch)) {
      depth = Math.max(0, depth - 1);
      out[i] = BRACKETS[depth % 3];
      i++;
      continue;
    }
    i++;
  }
  return out;
}

// Group consecutive same-colour characters into runs for rendering.
export function runs(text: string, colors: string[], upTo: number) {
  const res: { text: string; color: string }[] = [];
  for (let i = 0; i < Math.min(upTo, text.length); i++) {
    const last = res[res.length - 1];
    if (last && last.color === colors[i]) last.text += text[i];
    else res.push({ text: text[i], color: colors[i] });
  }
  return res;
}
