import { useMemo, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { formatNumber, formatPercent } from '@/utils/format';

/**
 * MERCHANT SEARCH — selection that does not depend on the list being short.
 *
 * The control this replaces rendered every merchant. That is fine for a book
 * of nine and unusable for a book of millions, which is the size of book this
 * console is actually for. So: nothing is listed until you type, results are
 * capped, and the cap is stated along with the true match count — a reader
 * must never be left wondering whether what they can see is everything.
 *
 * Chosen merchants are chips above the field rather than ticks in a list, so
 * the selection stays visible and removable no matter how far the results have
 * moved on. That is also what makes a selection of forty legible.
 *
 * `suggestions` seeds the empty state — the handful worth offering before
 * anyone types. At scale that would be the accounts you touched most recently;
 * here it is the busiest by dispute volume.
 */

const RESULT_CAP = 8;

export function MerchantSearch({
  merchants,
  groups = [],
  selected = [],
  onChange,
  suggestions = [],
  placeholder = 'Search merchants or merchant types…',
  emptyHint = 'Start typing to find a merchant.',
}) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);

  const chosen = useMemo(
    () => selected.map((id) => merchants.find((m) => m.id === id)).filter(Boolean),
    [selected, merchants],
  );

  const q = query.trim().toLowerCase();

  /**
   * Merchant types are searchable alongside merchants, because at portfolio
   * size "all of Travel & Hospitality" is far more often what someone means
   * than six names typed one at a time. Choosing a type selects its members,
   * so everything downstream still works on merchants and nothing has to know
   * the difference.
   */
  const typeMatches = useMemo(() => {
    if (!q) return [];
    return groups
      .map((g) => ({ ...g, members: merchants.filter((m) => m.groupId === g.id) }))
      .filter((g) => g.members.length && g.label.toLowerCase().includes(q));
  }, [q, groups, merchants]);

  /** Every match, so the count is the truth even though the list is capped. */
  const matches = useMemo(() => {
    if (!q) return [];
    return merchants.filter((m) => `${m.name} ${m.vertical ?? ''} ${m.mccLabel ?? ''} ${m.mccCode ?? ''} ${m.groupLabel ?? ''}`
      .toLowerCase()
      .includes(q));
  }, [q, merchants]);

  const shown = q ? matches.slice(0, RESULT_CAP) : suggestions.slice(0, RESULT_CAP);

  const toggle = (id) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    setQuery('');
    setCursor(0);
    inputRef.current?.focus();
  };

  /** Selecting a type adds every member that is not already chosen. */
  const toggleType = (group) => {
    const ids = group.members.map((m) => m.id);
    const allOn = ids.every((id) => selected.includes(id));
    onChange(allOn ? selected.filter((id) => !ids.includes(id)) : [...new Set([...selected, ...ids])]);
    setQuery('');
    setCursor(0);
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter' && shown[cursor]) { e.preventDefault(); toggle(shown[cursor].id); }
    else if (e.key === 'Escape') { setQuery(''); }
    else if (e.key === 'Backspace' && !query && chosen.length) { onChange(selected.slice(0, -1)); }
  };

  return (
    <div className="msearch">
      {chosen.length > 0 && (
        <div className="msearch__chips">
          {chosen.map((m) => (
            <span key={m.id} className="msearch__chip">
              <span className="msearch__chip-name">{m.name}</span>
              <button type="button" onClick={() => toggle(m.id)} aria-label={`Remove ${m.name}`}>
                <Icon name="close" size={11} />
              </button>
            </span>
          ))}
          {chosen.length > 1 && (
            <button type="button" className="msearch__clear" onClick={() => onChange([])}>Clear all</button>
          )}
        </div>
      )}

      <div className="msearch__field">
        <Icon name="search" size={14} className="subtle" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={placeholder}
          onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
          onKeyDown={onKeyDown}
          aria-label="Search merchants"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
            <Icon name="close" size={12} />
          </button>
        )}
      </div>

      <div className="msearch__results">
        {!q && suggestions.length > 0 && (
          <>
            <div className="msearch__label">Most active accounts</div>
            <p className="msearch__note" style={{ padding: '0 var(--s-2) 4px' }}>
              Search by merchant name, vertical, MCC — or by merchant type to take a whole group at once.
            </p>
          </>
        )}

        {typeMatches.length > 0 && (
          <>
            <div className="msearch__label">Merchant types</div>
            {typeMatches.map((g) => {
              const ids = g.members.map((m) => m.id);
              const allOn = ids.every((id) => selected.includes(id));
              return (
                <button key={g.id} type="button" className={`msearch__row ${allOn ? 'is-active' : ''}`.trim()} onClick={() => toggleType(g)}>
                  <span className="msearch__check">{allOn && <Icon name="check" size={11} />}</span>
                  <span className="msearch__row-body">
                    <span className="msearch__row-name">{g.label}</span>
                    <span className="msearch__row-meta">{formatNumber(g.members.length)} merchants in this type</span>
                  </span>
                  <span className="msearch__row-stat">all</span>
                </button>
              );
            })}
            <div className="msearch__label">Merchants</div>
          </>
        )}

        {shown.map((m, i) => {
          const on = selected.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              className={`msearch__row ${on ? 'is-active' : ''} ${i === cursor ? 'is-cursor' : ''}`.trim()}
              onMouseEnter={() => setCursor(i)}
              onClick={() => toggle(m.id)}
            >
              <span className="msearch__check">{on && <Icon name="check" size={11} />}</span>
              <span className="msearch__row-body">
                <span className="msearch__row-name">{m.name}</span>
                <span className="msearch__row-meta">{m.groupLabel ?? m.vertical}</span>
              </span>
              {/* Labelled, because a bare "0.14%" beside a merchant name is a
                  number nobody can identify. */}
              <span className="msearch__row-stat" title="Chargeback ratio">
                {formatPercent(m.chargebackRatio ?? 0, 2)} <span className="msearch__row-unit">CB</span>
              </span>
            </button>
          );
        })}

        {q && matches.length === 0 && (
          <p className="msearch__note">No merchant matches “{query}”.</p>
        )}

        {!q && suggestions.length === 0 && <p className="msearch__note">{emptyHint}</p>}

        {/* The cap is never silent. A reader who cannot see the whole result
            set has to be told that is what is happening, and how much is
            hidden, or they will read the first eight as the answer. */}
        {q && matches.length > RESULT_CAP && (
          <p className="msearch__note">
            Showing {RESULT_CAP} of {formatNumber(matches.length)} matches — keep typing to narrow it down.
          </p>
        )}
      </div>
    </div>
  );
}

export default MerchantSearch;
