import { useMemo, useState } from 'react';
import { PageHeader, Card, Button, Badge } from '@/components/ui/Surface';
import { TextField } from '@/components/ui/Form';
import Icon from '@/components/ui/Icon';
import { useBrand } from '@/brand/BrandProvider';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { usePerspective } from '@/hooks/usePerspective';
import { formatDateTime, relativeTime } from '@/utils/format';

/** Each rule is a predicate evaluated on every keystroke, so the checklist
 *  ticks as you type instead of failing on submit and leaving you to guess. */
const POLICY = [
  { id: 'length', label: 'At least 12 characters', test: (v) => v.length >= 12 },
  { id: 'upper', label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { id: 'lower', label: 'One lowercase letter', test: (v) => /[a-z]/.test(v) },
  { id: 'digit', label: 'One number', test: (v) => /\d/.test(v) },
  { id: 'symbol', label: 'One symbol', test: (v) => /[^A-Za-z0-9]/.test(v) },
  { id: 'trim', label: 'No leading or trailing spaces', test: (v) => v.length > 0 && v.trim() === v },
];

const SESSIONS = [
  { id: 's1', device: 'Chrome on macOS', location: 'Seattle, US', hours: 0, current: true },
  { id: 's2', device: 'Safari on iOS', location: 'London, GB', hours: 72, current: false },
];

export function AccountSettings() {
  const brand = useBrand();
  const { user } = useAuth();
  const { notify } = useToast();
  const { meta } = usePerspective();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const results = useMemo(() => POLICY.map((r) => ({ ...r, met: r.test(next) })), [next]);
  const allMet = results.every((r) => r.met);
  const matches = next.length > 0 && next === confirm;

  return (
    <>
      <PageHeader title="Account settings" description="Your profile, password and active sessions." />

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.3fr) minmax(280px, 1fr)', alignItems: 'start' }}>
        <div className="stack stack--tight">
          <Card title="Change password">
            <form
              className="stack"
              onSubmit={(e) => { e.preventDefault(); notify('Password changed.', 'success'); setCurrent(''); setNext(''); setConfirm(''); }}
            >
              <TextField label="Current password" required type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
              <TextField label="New password" required type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />

              <div className="policy">
                {results.map((r) => (
                  <span key={r.id} className={`policy__item ${r.met ? 'is-met' : ''}`.trim()}>
                    <span className="policy__marker"><Icon name="check" size={9} strokeWidth={3} /></span>
                    {r.label}
                  </span>
                ))}
              </div>

              <TextField
                label="Confirm new password"
                required
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                error={confirm && !matches ? 'Passwords do not match.' : undefined}
              />

              <Button type="submit" variant="primary" disabled={!current || !allMet || !matches}>Change password</Button>
            </form>
          </Card>

          <Card title="Active sessions" bodyClassName="card__body--tight">
            <div className="hairlines">
              {SESSIONS.map((s) => (
                <div key={s.id} className="row row--between" style={{ padding: 'var(--s-2) 0' }}>
                  <span className="stack stack--xtight">
                    <span className="row row--xtight"><span className="small">{s.device}</span>{s.current && <Badge tone="primary">This device</Badge>}</span>
                    <span className="micro subtle">{s.location}</span>
                  </span>
                  <span className="micro subtle">{relativeTime(new Date(Date.now() - s.hours * 3_600_000).toISOString())}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card title="Profile">
          <div className="stack stack--tight">
            <div className="row row--tight">
              <span className="avatar" style={{ width: 40, height: 40, fontSize: 'var(--fs-small)' }}>{user?.initials}</span>
              <span className="stack stack--xtight">
                <span className="strong">{user?.name}</span>
                <span className="micro subtle">{user?.email}</span>
              </span>
            </div>
            <div className="hairlines">
              {[['Role', user?.roleLabel], ['Perspective', meta.label], ['Timezone', brand.timezone], ['Locale', brand.locale], ['Tenant', brand.name]].map(([k, v]) => (
                <div key={k} className="row row--between" style={{ padding: '6px 0' }}>
                  <span className="micro subtle">{k}</span><span className="small">{v}</span>
                </div>
              ))}
              <div className="row row--between" style={{ padding: '6px 0' }}>
                <span className="micro subtle">Two-factor</span><Badge tone="success">Enabled</Badge>
              </div>
              <div className="row row--between" style={{ padding: '6px 0' }}>
                <span className="micro subtle">Password changed</span>
                <span className="small">{formatDateTime(new Date(Date.now() - 62 * 86400000).toISOString())}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

export default AccountSettings;
