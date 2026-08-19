/**
 * Corpus loading, keystroke derivation, and answer matching.
 */

import corpusText from '../data/kana-corpus.tsv?raw';
import { ANSI_FALLBACK, KANA_LAYOUT, type Board, type KeyCode } from './layouts';

export type Category = 'gojuon' | 'dakuten' | 'handakuten' | 'small' | 'yoon';
export const CATEGORIES: { id: Category; label: string; sub: string }[] = [
  { id: 'gojuon', label: 'Gojūon', sub: 'あ–ん' },
  { id: 'dakuten', label: 'Dakuten', sub: 'が ざ だ ば' },
  { id: 'handakuten', label: 'Handakuten', sub: 'ぱ ぴ ぷ' },
  { id: 'small', label: 'Small kana', sub: 'ぁ っ ゃ' },
  { id: 'yoon', label: 'Yōon', sub: 'きゃ しゅ' },
];

export interface KanaEntry {
  id: string;
  category: Category;
  row: string;
  hiragana: string;
  katakana: string;
  romaji: string[];
}

export const CORPUS: KanaEntry[] = corpusText
  .split('\n')
  .filter((l) => l.trim() && !l.startsWith('#') && !l.startsWith('id\t'))
  .map((l) => {
    const [id, category, row, hiragana, katakana, romaji] = l.split('\t');
    return { id, category: category as Category, row, hiragana, katakana, romaji: romaji.split('|') };
  });

/* ------------------------------------------------------------------ *
 * Kana keystrokes
 * ------------------------------------------------------------------ */

export interface Keystroke {
  code: KeyCode;
  shift: boolean;
  /** kana or diacritic mark produced by this key */
  glyph: string;
  /** true when the key does not physically exist on the selected board */
  fallback?: boolean;
}

const REVERSE: Record<string, { code: KeyCode; shift: boolean }> = {};
for (const [code, { base, shift }] of Object.entries(KANA_LAYOUT)) {
  REVERSE[base] ??= { code, shift: false };
  if (shift) REVERSE[shift] ??= { code, shift: true };
}

const COMBINING: Record<string, KeyCode> = {
  '゙': 'BracketLeft', // dakuten ゛
  '゚': 'BracketRight', // handakuten ゜
};
const MARK_GLYPH: Record<string, string> = { '゙': '゛', '゚': '゜' };

/**
 * Keystrokes needed to type a kana sequence in kana-input mode.
 *
 * Dakuten/handakuten forms are decomposed with Unicode NFD (が → か + U+3099),
 * so composed characters need no special-casing. Returns null when some part of
 * the sequence has no kana key at all (e.g. ゎ, absent from the JIS layout).
 *
 * Keystrokes are derived from the *hiragana* form even when the answer is
 * katakana: kana keys are script-independent, the IME mode decides the output.
 */
export function kanaKeystrokes(hiragana: string, board: Board): Keystroke[] | null {
  const out: Keystroke[] = [];
  for (const ch of hiragana.normalize('NFD')) {
    if (COMBINING[ch]) {
      out.push({ code: COMBINING[ch], shift: false, glyph: MARK_GLYPH[ch] });
      continue;
    }
    const hit = REVERSE[ch];
    if (!hit) return null;
    const missing = board === 'ansi' && (hit.code === 'IntlRo' || hit.code === 'IntlYen');
    if (missing) {
      const alt = ANSI_FALLBACK[ch];
      if (!alt) return null;
      out.push({ code: alt, shift: false, glyph: ch, fallback: true });
    } else {
      out.push({ code: hit.code, shift: hit.shift, glyph: ch });
    }
  }
  return out;
}

/** Entries that cannot be produced on a kana keyboard at all. */
export const isKanaTypable = (e: KanaEntry, board: Board) => kanaKeystrokes(e.hiragana, board) !== null;

/* ------------------------------------------------------------------ *
 * Romaji matching
 * ------------------------------------------------------------------ */

export interface RomajiState {
  /** accepted spellings still consistent with what has been typed */
  live: string[];
  /** distinct next letters across live candidates */
  nextChars: string[];
  /** the letter to highlight (canonical spelling wins when still live) */
  hintChar: string | null;
  complete: boolean;
  invalid: boolean;
}

export function romajiState(accepted: string[], typed: string): RomajiState {
  const t = typed.toLowerCase();
  const live = accepted.filter((r) => r.startsWith(t));
  const complete = live.some((r) => r === t);
  const nextChars = [...new Set(live.filter((r) => r.length > t.length).map((r) => r[t.length]))];
  const preferred = live.find((r) => r === accepted[0]) ?? live[0];
  const hintChar = preferred && preferred.length > t.length ? preferred[t.length] : null;
  return { live, nextChars, hintChar, complete, invalid: live.length === 0 };
}

/* ------------------------------------------------------------------ *
 * Question generation
 * ------------------------------------------------------------------ */

export type Direction = 'h2k' | 'k2h' | 'random';
export type InputMode = 'ansi' | 'jis' | 'romaji';

export interface Question {
  entry: KanaEntry;
  /** what is shown */
  prompt: string;
  /** script the answer must be given in */
  answerScript: 'hiragana' | 'katakana';
  answer: string;
}

export function pickQuestion(pool: KanaEntry[], direction: Direction, avoid?: string): Question | null {
  if (!pool.length) return null;
  const candidates = pool.length > 1 && avoid ? pool.filter((e) => e.id !== avoid) : pool;
  const entry = candidates[Math.floor(Math.random() * candidates.length)];
  const h2k = direction === 'random' ? Math.random() < 0.5 : direction === 'h2k';
  return h2k
    ? { entry, prompt: entry.hiragana, answerScript: 'katakana', answer: entry.katakana }
    : { entry, prompt: entry.katakana, answerScript: 'hiragana', answer: entry.hiragana };
}

export function buildPool(cats: Set<Category>, mode: InputMode): KanaEntry[] {
  const board: Board = mode === 'jis' ? 'jis' : 'ansi';
  return CORPUS.filter(
    (e) => cats.has(e.category) && (mode === 'romaji' || isKanaTypable(e, board)),
  );
}
