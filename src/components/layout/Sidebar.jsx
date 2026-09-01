import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import Icon from '@/components/ui/Icon';
import Wordmark from '@/brand/Wordmark';
import { Popover, Tooltip } from '@/components/ui/Overlay';
import { useBrand } from '@/brand/BrandProvider';
import { usePerspective } from '@/hooks/usePerspective';
import { PERSPECTIVES } from '@/data/perspectives';

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

function PerspectiveSwitcher({ collapsed }) {
  const { id, meta, switchTo } = usePerspective();

  const trigger = ({ toggle }) => {
    const btn = (
      <button type="button" className="rail__perspective-btn" onClick={toggle} aria-label="Switch perspective">
        <Icon name={meta.icon} size={15} style={{ color: 'var(--c-nav-active)' }} />
        {!collapsed && (
          <span style={{ minWidth: 0, textAlign: 'left' }}>
            <span className="rail__perspective-label">{meta.label}</span>
            <span className="rail__perspective-sub">{meta.subtitle}</span>
          </span>
        )}
        {!collapsed && <Icon name="chevronsUpDown" size={13} style={{ color: 'var(--c-nav-ink-muted)', marginLeft: 'auto' }} />}
      </button>
    );
    return collapsed ? <Tooltip label={`${meta.label} — switch perspective`} side="right" className="rail__tooltip-fill">{btn}</Tooltip> : btn;
  };

  const body = ({ close }) => (
    <>
      <div style={{ padding: '8px 10px 4px' }} className="micro subtle">Switch perspective</div>
      {PERSPECTIVES.map((p) => (
        <button
          key={p.id}
          type="button"
          className="popover__item"
          style={{ alignItems: 'flex-start' }}
          onClick={() => {
            close();
            if (p.id !== id) switchTo(p.id);
          }}
        >
          <Icon name={p.icon} size={15} className={p.id === id ? '' : 'subtle'} style={p.id === id ? { color: 'var(--c-primary)' } : undefined} />
          <span style={{ minWidth: 0 }}>
            <span className="small strong" style={{ display: 'block' }}>{p.label}</span>
            <span className="micro subtle" style={{ display: 'block' }}>{p.tagline}</span>
          </span>
          {p.id === id && <Icon name="check" size={14} style={{ color: 'var(--c-primary)', marginLeft: 'auto' }} />}
        </button>
      ))}
    </>
  );

  return (
    <Popover align="left" width={280} trigger={trigger}>
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
        <PerspectiveSwitcher collapsed={collapsed} />
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
