import { useState } from 'react';
import { Drawer } from '@/components/ui/Overlay';
import { Button } from '@/components/ui/Surface';
import { Modal } from '@/components/ui/Modal';
import { SelectField, TextField } from '@/components/ui/Form';
import Icon from '@/components/ui/Icon';
import brand from '@/brand/brand.config';
import { STATUSES, STATUS_GROUPS } from '@/domain/statuses';
import { CASE_TYPES } from '@/domain/caseTypes';
import { formatNumber } from '@/utils/format';

/**
 * Status and Queue filters, plus the advanced-filters modal.
 *
 * Status and Queue share ONE drawer (CaseFiltersDrawer) rather than two
 * independent popovers — each is its own expandable section, so both can be
 * open at once, and the panel stays put while the table under it scrolls
 * (a popover closes on scroll; a persistent filter panel shouldn't).
 *
 * Counts are computed from the rows actually in scope, so a count always
 * matches how many rows the filter yields.
 */

export const EMPTY_FILTERS = {
  caseType: 'all',
  statuses: [],
  queues: [],
  entity: '',
  network: '',
  reasonCode: '',
  worker: '',
  market: '',
  acquirer: '',
  amountMin: '',
  amountMax: '',
  dueWithin: '',
};

export function countActive(filters) {
  return Object.entries(filters).filter(([k, v]) => {
    if (k === 'caseType') return v !== 'all';
    return Array.isArray(v) ? v.length > 0 : Boolean(v);
  }).length;
}

function FilterList({ groups, selected, onToggle, onAll }) {
  return (
    <>
      <button type="button" className="popover__item" onClick={onAll}>
        <input type="checkbox" className="checkbox" checked={selected.length === 0} readOnly />
        <span className="strong">All</span>
      </button>
      {groups.map((group) => (
        <div key={group.label}>
          <div className="popover__group t-section-label">{group.label}</div>
          {group.options.map((opt) => (
            <button key={opt.value} type="button" className="popover__item" onClick={() => onToggle(opt.value)}>
              <input type="checkbox" className="checkbox" checked={selected.includes(opt.value)} readOnly />
              <span className="truncate">{opt.label}</span>
              <span className="popover__count">{formatNumber(opt.count)}</span>
            </button>
          ))}
        </div>
      ))}
    </>
  );
}

function DrawerSection({ title, open, onToggle, children }) {
  return (
    <div>
      <button type="button" className="accordion__head" onClick={onToggle} aria-expanded={open}>
        {title}
        <Icon name="chevron" size={13} className={`accordion__chevron ${open ? 'is-open' : ''}`.trim()} />
      </button>
      {open && <div className="accordion__panel">{children}</div>}
    </div>
  );
}

/**
 * `onQueueChange` is optional — pages with no queue concept (e.g. the
 * issuer's Chargebacks view) pass only the status props and get a
 * single-section drawer with no Queue button.
 */
export function CaseFiltersDrawer({ rows, statusSelected, onStatusChange, queueSelected, onQueueChange }) {
  const [open, setOpen] = useState(false);
  const showQueue = typeof onQueueChange === 'function';
  const [expanded, setExpanded] = useState(() => (showQueue ? new Set(['status', 'queue']) : new Set(['status'])));

  const totalSelected = statusSelected.length + (showQueue ? queueSelected.length : 0);

  const openAll = () => {
    setOpen(true);
    setExpanded(showQueue ? new Set(['status', 'queue']) : new Set(['status']));
  };
  const toggleSection = (key) => setExpanded((p) => {
    const n = new Set(p);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  });

  const statusGroups = STATUS_GROUPS.map((label) => ({
    label,
    options: STATUSES.filter((s) => s.group === label).map((s) => ({
      value: s.id,
      label: s.label,
      count: rows.filter((r) => r.status === s.id).length,
    })),
  }));
  const toggleStatus = (value) =>
    onStatusChange(statusSelected.includes(value) ? statusSelected.filter((v) => v !== value) : [...statusSelected, value]);

  const queueGroups = [{
    label: 'Queues',
    options: brand.queues.map((q) => ({
      value: q.id,
      label: q.label,
      count: rows.filter((r) => r.queueId === q.id).length,
    })),
  }];
  const toggleQueue = (value) =>
    onQueueChange(queueSelected.includes(value) ? queueSelected.filter((v) => v !== value) : [...queueSelected, value]);

  return (
    <>
      <Button variant="secondary" size="sm" icon="filter" onClick={openAll}>
        Filters{totalSelected > 0 && ` (${totalSelected})`}
      </Button>

      <Drawer open={open} onClose={() => setOpen(false)} title="Filters">
        <DrawerSection title="Status" open={expanded.has('status')} onToggle={() => toggleSection('status')}>
          <FilterList groups={statusGroups} selected={statusSelected} onToggle={toggleStatus} onAll={() => onStatusChange([])} />
        </DrawerSection>
        {showQueue && (
          <DrawerSection title="Queue" open={expanded.has('queue')} onToggle={() => toggleSection('queue')}>
            <FilterList groups={queueGroups} selected={queueSelected} onToggle={toggleQueue} onAll={() => onQueueChange([])} />
          </DrawerSection>
        )}
      </Drawer>
    </>
  );
}

export function AdvancedFiltersModal({ open, onClose, filters, onApply }) {
  const set = (patch) => onApply({ ...filters, ...patch });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Advanced search"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => onApply({ ...EMPTY_FILTERS })}>Reset all</Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onClose}>Apply filters</Button>
        </>
      }
    >
      <div className="grid grid--3">
        <SelectField
          label="Case type"
          value={filters.caseType}
          onChange={(e) => set({ caseType: e.target.value })}
          options={[{ value: 'all', label: 'All case types' }, ...CASE_TYPES.map((t) => ({ value: t.id, label: t.label }))]}
        />
        <SelectField
          label="Entity"
          value={filters.entity}
          onChange={(e) => set({ entity: e.target.value })}
          placeholder="Any entity"
          options={brand.entities.map((e) => ({ value: e.id, label: e.label }))}
        />
        <SelectField
          label="Market"
          value={filters.market}
          onChange={(e) => set({ market: e.target.value })}
          placeholder="Any market"
          options={brand.markets.map((m) => ({ value: m, label: m }))}
        />

        <SelectField
          label="Card scheme"
          value={filters.network}
          onChange={(e) => set({ network: e.target.value })}
          placeholder="Any scheme"
          options={brand.schemes.map((s) => ({ value: s.id, label: s.label }))}
          hint="Chargebacks only"
        />
        <SelectField
          label="Acquirer"
          value={filters.acquirer}
          onChange={(e) => set({ acquirer: e.target.value })}
          placeholder="Any acquirer"
          options={brand.acquirers.map((a) => ({ value: a, label: a }))}
          hint="Chargebacks only"
        />
        <SelectField
          label="Reason code"
          value={filters.reasonCode}
          onChange={(e) => set({ reasonCode: e.target.value })}
          placeholder="Any reason"
          options={[
            ...brand.schemes.flatMap((s) => s.reasonCodes.map((rc) => ({ value: rc.code, label: `${s.short} ${rc.code}` }))),
            ...brand.claimReasons.map((r) => ({ value: r.id, label: r.label })),
          ]}
        />
        <TextField
          label="Assigned to"
          value={filters.worker}
          onChange={(e) => set({ worker: e.target.value })}
          placeholder="Email contains…"
        />

        <TextField label={`Min amount (${brand.currency})`} type="number" min="0" value={filters.amountMin} onChange={(e) => set({ amountMin: e.target.value })} />
        <TextField label={`Max amount (${brand.currency})`} type="number" min="0" value={filters.amountMax} onChange={(e) => set({ amountMax: e.target.value })} />
        <TextField label="Due within (days)" type="number" value={filters.dueWithin} onChange={(e) => set({ dueWithin: e.target.value })} hint="Negative finds overdue cases." />
      </div>

      <p className="micro subtle row row--xtight" style={{ marginTop: 'var(--s-4)' }}>
        <Icon name="info" size={12} />
        Scheme and reason-code filters only narrow chargebacks — claims carry no card leg.
      </p>
    </Modal>
  );
}

/** The predicate every case view shares. */
export function applyFilters(rows, filters, search) {
  const q = search.trim().toLowerCase();

  return rows.filter((r) => {
    if (filters.caseType !== 'all' && r.caseType !== filters.caseType) return false;
    if (filters.statuses.length && !filters.statuses.includes(r.status)) return false;
    if (filters.queues.length && !filters.queues.includes(r.queueId)) return false;
    if (filters.entity && r.entityId !== filters.entity) return false;
    if (filters.market && r.market !== filters.market) return false;
    if (filters.network && r.network !== filters.network) return false;
    if (filters.acquirer && r.acquirer !== filters.acquirer) return false;
    if (filters.reasonCode && r.reasonCode !== filters.reasonCode) return false;
    if (filters.worker && !r.worker.toLowerCase().includes(filters.worker.toLowerCase())) return false;
    if (filters.amountMin && r.disputeAmount < Number(filters.amountMin)) return false;
    if (filters.amountMax && r.disputeAmount > Number(filters.amountMax)) return false;

    if (filters.dueWithin !== '') {
      const days = Math.floor((new Date(r.dueDate).getTime() - Date.now()) / 86_400_000);
      if (days > Number(filters.dueWithin)) return false;
    }

    if (!q) return true;
    return [r.id, r.arn, r.orderId, r.itemTitle, r.buyer, r.seller, r.cardholder, r.reasonCode, r.reasonLabel, r.worker, r.merchantRef]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });
}
