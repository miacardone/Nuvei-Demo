import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import Icon from '@/components/ui/Icon';
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

function Topbar() {
  const { user, signOut } = useAuth();
  const brand = useBrand();
  const { routes, meta } = usePerspective();
  const navigate = useNavigate();
  const [notes, setNotes] = useState(NOTIFICATIONS);

  const unread = notes.filter((n) => !n.read).length;
  const homeRoute = routes.dashboard ?? routes.overview;

  return (
    <header className="topbar">
      <Tooltip label={`Open ${meta.label.toLowerCase()} home`} side="bottom">
        <button
          type="button"
          className="row row--xtight"
          style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--c-ink-muted)', fontSize: 'var(--fs-small)' }}
          onClick={() => navigate(homeRoute)}
        >
          <Icon name="chart" size={15} /> View my stats
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

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => readPref(SIDEBAR_KEY) === 'true');

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      writePref(SIDEBAR_KEY, next);
      return next;
    });
  };

  return (
    <div className="shell">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="shell__main">
        <Topbar />
        <main className="shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
