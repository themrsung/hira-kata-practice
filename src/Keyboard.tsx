import {
  JIS_ONLY,
  KANA_LAYOUT,
  ROMAJI_ROWS,
  ROWS,
  legendFor,
  type Board,
  type KeyCode,
} from './lib/layouts';
import { asScript, type Script } from './lib/kana';

interface Props {
  mode: 'kana' | 'romaji';
  board: Board;
  /** script the kana legends are drawn in (the physical key is the same either way) */
  legend: Script;
  /** key the hint wants next (null = no hint) */
  hintCode: KeyCode | null;
  /** whether that hint keystroke also needs Shift */
  hintShift: boolean;
  pressed: KeyCode | null;
  stickyShift: boolean;
  onKey: (code: KeyCode, shift: boolean) => void;
  onShift: () => void;
}

export default function Keyboard({
  mode, board, legend, hintCode, hintShift, pressed, stickyShift, onKey, onShift,
}: Props) {
  const rows = mode === 'romaji' ? ROMAJI_ROWS : ROWS;

  const renderKey = (code: KeyCode) => {
    const absent = board === 'ansi' && JIS_ONLY.includes(code);
    const [lat, latShift] = legendFor(board, code);
    const kana = KANA_LAYOUT[code];
    const cls = [
      'key',
      hintCode === code && !absent ? 'hint' : '',
      pressed === code ? 'press' : '',
      absent ? 'absent' : '',
      board === 'jis' && JIS_ONLY.includes(code) ? 'jis-only' : '',
    ].filter(Boolean).join(' ');

    return (
      <button
        key={code}
        type="button"
        className={cls}
        disabled={absent}
        onClick={() => !absent && onKey(code, stickyShift)}
        title={absent ? 'Not present on an ANSI board' : undefined}
      >
        {mode === 'romaji' ? (
          <span className="rom">{lat}</span>
        ) : (
          <>
            <span className="lat">{stickyShift ? latShift || lat : lat}</span>
            {kana?.shift && <span className="kana-sm">{asScript(kana.shift, legend)}</span>}
            <span className="kana">
              {asScript((stickyShift && kana?.shift) || kana?.base || '', legend)}
            </span>
          </>
        )}
      </button>
    );
  };

  return (
    <div className="board">
      {rows.map((row, i) => {
        // ANSI still renders the two JIS-only keys, greyed out, so the missing
        // `IntlYen` / `IntlRo` positions are visible rather than silently gone.
        const isBottom = mode === 'kana' ? i === 3 : i === 2;
        return (
          <div className="krow" key={i}>
            {isBottom && mode === 'kana' && (
              <button
                type="button"
                className={`key wide ${hintShift && hintCode ? 'hint-mod' : ''} ${stickyShift ? 'press' : ''}`}
                onClick={onShift}
                aria-pressed={stickyShift}
              >
                <span className="mod">⇧ Shift</span>
              </button>
            )}
            {row.map(renderKey)}
          </div>
        );
      })}
    </div>
  );
}
