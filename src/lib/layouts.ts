/**
 * Keyboard layout data.
 *
 * Everything is keyed by `KeyboardEvent.code` — the *physical* key position,
 * which is independent of the OS keyboard layout. This is what makes one table
 * serve both ANSI and JIS: the key labelled `@` on a JIS board and the key
 * labelled `[` on an ANSI board are both `BracketLeft`, and both carry ゛.
 *
 * The only real difference between the two boards is key *count*: JIS has two
 * extra keys, `IntlYen` (ー) and `IntlRo` (ろ), which ANSI physically lacks.
 */

export type KeyCode = string;

/** JIS kana assignment: base = unshifted, shift = shifted layer. */
export const KANA_LAYOUT: Record<KeyCode, { base: string; shift?: string }> = {
  // number row
  Digit1: { base: 'ぬ' },
  Digit2: { base: 'ふ' },
  Digit3: { base: 'あ', shift: 'ぁ' },
  Digit4: { base: 'う', shift: 'ぅ' },
  Digit5: { base: 'え', shift: 'ぇ' },
  Digit6: { base: 'お', shift: 'ぉ' },
  Digit7: { base: 'や', shift: 'ゃ' },
  Digit8: { base: 'ゆ', shift: 'ゅ' },
  Digit9: { base: 'よ', shift: 'ょ' },
  Digit0: { base: 'わ', shift: 'を' },
  Minus: { base: 'ほ' },
  Equal: { base: 'へ' },
  IntlYen: { base: 'ー' },
  // upper row
  KeyQ: { base: 'た' },
  KeyW: { base: 'て' },
  KeyE: { base: 'い', shift: 'ぃ' },
  KeyR: { base: 'す' },
  KeyT: { base: 'か' },
  KeyY: { base: 'ん' },
  KeyU: { base: 'な' },
  KeyI: { base: 'に' },
  KeyO: { base: 'ら' },
  KeyP: { base: 'せ' },
  BracketLeft: { base: '゛' },
  BracketRight: { base: '゜' },
  // home row
  KeyA: { base: 'ち' },
  KeyS: { base: 'と' },
  KeyD: { base: 'し' },
  KeyF: { base: 'は' },
  KeyG: { base: 'き' },
  KeyH: { base: 'く' },
  KeyJ: { base: 'ま' },
  KeyK: { base: 'の' },
  KeyL: { base: 'り' },
  Semicolon: { base: 'れ' },
  Quote: { base: 'け' },
  Backslash: { base: 'む' },
  // bottom row
  KeyZ: { base: 'つ', shift: 'っ' },
  KeyX: { base: 'さ' },
  KeyC: { base: 'そ' },
  KeyV: { base: 'ひ' },
  KeyB: { base: 'こ' },
  KeyN: { base: 'み' },
  KeyM: { base: 'も' },
  Comma: { base: 'ね', shift: '、' },
  Period: { base: 'る', shift: '。' },
  Slash: { base: 'め', shift: '・' },
  IntlRo: { base: 'ろ' },
};

/** Keys that exist on a JIS 106 board but not on an ANSI 104 board. */
export const JIS_ONLY: KeyCode[] = ['IntlYen', 'IntlRo'];

/**
 * ANSI has no `IntlRo`, so ろ is unreachable. We accept Backslash as a stand-in.
 * This is safe because the drill always knows which single kana it is asking
 * for, so the overlap with む (also Backslash) can never be ambiguous.
 */
export const ANSI_FALLBACK: Record<string, KeyCode> = { ろ: 'Backslash', ー: 'Equal' };

/** Latin legends per board, for rendering the on-screen keyboard. */
const ANSI_LEGEND: Record<KeyCode, [string, string]> = {
  Digit1: ['1', '!'], Digit2: ['2', '@'], Digit3: ['3', '#'], Digit4: ['4', '$'],
  Digit5: ['5', '%'], Digit6: ['6', '^'], Digit7: ['7', '&'], Digit8: ['8', '*'],
  Digit9: ['9', '('], Digit0: ['0', ')'], Minus: ['-', '_'], Equal: ['=', '+'],
  BracketLeft: ['[', '{'], BracketRight: [']', '}'], Backslash: ['\\', '|'],
  Semicolon: [';', ':'], Quote: ["'", '"'], Comma: [',', '<'], Period: ['.', '>'],
  Slash: ['/', '?'],
};

const JIS_LEGEND: Record<KeyCode, [string, string]> = {
  Digit1: ['1', '!'], Digit2: ['2', '"'], Digit3: ['3', '#'], Digit4: ['4', '$'],
  Digit5: ['5', '%'], Digit6: ['6', '&'], Digit7: ['7', "'"], Digit8: ['8', '('],
  Digit9: ['9', ')'], Digit0: ['0', ''], Minus: ['-', '='], Equal: ['^', '~'],
  IntlYen: ['¥', '|'], BracketLeft: ['@', '`'], BracketRight: ['[', '{'],
  Backslash: [']', '}'], Semicolon: [';', '+'], Quote: [':', '*'],
  Comma: [',', '<'], Period: ['.', '>'], Slash: ['/', '?'], IntlRo: ['\\', '_'],
};

export type Board = 'ansi' | 'jis';

export const legendFor = (board: Board, code: KeyCode): [string, string] => {
  const table = board === 'jis' ? JIS_LEGEND : ANSI_LEGEND;
  if (table[code]) return table[code];
  if (code.startsWith('Key')) return [code.slice(3), code.slice(3)];
  if (code.startsWith('Digit')) return [code.slice(5), code.slice(5)];
  return [code, code];
};

/**
 * Physical rows, in render order.
 *
 * The two boards differ in where `Backslash` physically sits: on JIS it is at the
 * end of the home row (right of `'`), on ANSI it is at the end of the QWERTY row
 * (right of `]`, above Enter). The JIS-only keys `IntlYen` / `IntlRo` are still
 * rendered on ANSI, greyed out, so the missing positions are visible.
 */
const JIS_ROWS: KeyCode[][] = [
  ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'IntlYen'],
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight'],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote', 'Backslash'],
  ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash', 'IntlRo'],
];

const ANSI_ROWS: KeyCode[][] = [
  ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'IntlYen'],
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash'],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'],
  ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash', 'IntlRo'],
];

export const rowsFor = (board: Board): KeyCode[][] => (board === 'jis' ? JIS_ROWS : ANSI_ROWS);

/** QWERTY rows for romaji mode. */
export const ROMAJI_ROWS: KeyCode[][] = [
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP'],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL'],
  ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM'],
];

export const letterToCode = (ch: string): KeyCode | null => {
  const c = ch.toLowerCase();
  if (c >= 'a' && c <= 'z') return `Key${c.toUpperCase()}`;
  if (c === "'") return 'Quote';
  if (c === '-') return 'Minus';
  return null;
};
