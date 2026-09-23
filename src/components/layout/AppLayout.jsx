import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import Icon from '@/components/ui/Icon';
import OmniSearch from '@/components/layout/OmniSearch';
import { Popover, Tooltip } from '@/components/ui/Overlay';
import { useAuth } from '@/context/AuthContext';
import { useBrand } from '@/brand/BrandProvider';
import { usePerspective } from '@/hooks/usePerspective';
import { readPref, writePref } from '@/utils/storage';
import { relativeTime } from '@/utils/format';

const SIDEBAR_KEY = 'edc.sidebarCollapsed';

const NOTIFICATIONS = [
  { id: 'n1', title: 'Cases due within 24 hours', detail: '18 cases across three queues.', hours: 1, read: false },
  { id: 'n2', title: 'Consolidation detected', detail: 'A transaction is disputed through two channels.', hours: 3, read: false },
  { id: 'n3', title: 'Upload completed', detail: '147 of 148 rows imported.', hours: 6, read: true },
];

function Topbar({ onOpenNav }) {
  const { user, signOut } = useAuth();
  const brand = useBrand();
  const { routes, meta } = usePerspective();
  const navigate = useNavigate();
  const [notes, setNotes] = useState(NOTIFICATIONS);

  const unread = notes.filter((n) => !n.read).length;
  const homeRoute = routes.dashboard ?? routes.overview;

  return (
    <header className="topbar">
      {/* Only rendered as a control below the drawer breakpoint; CSS hides it
          on wider screens where the rail is always visible. */}
      <button
        type="button"
        className="topbar__menu"
        onClick={onOpenNav}
        aria-label="Open navigation"
      >
        <Icon name="menu" size={18} />
      </button>

      {/* The search sits first and widest — it is the fastest route to
          anywhere on the site, so it should look like the main control in the
          bar rather than an afterthought beside the notifications bell. */}
      <OmniSearch />

      {/* Two shortcuts to the screens people open most. The icons are the
          same ones those screens carry in the rail, so the association is
          learned once — which is also why "View my stats" now takes the
          dashboard glyph it actually navigates to, rather than the bar chart
          that belongs to Revenue rules. */}
      <Tooltip label={`Open ${meta.label.toLowerCase()} home`} side="bottom">
        <button type="button" className="topbar__link" onClick={() => navigate(homeRoute)}>
          <Icon name="dashboard" size={15} /> View my stats
        </button>
      </Tooltip>

      <Tooltip label="Ask what your merchants could be worth, and act on it" side="bottom">
        <button type="button" className="topbar__link" onClick={() => navigate(routes.revenueRules)}>
          <Icon name="chart" size={15} /> Revenue rules
        </button>
      </Tooltip>

      <Popover
        align="right"
        width={300}
        trigger={({ toggle }) => (
          <Tooltip label="Notifications" side="bottom">
            <button type="button" className="bell" onClick={toggle} aria-label="Notifications">
              <Icon name="bell" size={17} />
              {unread > 0 && <span className="bell__count">{unread}</span>}
            </button>
          </Tooltip>
        )}
      >
        {() => (
          <>
            <div className="row row--between" style={{ padding: 'var(--s-2)' }}>
              <span className="small strong">Notifications</span>
              {unread > 0 && (
                <button
                  type="button"
                  className="micro"
                  style={{ border: 0, background: 'transparent', color: 'var(--c-primary)', cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => setNotes((p) => p.map((n) => ({ ...n, read: true })))}
                >
                  Mark all read
                </button>
              )}
            </div>
            {notes.map((n) => (
              <button key={n.id} type="button" className="popover__item" style={{ alignItems: 'flex-start' }} onClick={() => setNotes((p) => p.map((x) => (x.id === n.id ? { ...x, read: true } : x)))}>
                <span className={`dot ${n.read ? '' : 'dot--primary'}`} style={{ marginTop: 5, background: n.read ? 'transparent' : undefined }} />
                <span style={{ minWidth: 0 }}>
                  <span className="small strong" style={{ display: 'block' }}>{n.title}</span>
                  <span className="micro subtle" style={{ display: 'block' }}>{n.detail}</span>
                  <span className="nano subtle">{relativeTime(new Date(Date.now() - n.hours * 3_600_000).toISOString())}</span>
                </span>
              </button>
            ))}
          </>
        )}
      </Popover>

      <Popover
        align="right"
        width={220}
        trigger={({ toggle }) => (
          <button type="button" className="row row--xtight" style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 2 }} onClick={toggle} aria-label="Account menu">
            <span className="avatar">{user?.initials}</span>
            <span style={{ textAlign: 'left', lineHeight: 1.25 }}>
              <span className="small strong" style={{ display: 'block' }}>{user?.roleLabel}</span>
              <span className="nano subtle">{brand.shortName} · {meta.label}</span>
            </span>
            <Icon name="chevronDown" size={13} className="subtle" />
          </button>
        )}
      >
        {() => (
          <>
            <div style={{ padding: 'var(--s-2)', borderBottom: '1px solid var(--c-line)' }}>
              <div className="small strong">{user?.name}</div>
              <div className="micro subtle">{user?.email}</div>
            </div>
            <button type="button" className="popover__item" onClick={signOut}>
              <Icon name="logout" size={14} className="subtle" /> Log out
            </button>
          </>
        )}
      </Popover>
    </header>
  );
}

/* Two breakpoints, for two different problems.
 *
 *   < 1024  the rail costs more screen than it earns, so it collapses to icons
 *   <  760  it cannot earn its place at all, so it becomes an overlay drawer
 *
 * The stored preference still wins on a wide screen; it is only overridden
 * while the viewport is too narrow to honour it. */
const COLLAPSE_AT = 1024;
const DRAWER_AT = 760;

function useViewport() {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 1440 : window.innerWidth));
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

export function AppLayout() {
  const width = useViewport();
  const [preferred, setPreferred] = useState(() => readPref(SIDEBAR_KEY) === 'true');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isDrawer = width < DRAWER_AT;
  const collapsed = isDrawer ? false : preferred || width < COLLAPSE_AT;

  const toggle = () => {
    setPreferred((c) => {
      const next = !c;
      writePref(SIDEBAR_KEY, next);
      return next;
    });
  };

  // A route change should not leave the drawer sitting open over the page.
  const location = useLocation();
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  return (
    <div className={`shell ${isDrawer ? 'shell--drawer' : ''}`.trim()}>
      {isDrawer && drawerOpen && (
        <button
          type="button"
          className="shell__scrim"
          aria-label="Close navigation"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <div className={`shell__rail ${isDrawer && drawerOpen ? 'is-open' : ''}`.trim()}>
        <Sidebar collapsed={collapsed} onToggle={isDrawer ? () => setDrawerOpen(false) : toggle} />
      </div>

      <div className="shell__main">
        <Topbar onOpenNav={() => setDrawerOpen(true)} />
        <main className="shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
