import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageHeader, Card, Toolbar, Button, IconButton, Badge, EmptyState } from '@/components/ui/Surface';
import { DataTable, ColumnToggle, ExportButtons } from '@/components/ui/DataTable';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Form';
import { Tooltip, TruncatedText } from '@/components/ui/Overlay';
import Icon from '@/components/ui/Icon';
import { RULES, RULE_GROUPS, RULE_TRIGGERS, historyForRule } from '@/data/rules';
import { CASES } from '@/data/cases';
import { describeCriterion, getRuleAction, matchCases } from '@/domain/criteria';
import { applyDrop, blockFor, displayNumbers, orderedRules, resolveDrop } from '@/utils/reorderRules';
import { useToast } from '@/context/ToastContext';
import { usePerspective } from '@/hooks/usePerspective';
import { formatDateTime, formatNumber } from '@/utils/format';

/**
 * Rule groups.
 *
 * Sub-rules indent with ↳ and take decimal numbering (2.1), and reordering is
 * confined to their parent — dropping a sub-rule among another parent's
 * children is rejected rather than silently re-parenting it. See
 * utils/reorderRules.js.
 */

function GroupModal({ open, onClose, onSave }) {
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState(RULE_TRIGGERS[0]);
  const [description, setDescription] = useState('');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create rule group"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim()} onClick={() => { onSave({ name: name.trim(), triggeredBy: trigger, description: description.trim() }); setName(''); setDescription(''); }}>
            Create group
          </Button>
        </>
      }
    >
      <div className="stack">
        <TextField label="Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 02_Fraud routing" />
        <SelectField label="Triggered by" required value={trigger} onChange={(e) => setTrigger(e.target.value)} options={RULE_TRIGGERS.map((t) => ({ value: t, label: t }))} />
        <TextAreaField label="Description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
    </Modal>
  );
}

function HistoryModal({ rule, onClose }) {
  const entries = useMemo(() => (rule ? historyForRule(rule.id) : []), [rule]);

  return (
    <Modal open={Boolean(rule)} onClose={onClose} title="Rule history" subtitle={rule?.name} size="lg" footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {entries.length ? (
        <div className="timeline">
          {entries.map((e) => (
            <div key={e.id} className="timeline__item">
              <span className="timeline__marker" />
              <div>
                <div className="small strong">{e.type}</div>
                <div className="micro subtle">{e.user} · {formatDateTime(e.timestamp)}</div>
                <div className="small muted">{e.detail}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon="history" title="No recorded changes" hint="This rule has not been edited since it was created." />
      )}
    </Modal>
  );
}

export function RuleGroups() {
  const navigate = useNavigate();
  const location = useLocation();
  const { notify } = useToast();
  const { routes } = usePerspective();

  const [groups, setGroups] = useState(RULE_GROUPS);
  const [rules, setRules] = useState(RULES);
  const [activeId, setActiveId] = useState(RULE_GROUPS[1].id);

  // AddRule hands the finished rule back via navigation state rather than a
  // shared store — simplest thing that works given these are two independent
  // route components. Clear the state immediately after applying it so a
  // back/forward nav or remount doesn't re-apply the same rule twice.
  //
  // The ref guard (not just the state clear) matters: React 18 StrictMode
  // double-invokes effects in dev, so without it this ran twice against the
  // SAME location.state object before the replace-navigation had taken
  // effect, adding the rule twice.
  const appliedStateRef = useRef(null);
  useEffect(() => {
    const incoming = location.state?.rule;
    if (!incoming || appliedStateRef.current === location.state) return;
    appliedStateRef.current = location.state;
    setRules((prev) => (
      location.state.isEdit
        ? prev.map((r) => (r.id === incoming.id ? incoming : r))
        : [...prev, incoming]
    ));
    setActiveId(incoming.groupId);
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);
  const [groupModal, setGroupModal] = useState(false);
  const [historyRule, setHistoryRule] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [hidden, setHidden] = useState(new Set());
  const [draggingId, setDraggingId] = useState(null);

  const group = groups.find((g) => g.id === activeId) ?? groups[0];
  const groupRules = useMemo(() => rules.filter((r) => r.groupId === group.id), [rules, group.id]);
  const ordered = useMemo(() => orderedRules(groupRules), [groupRules]);
  const numbers = useMemo(() => displayNumbers(groupRules), [groupRules]);

  const parentCount = groupRules.filter((r) => !r.parentId).length;
  const subCount = groupRules.length - parentCount;

  /** Live impact: how many real cases each rule's criteria select. */
  const impactOf = (rule) => matchCases(CASES, rule.criteria, 'all').length;

  const toggleRule = (id) => {
    setRules((p) => p.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
    const rule = rules.find((r) => r.id === id);
    notify(`“${rule.name}” ${rule.enabled ? 'disabled' : 'enabled'}.`, 'success');
  };

  const columns = [
    {
      key: 'sortOrder', header: 'Sort order', fw: 6, width: '96px',
      cell: (r) => (
        <span className="row row--xtight row--nowrap">
          <span className="drag-handle"><Icon name="drag" size={12} /></span>
          <span className="mono small">{r.parentId ? '↳ ' : ''}{numbers.get(r.id)}</span>
        </span>
      ),
    },
    {
      key: 'name', header: 'Rule name', fw: 12,
      cell: (r) => <span className="small strong" style={r.parentId ? { paddingLeft: 14, display: 'inline-block' } : undefined}>{r.name}</span>,
    },
    { key: 'description', header: 'Rule description', fw: 14, cell: (r) => <TruncatedText value={r.description} className="small muted" /> },
    {
      key: 'criteria', header: 'Rule criteria', fw: 14,
      cell: (r) => (
        <span className="stack stack--xtight">
          {r.criteria.map((c, i) => <span key={i} className="micro">{describeCriterion(c)}</span>)}
        </span>
      ),
    },
    {
      key: 'actions_col', header: 'Rule actions', fw: 10,
      cell: (r) => (
        <span className="stack stack--xtight">
          {r.actions.map((a, i) => (
            <span key={i} className="micro" style={{ color: 'var(--c-primary)' }}>
              {getRuleAction(a.key)?.label ?? a.key}{a.value ? ` → ${a.value}` : ''}
            </span>
          ))}
        </span>
      ),
    },
    { key: 'impact', header: 'Impact', fw: 6, align: 'right', cell: (r) => <span className="mono small">{formatNumber(impactOf(r))}</span> },
    {
      key: 'enabled', header: 'Active', fw: 5, width: '64px',
      cell: (r) => (
        <input type="checkbox" className="toggle" checked={r.enabled} onChange={() => toggleRule(r.id)} aria-label={`Enable ${r.name}`} />
      ),
    },
    {
      key: 'row_actions', header: 'Actions', fw: 8, width: '116px',
      cell: (r) => (
        <div className="row row--xtight row--nowrap">
          <IconButton icon="history" label="Rule history" size={13} onClick={() => setHistoryRule(r)} />
          <IconButton icon="branch" label="Add sub-rule" size={13} onClick={() => navigate(`${routes.addRule}?parentId=${r.id}&groupId=${r.groupId}`)} />
          <IconButton icon="edit" label="Edit rule" size={13} onClick={() => navigate(`${routes.addRule}?edit=${r.id}`)} />
          <IconButton icon="trash" label="Delete rule" tone="danger" size={13} onClick={() => setConfirmDelete(r)} />
        </div>
      ),
    },
  ];

  const visible = columns.filter((c) => !hidden.has(c.key));

  return (
    <>
      <PageHeader
        title="Rule groups"
        description="Automation that runs at intake, on a schedule and after other rules fire. Groups run in order; every rule inside a group is evaluated."
        actions={<Button variant="primary" icon="plus" onClick={() => navigate(`${routes.addRule}?groupId=${group.id}`)}>Add Rule</Button>}
      />

      <div className="grid" style={{ gridTemplateColumns: 'minmax(230px, 300px) minmax(0, 1fr)', alignItems: 'start' }}>
        <Card title="Groups" action={<Button variant="secondary" size="sm" icon="plus" onClick={() => setGroupModal(true)}>Create</Button>} bodyClassName="card__body--flush">
          <div className="hairlines">
            {groups.map((g) => {
              const count = rules.filter((r) => r.groupId === g.id).length;
              return (
                <div
                  key={g.id}
                  className="row row--between row--nowrap"
                  style={{
                    padding: 'var(--s-2) var(--s-3)',
                    background: g.id === group.id ? 'var(--c-primary-wash)' : 'transparent',
                    cursor: 'pointer',
                  }}
                  onClick={() => setActiveId(g.id)}
                >
                  <span className="stack stack--xtight" style={{ minWidth: 0 }}>
                    <span className="row row--xtight">
                      <span className="small strong truncate">{g.name}</span>
                      {!g.enabled && <Badge tone="muted">Off</Badge>}
                    </span>
                    <span className="micro subtle">{g.triggeredBy} · {count} rules</span>
                  </span>
                  <span className="row row--xtight row--nowrap" onClick={(e) => e.stopPropagation()}>
                    <IconButton
                      icon="power"
                      label={g.enabled ? 'Disable group' : 'Enable group'}
                      size={13}
                      onClick={() => setGroups((p) => p.map((x) => (x.id === g.id ? { ...x, enabled: !x.enabled } : x)))}
                    />
                    <IconButton icon="trash" label="Delete group" tone="danger" size={13} onClick={() => notify('Deleting a group needs the Delete Rule permission.', 'warning')} />
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="stack stack--tight">
          <Card
            title={`Rule creation logic — ${group.name}`}
            action={<Button variant="secondary" size="sm" icon="edit">Edit group</Button>}
          >
            <div className="row" style={{ gap: 'var(--s-6)' }}>
              <div><div className="t-section-label">Triggered by</div><div className="small strong">{group.triggeredBy}</div></div>
              <div><div className="t-section-label">Status</div><Badge tone={group.enabled ? 'success' : 'muted'} dot>{group.enabled ? 'Active' : 'Inactive'}</Badge></div>
              <div><div className="t-section-label">Rules</div><div className="small strong">{parentCount} ({subCount} sub-rules)</div></div>
            </div>
            <p className="small muted" style={{ marginTop: 'var(--s-3)' }}>{group.description}</p>
          </Card>

          <Card bodyClassName="card__body--flush">
            <Toolbar>
              <span className="t-section-label">Rules &amp; execution order</span>
              <div className="row row--tight">
                <ColumnToggle columns={columns} hidden={hidden} onChange={setHidden} />
                <ExportButtons columns={visible} rows={ordered} name={`rules-${group.id}`} onCopied={(ok) => notify(ok ? 'Copied.' : 'Clipboard blocked.', ok ? 'success' : 'danger')} />
                <Button variant="primary" size="sm" icon="plus" onClick={() => navigate(`${routes.addRule}?groupId=${group.id}`)}>Add Rule</Button>
              </div>
            </Toolbar>

            <DataTable
              columns={visible}
              rows={ordered}
              rowKey={(r) => r.id}
              rowDrag={{
                draggingId,
                blockIds: draggingId ? blockFor(groupRules, draggingId) : new Set(),
                onDragStart: setDraggingId,
                resolveDrop: (overId, edge) => resolveDrop(groupRules, draggingId, overId, edge),
                onDrop: (overId, edge) => {
                  setRules((p) => {
                    const updated = applyDrop(groupRules, draggingId, overId, edge);
                    const byId = new Map(updated.map((r) => [r.id, r]));
                    return p.map((r) => byId.get(r.id) ?? r);
                  });
                  setDraggingId(null);
                },
              }}
              empty={<EmptyState icon="rules" title="No rules in this group" hint="Add a rule to start routing cases automatically." />}
            />

            <div className="card__foot">
              <Icon name="info" size={13} className="subtle" />
              <span className="micro subtle">
                Rules run top to bottom. A sub-rule only evaluates when its parent matches, and can be reordered
                within its parent but not moved to another.
              </span>
            </div>
          </Card>
        </div>
      </div>

      <GroupModal
        open={groupModal}
        onClose={() => setGroupModal(false)}
        onSave={(g) => {
          setGroups((p) => [...p, { ...g, id: `rg${p.length + 1}`, enabled: true }]);
          setGroupModal(false);
          notify(`Group “${g.name}” created.`, 'success');
        }}
      />
      <HistoryModal rule={historyRule} onClose={() => setHistoryRule(null)} />
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete rule"
        message={<>Delete <strong>{confirmDelete?.name}</strong>? Any sub-rules beneath it are removed too.</>}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          setRules((p) => p.filter((r) => r.id !== confirmDelete.id && r.parentId !== confirmDelete.id));
          notify(`“${confirmDelete.name}” deleted.`, 'success');
          setConfirmDelete(null);
        }}
      />
    </>
  );
}

export default RuleGroups;
