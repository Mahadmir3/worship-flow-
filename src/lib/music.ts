/** Chord chart engine: key detection, transposition and chart rendering. */

const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

export const KEYS = SHARPS;

function noteIndex(token: string): number {
  const m = token.match(/^([A-G])(#|b)?/);
  if (!m) return -1;
  const base = SHARPS.indexOf(m[1]);
  if (base < 0) return -1;
  if (m[2] === "#") return (base + 1) % 12;
  if (m[2] === "b") return (base + 11) % 12;
  return base;
}

const CHORD_RE = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/;

function transposeChordToken(token: string, steps: number): string {
  const m = token.match(CHORD_RE);
  if (!m) return token;
  const root = noteIndex(m[1]);
  if (root < 0) return token;
  const newRoot = (((root + steps) % 12) + 12) % 12;
  let bass = "";
  if (m[3]) {
    const bi = noteIndex(m[3]);
    if (bi >= 0) bass = "/" + SHARPS[(((bi + steps) % 12) + 12) % 12];
  }
  return SHARPS[newRoot] + (m[2] || "") + bass;
}

function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  const chordish = tokens.filter((t) => CHORD_RE.test(t)).length;
  return chordish / tokens.length >= 0.6;
}

/** Transpose a full chart. Chord lines are detected heuristically. */
export function transposeChart(chart: string, steps: number): string {
  if (!steps) return chart;
  return chart
    .split("\n")
    .map((line) => {
      if (!isChordLine(line)) return line;
      return line
        .split(/(\s+)/)
        .map((tok) => (/^\s+$/.test(tok) ? tok : transposeChordToken(tok, steps)))
        .join("");
    })
    .join("\n");
}

export function semitonesBetween(from: string, to: string): number {
  const a = noteIndex(from);
  const b = noteIndex(to);
  if (a < 0 || b < 0) return 0;
  return (((b - a) % 12) + 12) % 12;
}

/** Nice display for a key, e.g. "F#" → "F♯ (Gb)" style stays simple: sharps only. */
export function prettyKey(key?: string | null): string {
  if (!key) return "—";
  return key.replace("#", "♯").replace("b", "♭");
}
