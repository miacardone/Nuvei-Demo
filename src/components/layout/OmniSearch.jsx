import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import Icon from '@/components/ui/Icon';
import { SEARCH_HINTS, searchEverything } from '@/domain/omnisearch';
import { formatNumber } from '@/utils/format';

/**
 * SITE SEARCH — one box in the top bar for getting anywhere.
 *
 * It answers two different kinds of input and says which is which, because a
 * box that silently does two things feels unreliable:
 *
 *   Type a NAME and you get a list — pages, merchants, people, cases, queues —
 *   grouped, ranked, and capped with the true count so nobody mistakes the
 *   first five for all of them.
 *
 *   Type a QUESTION and the first row offered is "answer this", which opens
 *   Revenue rules with the sentence already in Describe it. It only appears
 *   when the command parser can genuinely build a rule from what you typed;
 *   an offer that leads somewhere useless is worse than no offer.
 *
 * Keyboard first: ⌘K or / opens it, arrows move, enter goes, escape closes.
 * A search box you have to reach for with a mouse is one people stop using.
 */
export function OmniSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  const { groups, ask, total } = useMemo(() => searchEverything(query), [query]);

  /* One flat list behind the grouped display, so the arrow keys can run
     straight through the groups without the caller tracking which group it is
     currently inside. */
  const flat = useMemo(() => {
    const rows = ask ? [{ kind: 'ask', ...ask }] : [];
    groups.forEach((g) => g.rows.forEach((r) => rows.push({ kind: 'row', group: g.id, ...r })));
    return rows;
  }, [groups, ask]);

  useEffect(() => { setCursor(0); }, [query]);

  // ⌘K / Ctrl-K from anywhere, and "/" when not already typing in a field.
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === '/' && !typing && !open) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
    else { setQuery(''); setCursor(0); }
  }, [open]);

  // Clicking outside closes it, the same as escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const go = (row) => {
    if (!row) return;
    setOpen(false);
    navigate(row.path);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(flat[cursor]); }
  };

  let index = -1;

  const panel = open ? createPortal(
    <div className="omni__backdrop" role="dialog" aria-modal="true" aria-label="Search">
      <div className="omni" ref={panelRef}>
        <div className="omni__field">
          <Icon name="search" size={17} style={{ color: 'var(--c-primary)', flex: 'none' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder="Search for anything, or ask a question…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Search"
          />
          <kbd className="omni__kbd">esc</kbd>
        </div>

        <div className="omni__results">
          {query.trim().length < 2 && (
            <div className="omni__hints">
              <div className="omni__label">Try</div>
              {SEARCH_HINTS.map((h) => (
                <button key={h.label} type="button" className="omni__row" onClick={() => setQuery(h.label)}>
                  <Icon name="search" size={14} className="subtle" />
                  <span className="omni__row-body">
                    <span className="omni__row-title">{h.label}</span>
                    <span className="omni__row-meta">{h.kind}</span>
                  </span>
                </button>
              ))}
              <p className="omni__note">
                Type a name to jump to it, or a whole question to have it answered.
              </p>
            </div>
          )}

          {query.trim().length >= 2 && (
            <>
              {/* The answerable-question route, offered first because if it
                  applies it is almost certainly what was meant. */}
              {ask && (() => {
                index += 1;
                const i = index;
                return (
                  <div key="ask">
                    <div className="omni__label">Answer this</div>
                    <button
                      type="button"
                      className={`omni__row omni__row--ask ${cursor === i ? 'is-cursor' : ''}`.trim()}
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => go(flat[i])}
                    >
                      <Icon name="chart" size={15} />
                      <span className="omni__row-body">
                        <span className="omni__row-title">“{ask.query}”</span>
                        <span className="omni__row-meta">
                          Open Revenue rules with this already typed in — understood: {ask.understood.slice(0, 3).join(', ')}
                        </span>
                      </span>
                      <Icon name="arrowUp" size={13} style={{ transform: 'rotate(45deg)' }} className="subtle" />
                    </button>
                  </div>
                );
              })()}

              {groups.map((g) => (
                <div key={g.id}>
                  <div className="omni__label">
                    {g.label}
                    {g.total > g.rows.length && (
                      <span className="omni__count">{g.rows.length} of {formatNumber(g.total)}</span>
                    )}
                  </div>
                  {g.rows.map((r) => {
                    index += 1;
                    const i = index;
                    return (
                      <button
                        key={`${g.id}-${r.path}-${r.title}`}
                        type="button"
                        className={`omni__row ${cursor === i ? 'is-cursor' : ''}`.trim()}
                        onMouseEnter={() => setCursor(i)}
                        onClick={() => go(flat[i])}
                      >
                        <Icon name={g.icon} size={14} className="subtle" />
                        <span className="omni__row-body">
                          <span className="omni__row-title">{r.title}</span>
                          <span className="omni__row-meta">{r.meta}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}

              {!total && !ask && (
                <p className="omni__note">
                  Nothing matches “{query}”. Try a merchant name, a page, a case number — or ask a
                  full question like “which merchants should we indemnify”.
                </p>
              )}
            </>
          )}
        </div>

        <div className="omni__footer">
          <span><kbd className="omni__kbd">↑</kbd><kbd className="omni__kbd">↓</kbd> move</span>
          <span><kbd className="omni__kbd">↵</kbd> open</span>
          <span><kbd className="omni__kbd">esc</kbd> close</span>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button type="button" className="omni-trigger" onClick={() => setOpen(true)}>
        <Icon name="search" size={14} className="subtle" />
        <span className="omni-trigger__text">Search or ask…</span>
        <kbd className="omni__kbd">⌘K</kbd>
      </button>
      {panel}
    </>
  );
}

export default OmniSearch;
