import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const COLORS: Record<string, number> = {
  default: 39, red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36, white: 97, gray: 90,
};

const LIMITS = { lines: [1, 200], width: [20, 300], spacing: [0, 3], margin: [0, 40] } as const;
export type NumKey = keyof typeof LIMITS;
export const OPTION_KEYS = [...Object.keys(LIMITS), 'color'];

export interface Config {
  lines: number;
  width: number;
  spacing: number;
  margin: number;
  color: string;
  /** absolute book path -> paragraph index where reading stopped */
  books: Record<string, number>;
}

export const DEFAULTS: Config = { lines: 20, width: 80, spacing: 0, margin: 2, color: 'default', books: {} };

/** Validates and applies one option. Throws with a user-facing message on bad input. */
export function setOption(cfg: Config, key: string, value: string): void {
  if (key === 'color') {
    if (!Object.hasOwn(COLORS, value)) {
      throw new Error(`cor inválida: "${value}". Opções: ${Object.keys(COLORS).join(', ')}`);
    }
    cfg.color = value;
    return;
  }
  if (!Object.hasOwn(LIMITS, key)) throw new Error(`opção desconhecida: "${key}"`);
  const [min, max] = LIMITS[key as NumKey];
  const n = Number(value);
  if (!/^\d+$/.test(value) || n < min || n > max) {
    throw new Error(`${key} deve ser um inteiro entre ${min} e ${max}`);
  }
  cfg[key as NumKey] = n;
}

const configPath = () => process.env.DEVOOK_CONFIG ?? join(homedir(), '.devook.json');

export function loadConfig(): Config {
  const cfg = structuredClone(DEFAULTS);
  try {
    const raw = JSON.parse(readFileSync(configPath(), 'utf8'));
    for (const key of OPTION_KEYS) {
      try { setOption(cfg, key, String(raw[key])); } catch { /* hand-edited garbage: keep default */ }
    }
    if (raw.books && typeof raw.books === 'object') cfg.books = raw.books;
  } catch { /* missing or corrupt file: defaults */ }
  return cfg;
}

export function saveConfig(cfg: Config): void {
  writeFileSync(configPath(), JSON.stringify(cfg, null, 2));
}

/**
 * Rebuilds paragraphs from extracted text, undoing the hard line breaks PDFs carry.
 * ponytail: naive heuristic — a blank line, a line clearly shorter than a full
 * line, or a slightly short line ending in sentence punctuation ends a paragraph;
 * a trailing hyphen is treated as a word split. Wrong for verse, for real hyphens
 * at line end, and it merges paragraphs whose last line is full-length.
 * Upgrade path: use PDF text-item positions (indent, vertical gap).
 */
export function toParagraphs(text: string): string[] {
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trim());
  const lengths = lines.filter(Boolean).map((l) => l.length).sort((a, b) => a - b);
  const full = lengths[Math.floor(lengths.length * 0.9)] ?? 0;
  const paras: string[] = [];
  let cur = '';
  for (const line of lines) {
    if (line) {
      if (/\p{L}-$/u.test(cur)) cur = cur.slice(0, -1) + line;
      else cur = cur ? `${cur} ${line}` : line;
    }
    const short = line.length < full * 0.8 || (line.length < full * 0.93 && /[.!?…:"”»)]$/.test(line));
    if (cur && (!line || short)) {
      paras.push(cur);
      cur = '';
    }
  }
  if (cur) paras.push(cur);
  return paras;
}

export interface Line {
  text: string;
  /** index of the paragraph this line belongs to */
  para: number;
}

/**
 * Word-wraps paragraphs to `width` columns, with a blank line after each paragraph.
 * ponytail: counts UTF-16 units, not display cells — CJK and emoji come out wide.
 * Upgrade path: a string-width function.
 */
export function wrap(paras: string[], width: number): Line[] {
  const out: Line[] = [];
  paras.forEach((p, para) => {
    let cur = '';
    for (let word of p.split(/\s+/)) {
      while (word.length > width) {
        if (cur) out.push({ text: cur, para });
        out.push({ text: word.slice(0, width), para });
        word = word.slice(width);
        cur = '';
      }
      if (!cur) cur = word;
      else if (cur.length + 1 + word.length <= width) cur += ` ${word}`;
      else {
        out.push({ text: cur, para });
        cur = word;
      }
    }
    if (cur) out.push({ text: cur, para });
    out.push({ text: '', para });
  });
  return out;
}
