import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import Icon from '@/components/ui/Icon';
import Wordmark from '@/brand/Wordmark';
import { Popover, Tooltip } from '@/components/ui/Overlay';
import { useBrand } from '@/brand/BrandProvider';
import { usePerspective } from '@/hooks/usePerspective';
import { MERCHANTS, MERCHANT_GROUPS } from '@/data/portfolio';
import { PORTFOLIO_TOTAL } from '@/data/merchants';
import { labelFor, merchantIdsFor, setScope } from '@/data/merchant-scope';
import useMerchantScope from '@/hooks/useMerchantScope';

/**
 * Dark navigation rail with collapsible groups, plus the perspective
 * switcher — the mechanism that makes this one console rather than three.
 * Switching perspective changes the URL's role segment and jumps to that
 * perspective's landing page; the session and user stay the same.
 */

function Flyout({ anchorRect, item }) {
  if (!anchorRect) return null;

  return createPortal(
    <div className="rail__flyout" style={{ left: anchorRect.right + 6, top: anchorRect.top }}>
      <div className="rail__flyout-title">{item.label}</div>
      {item.children.map((child) => (
        <NavLink key={child.path} to={child.path} className={({ isActive }) => `rail__child ${isActive ? 'is-active' : ''}`.trim()}>
          {child.label}
        </NavLink>
      ))}
    </div>,
    document.body,
  );
}

function NavGroup({ item, collapsed }) {
  const { pathname } = useLocation();
  const btnRef = useRef(null);
  const [flyoutRect, setFlyoutRect] = useState(null);

  const isActiveGroup = item.children?.some((c) => pathname.startsWith(c.path)) ?? false;
  const [open, setOpen] = useState(isActiveGroup);

  useEffect(() => {
    if (isActiveGroup) setOpen(true);
  }, [isActiveGroup]);

  if (!item.children) {
    const link = (
      <NavLink to={item.path} className={({ isActive }) => `rail__link ${isActive ? 'is-active' : ''}`.trim()}>
        <Icon name={item.icon} size={16} className="rail__icon" />
        {!collapsed && <span className="rail__label">{item.label}</span>}
      </NavLink>
    );
    return collapsed ? <Tooltip label={item.label} side="right" className="rail__tooltip-fill">{link}</Tooltip> : link;
  }

  if (collapsed) {
    return (
      <div
        onMouseEnter={() => setFlyoutRect(btnRef.current?.getBoundingClientRect() ?? null)}
        onMouseLeave={() => setFlyoutRect(null)}
      >
        <button
          ref={btnRef}
          type="button"
          className="rail__group-btn"
          aria-label={item.label}
          style={isActiveGroup ? { background: 'rgba(255,255,255,0.1)', color: '#fff' } : undefined}
        >
          <Icon name={item.icon} size={16} className="rail__icon" style={isActiveGroup ? { color: 'var(--c-nav-active)' } : undefined} />
        </button>
        {flyoutRect && <Flyout anchorRect={flyoutRect} item={item} />}
      </div>
    );
  }

  return (
    <div>
      <button type="button" className="rail__group-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Icon name={item.icon} size={16} className="rail__icon" style={isActiveGroup ? { color: 'var(--c-nav-active)' } : undefined} />
        <span className="rail__label">{item.label}</span>
        <Icon name="chevronDown" size={13} className={`rail__chevron ${open ? 'is-open' : ''}`.trim()} />
      </button>
      {open && (
        <div className="rail__children">
          {item.children.map((child) => (
            <NavLink key={child.path} to={child.path} className={({ isActive }) => `rail__child ${isActive ? 'is-active' : ''}`.trim()}>
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * MERCHANT SCOPE PICKER
 *
 * Replaces the persona switcher. Nuvei operates one seat — the acquirer — so
 * the useful choice is not "who am I" but "whose book am I looking at".
 *
 * Groups are offered as their own scope so an operator can look at, say, all
 * of Travel & Hospitality without picking merchants off one at a time.
 */
const SCOPE_RESULT_CAP = 6;

function ScopeRow({ active, onClick, icon, title, meta }) {
  return (
    <button type="button" className="popover__item" style={{ alignItems: 'flex-start' }} onClick={onClick}>
      <Icon name={icon} size={15} className={active ? '' : 'subtle'} style={active ? { color: 'var(--c-primary)' } : undefined} />
      <span style={{ minWidth: 0 }}>
        <span className="small strong" style={{ display: 'block' }}>{title}</span>
        {meta && <span className="micro subtle" style={{ display: 'block' }}>{meta}</span>}
      </span>
      {active && <Icon name="check" size={14} style={{ color: 'var(--c-primary)', marginLeft: 'auto' }} />}
    </button>
  );
}

function ScopePickerBody({ scope, close }) {
  const [query, setQuery] = useState('');
  const pick = (next) => { close(); setScope(next); };

  const q = query.trim().toLowerCase();
  const matches = q
    ? MERCHANTS.filter((m) => `${m.name} ${m.vertical ?? ''} ${m.mccLabel ?? ''} ${m.groupLabel ?? ''}`.toLowerCase().includes(q))
    : [];

  return (
    <>
      <div style={{ padding: '8px 10px 6px' }}>
        <div className="msearch__field">
          <Icon name="search" size={14} className="subtle" />
          <input
            type="text"
            value={query}
            placeholder="Search merchants…"
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search merchants"
          />
        </div>
      </div>

      {!q && (
        <>
          <ScopeRow
            active={scope.kind === 'all'}
            onClick={() => pick({ kind: 'all' })}
            icon="layers"
            title="All merchants"
            meta={`Whole portfolio · ${PORTFOLIO_TOTAL} merchants`}
          />
          <div style={{ padding: '8px 10px 2px' }} className="micro subtle">Groups</div>
          {MERCHANT_GROUPS.map((g) => {
            const members = MERCHANTS.filter((m) => m.groupId === g.id);
            if (!members.length) return null;
            return (
              <ScopeRow
                key={g.id}
                active={scope.kind === 'group' && scope.id === g.id}
                onClick={() => pick({ kind: 'group', id: g.id })}
                icon="folder"
                title={g.label}
                meta={`${members.length} merchants`}
              />
            );
          })}
        </>
      )}

      {q && (
        <>
          {matches.slice(0, SCOPE_RESULT_CAP).map((m) => (
            <ScopeRow
              key={m.id}
              active={scope.kind === 'merchant' && scope.id === m.id}
              onClick={() => pick({ kind: 'merchant', id: m.id })}
              icon="briefcase"
              title={m.name}
              meta={`${m.vertical} · ${m.disputeVolume} ${m.disputeVolume === 1 ? 'dispute' : 'disputes'}`}
            />
          ))}
          {matches.length === 0 && <p className="msearch__note">No merchant matches “{query}”.</p>}
          {matches.length > SCOPE_RESULT_CAP && (
            <p className="msearch__note">
              Showing {SCOPE_RESULT_CAP} of {matches.length} matches — keep typing to narrow it down.
            </p>
          )}
        </>
      )}
    </>
  );
}

function MerchantScopePicker({ collapsed }) {
  const scope = useMerchantScope();
  const label = labelFor(scope);
  const sub =
    scope.kind === 'all'
      ? `${PORTFOLIO_TOTAL} merchants`
      : scope.kind === 'group'
        ? `${merchantIdsFor(scope)?.length ?? 0} merchants`
        : MERCHANTS.find((m) => m.id === scope.id)?.vertical ?? '';

  const trigger = ({ toggle }) => {
    const btn = (
      <button type="button" className="rail__perspective-btn" onClick={toggle} aria-label="Change merchant scope">
        <Icon name={scope.kind === 'merchant' ? 'briefcase' : 'layers'} size={15} style={{ color: 'var(--c-nav-active)' }} />
        {!collapsed && (
          <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
            <span className="rail__perspective-label">{label}</span>
            <span className="rail__perspective-sub">{sub}</span>
          </span>
        )}
        {!collapsed && <Icon name="chevronsUpDown" size={13} style={{ color: 'var(--c-nav-ink-muted)', marginLeft: 'auto' }} />}
      </button>
    );
    return collapsed ? <Tooltip label={`${label} — change scope`} side="right" className="rail__tooltip-fill">{btn}</Tooltip> : btn;
  };

  const Row = ({ active, onClick, icon, title, meta }) => (
    <button type="button" className="popover__item" style={{ alignItems: 'flex-start' }} onClick={onClick}>
      <Icon name={icon} size={15} className={active ? '' : 'subtle'} style={active ? { color: 'var(--c-primary)' } : undefined} />
      <span style={{ minWidth: 0 }}>
        <span className="small strong" style={{ display: 'block' }}>{title}</span>
        {meta && <span className="micro subtle" style={{ display: 'block' }}>{meta}</span>}
      </span>
      {active && <Icon name="check" size={14} style={{ color: 'var(--c-primary)', marginLeft: 'auto' }} />}
    </button>
  );

  /**
   * Search first, then groups, then matching merchants.
   *
   * Listing every merchant under every group is fine for a book of nine and
   * impossible for the book this console is for. Typing narrows; with an empty
   * field the picker offers the whole portfolio and the groups, which is what
   * an operator reaches for most of the time anyway. Merchant rows appear only
   * once a search actually selects some, and the list is capped with the true
   * match count stated beneath it.
   */
  const body = ({ close }) => <ScopePickerBody scope={scope} close={close} />;

  return (
    <Popover align="left" width={300} trigger={trigger}>
      {body}
    </Popover>
  );
}

export function Sidebar({ collapsed, onToggle }) {
  const brand = useBrand();
  const { nav } = usePerspective();

  return (
    <aside className={`rail ${collapsed ? 'rail--collapsed' : ''}`.trim()} aria-label="Main navigation">
      <div className="rail__head">
        {!collapsed && <Wordmark inverse size={34} />}
        <button
          type="button"
          className="rail__toggle-btn"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon name={collapsed ? 'chevronsRight' : 'chevronsLeft'} size={16} />
        </button>
      </div>

      <div className="rail__perspective">
        <MerchantScopePicker collapsed={collapsed} />
      </div>

      <nav className="rail__nav">
        {nav.map((item) => <NavGroup key={item.path} item={item} collapsed={collapsed} />)}
      </nav>

      {!collapsed && (
        <div className="rail__foot">{brand.name} · {brand.productName}</div>
      )}
    </aside>
  );
}

export default Sidebar;
