import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Keyboard from './Keyboard';
import {
  CATEGORIES,
  buildPool,
  kanaKeystrokes,
  pickQuestion,
  romajiState,
  type Category,
  type Direction,
  type InputMode,
  type Question,
} from './lib/kana';
import { KANA_LAYOUT, legendFor, letterToCode, type Board, type KeyCode } from './lib/layouts';

/* ---------------- settings <-> URL hash (the only "storage" this app has) --- */

interface Settings {
  direction: Direction;
  input: InputMode;
  keyboard: boolean;
  hint: boolean;
  cats: Category[];
}

const DEFAULTS: Settings = {
  direction: 'h2k',
  input: 'ansi',
  keyboard: true,
  hint: false,
  cats: ['gojuon'],
};

const ALL_CATS = CATEGORIES.map((c) => c.id);

function readHash(): Settings {
  const p = new URLSearchParams(location.hash.replace(/^#/, ''));
  const dir = p.get('d');
  const inp = p.get('i');
  const cats = (p.get('c') ?? '').split('.').filter((c) => ALL_CATS.includes(c as Category));
  return {
    direction: dir === 'k2h' || dir === 'random' || dir === 'h2k' ? dir : DEFAULTS.direction,
    input: inp === 'jis' || inp === 'romaji' || inp === 'ansi' ? inp : DEFAULTS.input,
    keyboard: p.has('kb') ? p.get('kb') === '1' : DEFAULTS.keyboard,
    hint: p.has('h') ? p.get('h') === '1' : DEFAULTS.hint,
    cats: cats.length ? (cats as Category[]) : DEFAULTS.cats,
  };
}

function writeHash(s: Settings) {
  const p = new URLSearchParams({
    d: s.direction,
    i: s.input,
    kb: s.keyboard ? '1' : '0',
    h: s.hint ? '1' : '0',
    c: s.cats.join('.'),
  });
  history.replaceState(null, '', `#${p}`);
}

/* ---------------- helpers ---------------- */

const H_START = 0x3041;
const H_END = 0x3096;
/** hiragana -> katakana for a single char; anything else passes through */
const toKata = (ch: string) => {
  const cp = ch.codePointAt(0)!;
  return cp >= H_START && cp <= H_END ? String.fromCodePoint(cp + 0x60) : ch;
};
const asScript = (ch: string, script: 'hiragana' | 'katakana') =>
  script === 'katakana' ? toKata(ch) : ch;

const DIR_LABEL: Record<Direction, string> = {
  h2k: 'hiragana → katakana',
  k2h: 'katakana → hiragana',
  random: 'random direction',
};

/* ---------------- app ---------------- */

export default function App() {
  const [set, setSet] = useState<Settings>(readHash);
  useEffect(() => writeHash(set), [set]);

  const board: Board = set.input === 'jis' ? 'jis' : 'ansi';
  const isRomaji = set.input === 'romaji';

  const pool = useMemo(
    () => buildPool(new Set(set.cats), set.input),
    [set.cats, set.input],
  );

  const [q, setQ] = useState<Question | null>(null);
  const [step, setStep] = useState(0); // kana mode: keystrokes done
  const [typed, setTyped] = useState(''); // romaji mode
  const [solved, setSolved] = useState(false);
  const [err, setErr] = useState(false);
  const [pressed, setPressed] = useState<KeyCode | null>(null);
  const [shiftSticky, setShiftSticky] = useState(false);
  const [stats, setStats] = useState({ correct: 0, miss: 0, streak: 0, best: 0 });

  const advanceTimer = useRef<number | null>(null);

  const next = useCallback(
    (avoid?: string) => {
      setStep(0);
      setTyped('');
      setSolved(false);
      setShiftSticky(false);
      setQ(pickQuestion(pool, set.direction, avoid));
    },
    [pool, set.direction],
  );

  // (re)start whenever the pool or direction changes
  useEffect(() => {
    next();
    return () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    };
  }, [next]);

  const keystrokes = useMemo(
    () => (q && !isRomaji ? kanaKeystrokes(q.entry.hiragana, board) : null),
    [q, isRomaji, board],
  );

  const rState = useMemo(
    () => (q && isRomaji ? romajiState(q.entry.romaji, typed) : null),
    [q, isRomaji, typed],
  );

  /* -------- what the hint should point at -------- */
  const hint = useMemo((): { code: KeyCode | null; shift: boolean } => {
    if (!set.hint || solved) return { code: null, shift: false };
    if (isRomaji) {
      const ch = rState?.hintChar;
      return { code: ch ? letterToCode(ch) : null, shift: false };
    }
    const k = keystrokes?.[step];
    return k ? { code: k.code, shift: k.shift } : { code: null, shift: false };
  }, [set.hint, solved, isRomaji, rState, keystrokes, step]);

  const flashErr = useCallback(() => {
    setErr(true);
    window.setTimeout(() => setErr(false), 230);
    setStats((s) => ({ ...s, miss: s.miss + 1, streak: 0 }));
  }, []);

  const succeed = useCallback(() => {
    setSolved(true);
    setStats((s) => {
      const streak = s.streak + 1;
      return { ...s, correct: s.correct + 1, streak, best: Math.max(s.best, streak) };
    });
    const id = q?.entry.id;
    advanceTimer.current = window.setTimeout(() => next(id), 420);
  }, [next, q]);

  /* -------- input handling -------- */

  const pressKana = useCallback(
    (code: KeyCode, shift: boolean) => {
      if (!keystrokes || solved) return;
      const want = keystrokes[step];
      if (!want) return;
      if (want.code === code && want.shift === shift) {
        setShiftSticky(false);
        if (step + 1 >= keystrokes.length) succeed();
        else setStep(step + 1);
      } else {
        flashErr();
        setStep(0);
        setShiftSticky(false);
      }
    },
    [keystrokes, step, solved, succeed, flashErr],
  );

  const pressLetter = useCallback(
    (ch: string) => {
      if (!q || solved) return;
      const attempt = typed + ch.toLowerCase();
      const st = romajiState(q.entry.romaji, attempt);
      if (st.invalid) {
        flashErr();
        setTyped('');
        return;
      }
      setTyped(attempt);
      if (st.complete) succeed();
    },
    [q, typed, solved, succeed, flashErr],
  );

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        next(q?.entry.id);
        return;
      }
      if (isRomaji) {
        if (e.key === 'Backspace') {
          e.preventDefault();
          setTyped((t) => t.slice(0, -1));
          return;
        }
        if (/^[a-zA-Z'-]$/.test(e.key)) {
          e.preventDefault();
          setPressed(letterToCode(e.key));
          pressLetter(e.key);
        }
        return;
      }
      if (e.key === 'Shift') return;
      // only consume keys that actually carry a kana
      if (e.code in KANA_LAYOUT) {
        e.preventDefault();
        setPressed(e.code);
        pressKana(e.code, e.shiftKey);
      }
    };
    const onUp = () => setPressed(null);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [isRomaji, pressKana, pressLetter, keystrokes, next, q]);

  /* -------- rendering helpers -------- */

  const toggleCat = (c: Category) =>
    setSet((s) => {
      const has = s.cats.includes(c);
      const cats = has ? s.cats.filter((x) => x !== c) : [...s.cats, c];
      return { ...s, cats: cats.length ? cats : s.cats };
    });

  const usesFallback = keystrokes?.some((k) => k.fallback);
  const accuracy =
    stats.correct + stats.miss === 0
      ? 100
      : Math.round((stats.correct / (stats.correct + stats.miss)) * 100);

  const hintLegend = hint.code ? legendFor(board, hint.code)[hint.shift ? 1 : 0] : null;

  return (
    <div className="app">
      <div className="shell">
        <header className="head">
          <div>
            <h1 className="title">
              hira<span>·</span>kata <span>practice</span>
            </h1>
            <p className="tagline">
              Kana drill with real JIS / US-ANSI key positions. Nothing is stored — your settings
              live in the URL.
            </p>
          </div>
          <div className="stats">
            <div className="stat good">
              <b>{stats.correct}</b>
              <span>correct</span>
            </div>
            <div className="stat bad">
              <b>{stats.miss}</b>
              <span>miss</span>
            </div>
            <div className="stat">
              <b>{stats.streak}</b>
              <span>streak</span>
            </div>
            <div className="stat">
              <b>{accuracy}%</b>
              <span>accuracy</span>
            </div>
          </div>
        </header>

        <div className="controls">
          <div className="group">
            <label>Direction</label>
            <div className="seg">
              {(['h2k', 'k2h', 'random'] as Direction[]).map((d) => (
                <button
                  key={d}
                  aria-pressed={set.direction === d}
                  onClick={() => setSet((s) => ({ ...s, direction: d }))}
                >
                  {d === 'h2k' ? 'あ → ア' : d === 'k2h' ? 'ア → あ' : 'Random'}
                </button>
              ))}
            </div>
          </div>

          <div className="group">
            <label>Input</label>
            <div className="seg">
              {(['ansi', 'jis', 'romaji'] as InputMode[]).map((m) => (
                <button
                  key={m}
                  aria-pressed={set.input === m}
                  onClick={() => setSet((s) => ({ ...s, input: m }))}
                >
                  {m === 'ansi' ? 'US ANSI kana' : m === 'jis' ? 'JIS kana' : 'Romaji'}
                </button>
              ))}
            </div>
          </div>

          <div className="group">
            <label>Assist</label>
            <div className="seg">
              <button
                aria-pressed={set.keyboard}
                onClick={() => setSet((s) => ({ ...s, keyboard: !s.keyboard }))}
              >
                Keyboard
              </button>
              <button
                aria-pressed={set.hint}
                onClick={() => setSet((s) => ({ ...s, hint: !s.hint }))}
              >
                Hint
              </button>
            </div>
          </div>

          <div className="group">
            <label>Character sets</label>
            <div className="chips">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  className="chip"
                  aria-pressed={set.cats.includes(c.id)}
                  onClick={() => toggleCat(c.id)}
                >
                  {c.label} <em>{c.sub}</em>
                </button>
              ))}
            </div>
          </div>
        </div>

        <main className={`stage${err ? ' err' : ''}`}>
          {!q ? (
            <p className="empty">No characters in this set. Pick at least one character set.</p>
          ) : (
            <>
              <div className="dir">
                {set.direction === 'random' ? (
                  <>
                    read <b>{q.answerScript === 'katakana' ? 'hiragana' : 'katakana'}</b> → answer in{' '}
                    <b>{q.answerScript}</b>
                  </>
                ) : (
                  DIR_LABEL[set.direction]
                )}
              </div>

              <div className="prompt">{q.prompt}</div>

              <div className="answerbox">
                {solved ? (
                  <div className="reveal">{q.answer}</div>
                ) : isRomaji ? (
                  <div className="typed">
                    {typed || <span className="ph">···</span>}
                    <span className="cursor" />
                  </div>
                ) : (
                  keystrokes?.map((k, i) => (
                    <div key={i} className={`slot${i < step ? ' done' : ''}`}>
                      {i < step ? asScript(k.glyph, q.answerScript) : '·'}
                    </div>
                  ))
                )}
              </div>

              <div className="hintbar">
                {set.hint && !solved && hint.code && (
                  <>
                    <span>next</span>
                    {hint.shift && <span className="kbd">⇧ Shift</span>}
                    <span className={`kbd${isRomaji ? '' : ' mark'}`}>{hintLegend}</span>
                    {!isRomaji && keystrokes?.[step] && (
                      <span className="kbd mark">{keystrokes[step].glyph}</span>
                    )}
                  </>
                )}
                {!set.hint && <span style={{ color: 'var(--faint)' }}>Esc skips</span>}
              </div>

              {usesFallback && (
                <div className="note">
                  ⚠ ろ sits on the JIS-only <code>IntlRo</code> key, which an ANSI board doesn't
                  have — <span className="kbd">\</span> is accepted instead.
                </div>
              )}
            </>
          )}
        </main>

        {set.keyboard && (
          <Keyboard
            mode={isRomaji ? 'romaji' : 'kana'}
            board={board}
            hintCode={hint.code}
            hintShift={hint.shift}
            pressed={pressed}
            stickyShift={shiftSticky}
            onKey={(code, shift) => (isRomaji ? pressLetter(legendFor(board, code)[0]) : pressKana(code, shift))}
            onShift={() => setShiftSticky((v) => !v)}
          />
        )}

        <footer className="foot">
          <p>
            Kana keys are script-independent — the same physical key types か or カ depending on
            IME mode — so kana drills test <em>sound → key position</em>. Romaji mode tests the
            reading itself. Corpus is generated into a plain TSV text source.
          </p>
          <button className="linkbtn" onClick={() => setStats({ correct: 0, miss: 0, streak: 0, best: 0 })}>
            Reset stats
          </button>
        </footer>
      </div>
    </div>
  );
}
