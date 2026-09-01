import { useMemo, useState } from 'react';
import { PageHeader, Card, Toolbar, Tabs, SubTabs, Button, IconButton, Badge, Stepper, StatusIcon } from '@/components/ui/Surface';
import { DataTable, ExportButtons } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { CheckboxRow, SearchInput, SelectField, TextAreaField, TextField } from '@/components/ui/Form';
import { Tooltip, TruncatedText } from '@/components/ui/Overlay';
import Icon from '@/components/ui/Icon';
import { GROUPS, ROLES, SKILLS, SKILL_OPTIONS, USERS, USER_GROUPS, USER_STATUSES } from '@/data/people';
import { permissionsFor, PERMISSION_ROLES } from '@/data/permissions';
import { CRITERIA_CATEGORIES } from '@/domain/criteria';
import { useToast } from '@/context/ToastContext';
import { usePerspective } from '@/hooks/usePerspective';
import { formatDate, formatNumber } from '@/utils/format';

/** Forces Permissions to remount (fresh grant state) when the perspective changes. */
function PermissionsForPerspective() {
  const { id } = usePerspective();
  return <Permissions key={id} />;
}

/**
 * Users — ONE page with tabs, not a dropdown of three separate screens.
 * User management carries Users / Roles / Groups as sub-tabs.
 *
 * Shared across all three perspectives — the operator directory is the same
 * people, wearing whichever seat's hat the demo is currently showing. Only
 * the Permissions tab's grid changes, because it's generated from that
 * perspective's own navigation (see data/permissions.js).
 */

const TABS = [
  { value: 'management', label: 'User management' },
  { value: 'skills', label: 'Skills' },
  { value: 'permissions', label: 'Permissions' },
];

const SUB_TABS = [
  { value: 'users', label: 'Users' },
  { value: 'roles', label: 'Roles' },
  { value: 'groups', label: 'Groups' },
];

/* ---------- Create user ---------- */

/** `user` is optional — present when editing, absent when creating. Prefills
 *  from the existing record and swaps the title/button copy accordingly, but
 *  it's the same form either way: editing isn't a different shape of user. */
function UserModal({ open, onClose, onSave, user }) {
  const isEdit = Boolean(user);
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [role, setRole] = useState(user?.role ?? ROLES[2].name);
  const [group, setGroup] = useState(user?.group ?? USER_GROUPS[1]);
  const [status, setStatus] = useState(user?.status ?? 'Active');
  const [skills, setSkills] = useState(user?.skills ?? [SKILL_OPTIONS[0]]);

  // `user` only changes when a different row is opened for editing (or the
  // modal reopens for Create, where it's undefined) — resync the form then,
  // not on every render.
  const userKey = user?.id ?? null;
  const [lastUserKey, setLastUserKey] = useState(userKey);
  if (userKey !== lastUserKey) {
    setLastUserKey(userKey);
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
    setRole(user?.role ?? ROLES[2].name);
    setGroup(user?.group ?? USER_GROUPS[1]);
    setStatus(user?.status ?? 'Active');
    setSkills(user?.skills ?? [SKILL_OPTIONS[0]]);
  }

  const valid = name.trim() && /.+@.+\..+/.test(email);

  const submit = () => {
    onSave({ ...(isEdit ? user : {}), name: name.trim(), email: email.trim(), role, group, status, skills });
    if (!isEdit) { setName(''); setEmail(''); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${user.name}` : 'Create user'}
      size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={submit}>{isEdit ? 'Save changes' : 'Create user'}</Button></>}
    >
      <div className="stack">
        <TextField label="Full name" required value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={email && !/.+@.+\..+/.test(email) ? 'Enter a valid email address.' : undefined} />

        <div className="grid grid--2">
          <SelectField label="Role" required value={role} onChange={(e) => setRole(e.target.value)} options={ROLES.map((r) => ({ value: r.name, label: r.name }))} />
          <SelectField label="Group" value={group} onChange={(e) => setGroup(e.target.value)} options={USER_GROUPS.map((g) => ({ value: g, label: g }))} />
        </div>

        {isEdit && (
          <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={USER_STATUSES.map((s) => ({ value: s, label: s }))} />
        )}

        <div className="field">
          <span className="field__label">Skills</span>
          <div className="grid grid--2" style={{ gap: 'var(--s-2)' }}>
            {SKILL_OPTIONS.map((s) => (
              <CheckboxRow
                key={s}
                label={s}
                checked={skills.includes(s)}
                onChange={() => setSkills((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]))}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Create skill (3-step) ---------- */

function SkillModal({ open, onClose, onSave }) {
  const [step, setStep] = useState(0);
  const [criteria, setCriteria] = useState(CRITERIA_CATEGORIES[2].key);
  const [operator, setOperator] = useState('is');
  const [value, setValue] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const STEPS = ['Criteria', 'Modify Criteria', 'Skill Details'];
  const canNext = step === 0 ? Boolean(criteria) : step === 1 ? Boolean(value) : Boolean(name.trim());

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create skill"
      size="lg"
      footer={
        <>
          {step > 0 && <Button variant="secondary" onClick={() => setStep(step - 1)}>Back</Button>}
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          {step < 2
            ? <Button variant="primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Next</Button>
            : <Button variant="primary" disabled={!canNext} onClick={() => { onSave({ name: name.trim(), criteria: `${criteria} ${operator} ${value}`, description: description.trim() }); setStep(0); setName(''); setValue(''); }}>Create skill</Button>}
        </>
      }
    >
      <div className="stack">
        <Stepper steps={STEPS} current={step} />

        {step === 0 && (
          <SelectField label="Match on" required value={criteria} onChange={(e) => setCriteria(e.target.value)} options={CRITERIA_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))} />
        )}
        {step === 1 && (
          <div className="grid grid--2">
            <SelectField label="Operator" value={operator} onChange={(e) => setOperator(e.target.value)} options={['is', 'is not', 'is greater than', 'is less than'].map((o) => ({ value: o, label: o }))} />
            <TextField label="Value" required value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
        )}
        {step === 2 && (
          <div className="stack stack--tight">
            <TextField label="Skill name" required value={name} onChange={(e) => setName(e.target.value)} />
            <TextAreaField label="Description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            <div style={{ padding: 'var(--s-3)', background: 'var(--c-surface-sunken)', borderRadius: 'var(--r-md)' }}>
              <span className="t-section-label">Summary</span>
              <p className="small">Matches when <strong>{criteria}</strong> {operator} <strong>{value}</strong>.</p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ---------- Permissions ---------- */

function Permissions() {
  const { id: perspectiveId, meta } = usePerspective();
  const permissions = useMemo(() => permissionsFor(perspectiveId), [perspectiveId]);

  const [roleId, setRoleId] = useState(PERMISSION_ROLES[0].id);
  const [grants, setGrants] = useState(() =>
    Object.fromEntries(Object.entries(permissions.defaultGrants).map(([k, v]) => [k, new Set(v)])));

  const role = PERMISSION_ROLES.find((r) => r.id === roleId);
  const granted = grants[roleId] ?? new Set();
  const total = permissions.all.length;

  const toggle = (perm) => {
    setGrants((prev) => {
      const next = new Set(prev[roleId] ?? []);
      if (next.has(perm)) next.delete(perm); else next.add(perm);
      return { ...prev, [roleId]: next };
    });
  };

  return (
    <div className="stack stack--tight">
      <p className="small subtle">{meta.label} perspective — this grid is generated from the {meta.label.toLowerCase()} navigation, so it can never grant access to a page that doesn't exist here.</p>

      <Tabs
        tabs={PERMISSION_ROLES.map((r) => ({ value: r.id, label: r.name, badge: `${(grants[r.id] ?? new Set()).size}/${total}` }))}
        value={roleId}
        onChange={setRoleId}
      />

      <Card
        title={`${role.name} permissions`}
        action={<span className="micro subtle">{granted.size} of {total} granted</span>}
      >
        <p className="row row--xtight small muted" style={{ marginBottom: 'var(--s-4)' }}>
          <Icon name="shield" size={14} style={{ color: 'var(--c-primary)' }} />
          {role.description}
        </p>

        <div className="stack stack--loose">
          {permissions.groups.map((group) => (
            <div key={group.area}>
              <h3 className="t-section-label" style={{ marginBottom: 'var(--s-2)' }}>{group.area}</h3>
              <div className="perm-grid">
                {group.permissions.map((perm) => {
                  const on = granted.has(perm);

                  /**
                   * An UNGRANTED permission is a plain bordered row with a gray
                   * label and NO TOGGLE — not a toggle in the off position.
                   * Compare Manager's "Delete Cases" to Admin's.
                   */
                  if (!on) {
                    return (
                      <Tooltip key={perm} label={`${role.name} does not have ${perm}. Grant it from a role with the Permissions capability.`} wide>
                        <div className="perm-row perm-row--denied">
                          <span>{perm}</span>
                        </div>
                      </Tooltip>
                    );
                  }

                  return (
                    <button key={perm} type="button" className="perm-row perm-row--granted" onClick={() => toggle(perm)}>
                      <span>{perm}</span>
                      <input type="checkbox" className="toggle" checked readOnly tabIndex={-1} aria-label={`${perm} granted`} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ---------- Page ---------- */

export function Users() {
  const { notify } = useToast();
  const [tab, setTab] = useState('management');
  const [subTab, setSubTab] = useState('users');
  const [users, setUsers] = useState(USERS);
  const [skills, setSkills] = useState(SKILLS);
  const [search, setSearch] = useState('');
  const [userModal, setUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [skillModal, setSkillModal] = useState(false);

  const filteredUsers = users.filter((u) => `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(search.toLowerCase()));

  const userColumns = [
    {
      key: 'name', header: 'Name', fw: 14,
      cell: (u) => (
        <span className="row row--xtight row--nowrap" style={{ minWidth: 0 }}>
          <span className="avatar avatar--sm avatar--tint">{u.initials}</span>
          <span className="stack stack--xtight" style={{ minWidth: 0 }}>
            <span className="small strong truncate">{u.name}</span>
            <TruncatedText value={u.email} className="micro subtle" />
          </span>
        </span>
      ),
    },
    { key: 'role', header: 'Role', fw: 9, cell: (u) => <span className="small">{u.role}</span> },
    { key: 'group', header: 'Group', fw: 8, cell: (u) => <span className="small">{u.group}</span> },
    { key: 'skills', header: 'Skills', fw: 12, cell: (u) => <TruncatedText value={u.skills.join(', ')} className="micro subtle" /> },
    { key: 'status', header: 'Status', fw: 6, align: 'center', cell: (u) => <StatusIcon icon={u.status === 'Active' ? 'check' : 'close'} tone={u.status === 'Active' ? 'success' : 'muted'} label={u.status} /> },
    { key: 'confirmation', header: 'Confirmation', fw: 9, cell: (u) => <span className="micro subtle">{u.confirmation}</span> },
    { key: 'lockStatus', header: 'Lock', fw: 5, align: 'center', cell: (u) => <StatusIcon icon="lock" tone={u.lockStatus === 'Locked' ? 'danger' : 'muted'} label={u.lockStatus} /> },
    { key: 'startDate', header: 'Start date', fw: 7, cell: (u) => <span className="small">{formatDate(u.startDate)}</span> },
    { key: 'actions', header: 'Actions', pinned: true, fw: 5, width: '52px', align: 'center', cell: (u) => <IconButton icon="edit" label="Edit user" size={13} onClick={() => setEditingUser(u)} /> },
  ];

  const roleColumns = [
    { key: 'name', header: 'Role', fw: 10, cell: (r) => <span className="small strong">{r.name}</span> },
    { key: 'description', header: 'Description', fw: 20, cell: (r) => <TruncatedText value={r.description} className="small muted" /> },
    { key: 'users', header: 'Members', fw: 6, align: 'right', cell: (r) => <span className="mono small">{formatNumber(users.filter((u) => u.role === r.name).length)}</span> },
    { key: 'dateCreated', header: 'Date created', fw: 8, cell: (r) => <span className="small">{formatDate(r.dateCreated)}</span> },
  ];

  const groupColumns = [
    { key: 'name', header: 'Group', fw: 10, cell: (g) => <span className="small strong">{g.name}</span> },
    { key: 'description', header: 'Description', fw: 18, cell: (g) => <TruncatedText value={g.description} className="small muted" /> },
    { key: 'members', header: 'Members', fw: 6, align: 'right', cell: (g) => <span className="mono small">{users.filter((u) => u.group === g.name).length}</span> },
    {
      key: 'who', header: 'Who', fw: 10,
      cell: (g) => (
        <span className="row row--xtight">
          {users.filter((u) => u.group === g.name).slice(0, 6).map((u) => (
            <Tooltip key={u.id} label={u.name}><span className="avatar avatar--sm avatar--tint">{u.initials}</span></Tooltip>
          ))}
        </span>
      ),
    },
    { key: 'dateCreated', header: 'Date created', fw: 8, cell: (g) => <span className="small">{formatDate(g.dateCreated)}</span> },
  ];

  const skillColumns = [
    { key: 'name', header: 'Skill', fw: 10, cell: (s) => <span className="small strong">{s.name}</span> },
    { key: 'criteria', header: 'Criteria', fw: 12, cell: (s) => <TruncatedText value={s.criteria} className="micro mono subtle" /> },
    { key: 'description', header: 'Description', fw: 18, cell: (s) => <TruncatedText value={s.description} className="small muted" /> },
    { key: 'holders', header: 'Users', fw: 6, align: 'right', cell: (s) => <span className="mono small">{users.filter((u) => u.skills.includes(s.name)).length}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Users"
        description="People, what they can do, and what they are trained on — one page rather than three."
        actions={
          tab === 'management' && subTab === 'users' ? <Button variant="primary" icon="plus" onClick={() => setUserModal(true)}>Create user</Button>
            : tab === 'skills' ? <Button variant="primary" icon="plus" onClick={() => setSkillModal(true)}>Create skill</Button>
              : null
        }
      />

      <div className="stack stack--tight">
        <Card bodyClassName="card__body--flush">
          <div style={{ padding: '0 var(--s-4)' }}>
            <Tabs tabs={TABS.map((t) => ({ ...t, badge: t.value === 'management' ? users.length : t.value === 'skills' ? skills.length : undefined }))} value={tab} onChange={setTab} />
          </div>
          {tab === 'management' && (
            <div style={{ padding: 'var(--s-3) var(--s-4)' }}>
              <SubTabs
                tabs={SUB_TABS.map((t) => ({ ...t, badge: t.value === 'users' ? users.length : t.value === 'roles' ? ROLES.length : GROUPS.length }))}
                value={subTab}
                onChange={setSubTab}
              />
            </div>
          )}
        </Card>

        {tab === 'management' && (
          <Card bodyClassName="card__body--flush">
            {subTab === 'users' && (
              <>
                <Toolbar>
                  <SearchInput value={search} onChange={setSearch} placeholder="Search people…" />
                  <ExportButtons columns={userColumns.filter((c) => c.key !== 'actions')} rows={filteredUsers} name="users" onCopied={(ok) => notify(ok ? 'Copied.' : 'Clipboard blocked.', ok ? 'success' : 'danger')} />
                </Toolbar>
                <DataTable columns={userColumns} rows={filteredUsers} rowKey={(u) => u.id} />
              </>
            )}
            {subTab === 'roles' && <DataTable columns={roleColumns} rows={ROLES} rowKey={(r) => r.id} />}
            {subTab === 'groups' && <DataTable columns={groupColumns} rows={GROUPS} rowKey={(g) => g.id} />}
          </Card>
        )}

        {tab === 'skills' && (
          <Card bodyClassName="card__body--flush">
            <DataTable columns={skillColumns} rows={skills} rowKey={(s) => s.id} />
          </Card>
        )}

        {tab === 'permissions' && <PermissionsForPerspective />}
      </div>

      <UserModal
        open={userModal || Boolean(editingUser)}
        user={editingUser}
        onClose={() => { setUserModal(false); setEditingUser(null); }}
        onSave={(u) => {
          const initials = u.name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
          if (editingUser) {
            setUsers((p) => p.map((row) => (row.id === editingUser.id ? { ...row, ...u, initials } : row)));
            setEditingUser(null);
            notify(`${u.name} updated.`, 'success');
          } else {
            setUsers((p) => [...p, {
              ...u, id: `u${p.length + 1}`, status: 'Active', confirmation: 'Force Change Password',
              lockStatus: 'Unlocked', startDate: new Date().toISOString().slice(0, 10), initials,
            }]);
            setUserModal(false);
            notify(`${u.name} invited.`, 'success');
          }
        }}
      />

      <SkillModal
        open={skillModal}
        onClose={() => setSkillModal(false)}
        onSave={(s) => { setSkills((p) => [...p, { ...s, id: `s${p.length + 1}` }]); setSkillModal(false); notify(`Skill “${s.name}” created.`, 'success'); }}
      />
    </>
  );
}

export default Users;
