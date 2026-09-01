import { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { Badge, Button } from '@/components/ui/Surface';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Form';
import { Tooltip } from '@/components/ui/Overlay';
import { useBrand } from '@/brand/BrandProvider';
import { RESOLUTIONS } from '@/domain/statuses';
import { blockedActions, ENTITY_TEMPLATES, INTERMEMBER_MESSAGES, REPRESENTMENT_REASONS, WRITE_OFF_REASONS } from '@/data/work-case';
import { allReasonCodes } from '@/brand/brand.config';
import { formatCurrency } from '@/utils/format';

/**
 * Actions card — a handful of square tiles, each replacing the card with its
 * form. The tile SET is role-scoped (RESOLUTIONS is the merchant's; acquirer
 * and issuer get their own, defined below) — same case, three different
 * things a party to it can actually do next.
 *
 * GATING IS THE POINT, for the merchant role. A blocking special instruction
 * disables the matching tile and explains why on hover — a card that says "do
 * not write off" next to an enabled Write Off button is theatre. Both read
 * from the same source in data/work-case. Acquirer/issuer actions aren't
 * gated by those merchant-authored instructions (none of them name an
 * acquirer or issuer action id), which is correct: the instruction "do not
 * write off" has nothing to say about "forward to merchant".
 */

const FORWARD_REASONS = ['Needs merchant evidence', 'Beyond acquirer authority', 'Merchant decision required', 'Duplicate of an existing case'];
const ROUTE_TARGETS = ['Merchant for decision', 'Senior risk review', 'Card network arbitration'];
const DOC_REQUEST_TOPICS = ['Proof of purchase', 'Proof of delivery / fulfilment', 'Cardholder statement', 'Additional transaction detail'];
const CLOSE_OUTCOMES = ['Resolved in cardholder favor', 'Resolved in merchant favor', 'Withdrawn by cardholder'];

export const ACQUIRER_RESOLUTIONS = [
  { id: 'forward_merchant', label: 'Forward to Merchant', icon: 'send', description: 'Pass the case to the merchant for their decision.' },
  { id: 'build_packet', label: 'Build Representment Packet', icon: 'layers', description: 'Assemble the evidence package on the merchant’s behalf.' },
  { id: 'route_decision', label: 'Route Decision', icon: 'route', description: 'Send this case to a specific queue for a decision.' },
];

export const ISSUER_RESOLUTIONS = [
  { id: 'raise_chargeback', label: 'Raise Chargeback', icon: 'shield', description: 'File a chargeback on the cardholder’s behalf.' },
  { id: 'request_docs', label: 'Request Cardholder Documents', icon: 'message', description: 'Ask the cardholder for more information before deciding.' },
  { id: 'close_claim', label: 'Close Claim', icon: 'check', description: 'Record the final outcome and close the case.' },
];

/** Which tile set and which blocking rules apply, by perspective. */
export function resolutionsFor(perspective) {
  if (perspective === 'acquirer') return ACQUIRER_RESOLUTIONS;
  if (perspective === 'issuer') return ISSUER_RESOLUTIONS;
  return RESOLUTIONS;
}

function Field({ label, required, children, span }) {
  return (
    <div className="field" style={span ? { gridColumn: '1 / -1' } : undefined}>
      <span className="field__label">{label}{required && <span className="field__req">*</span>}</span>
      {children}
    </div>
  );
}

function RepresentmentForm({ c, onSubmit }) {
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('full');
  const [amount, setAmount] = useState(String(c.disputeAmount));

  const valid = reason && message.trim() && Number(amount) > 0;

  return (
    <div className="stack stack--tight">
      <SelectField label="Representment Reason" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Select a reason…" options={REPRESENTMENT_REASONS.map((r) => ({ value: r, label: r }))} />
      <SelectField label="Intermember Message" required value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Select a message…" options={INTERMEMBER_MESSAGES.map((m) => ({ value: m, label: m }))} />

      <button type="button" className="accordion__head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        Payment Brand / Scheme Questionnaire
        <Icon name="chevron" size={13} className={`accordion__chevron ${open ? 'is-open' : ''}`.trim()} />
      </button>

      {open && (
        <div className="stack stack--tight" style={{ padding: '0 0 var(--s-2)' }}>
          <span className="t-section-label">Second presentment information</span>
          <Field label="Chargeback amount" required>
            <div className="row row--xtight row--nowrap">
              <span className="micro subtle mono">{c.currency}</span>
              <input className="input" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={mode === 'full'} />
            </div>
          </Field>
          <div className="seg">
            <button type="button" className={`seg__btn ${mode === 'full' ? 'is-active' : ''}`.trim()} onClick={() => { setMode('full'); setAmount(String(c.disputeAmount)); }}>Full</button>
            <button type="button" className={`seg__btn ${mode === 'partial' ? 'is-active' : ''}`.trim()} onClick={() => setMode('partial')}>Partial</button>
          </div>
          <span className="micro subtle">Case amount is {formatCurrency(c.disputeAmount, c.currency)}.</span>
        </div>
      )}

      <Button variant="primary" block disabled={!valid} onClick={() => onSubmit('representment', `Representment submitted for ${formatCurrency(Number(amount), c.currency)}.`)}>
        Submit Dispute
      </Button>
    </div>
  );
}

function WriteOffForm({ c, onSubmit }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const valid = reason && note.trim();

  return (
    <div className="stack stack--tight">
      <SelectField label="Accept Liability Reason" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Select a reason…" options={WRITE_OFF_REASONS.map((r) => ({ value: r, label: r }))} />
      <TextAreaField label="Accept Liability Note" required rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Explain the liability decision…" />
      <Button variant="primary" block disabled={!valid} onClick={() => onSubmit('write_off', `Liability accepted — ${formatCurrency(c.disputeAmount, c.currency)}.`)}>
        Accept Liability
      </Button>
    </div>
  );
}

function ChargeEntityForm({ onSubmit }) {
  const [template, setTemplate] = useState('');
  const [enclosure, setEnclosure] = useState(false);
  const [touched, setTouched] = useState(false);

  return (
    <div className="stack stack--tight">
      <SelectField
        label="Template"
        required
        value={template}
        onChange={(e) => { setTemplate(e.target.value); setTouched(true); }}
        onBlur={() => setTouched(true)}
        placeholder="Select a template…"
        options={ENTITY_TEMPLATES.map((t) => ({ value: t, label: t }))}
        error={touched && !template ? 'A template is required.' : undefined}
      />
      <label className="row row--xtight" style={{ cursor: 'pointer' }}>
        <input type="checkbox" className="checkbox" checked={enclosure} onChange={(e) => setEnclosure(e.target.checked)} />
        <span className="small">Show Enclosure</span>
      </label>
      <Button variant="primary" block disabled={!template} onClick={() => onSubmit('charge_entity', 'Charged to entity.')}>
        Submit Dispute
      </Button>
    </div>
  );
}

/**
 * Split case. The three parts must sum to the case amount; the remainder is
 * shown live and Submit stays disabled until it is zero.
 */
function SplitCaseForm({ c, onSubmit }) {
  const [entity, setEntity] = useState('');
  const [writeOff, setWriteOff] = useState('');
  const [defense, setDefense] = useState('');

  const sum = (Number(entity) || 0) + (Number(writeOff) || 0) + (Number(defense) || 0);
  const remainder = Math.round((c.disputeAmount - sum) * 100) / 100;
  const balanced = Math.abs(remainder) < 0.005 && sum > 0;

  const money = (label, value, onChange) => (
    <Field label={label} required>
      <div className="row row--xtight row--nowrap">
        <span className="micro subtle mono">{c.currency}</span>
        <input className="input" type="number" min="0" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0.00" />
      </div>
    </Field>
  );

  return (
    <div className="stack stack--tight">
      <div className="row row--between small">
        <span className="muted">Case amount</span>
        <span className="mono strong">{formatCurrency(c.disputeAmount, c.currency)}</span>
      </div>

      {money('Charge to Entity', entity, setEntity)}
      {money('Accept Liability', writeOff, setWriteOff)}
      {money('Representment-Defense', defense, setDefense)}

      <div
        className="row row--between small"
        style={{
          padding: 'var(--s-2)',
          borderRadius: 'var(--r-md)',
          background: balanced ? 'var(--c-success-tint)' : 'var(--c-warning-tint)',
          color: balanced ? 'var(--c-success)' : 'var(--c-warning)',
        }}
      >
        <span className="strong">{balanced ? 'Balanced' : 'Remaining to allocate'}</span>
        <span className="mono strong">{formatCurrency(remainder, c.currency)}</span>
      </div>

      <Button variant="primary" block disabled={!balanced} onClick={() => onSubmit('split_case', 'Case split and submitted.')}>
        Submit Dispute
      </Button>
    </div>
  );
}

/* ---------- Acquirer forms ---------- */

function ForwardMerchantForm({ onSubmit }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const valid = reason && note.trim();

  return (
    <div className="stack stack--tight">
      <SelectField label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Select a reason…" options={FORWARD_REASONS.map((r) => ({ value: r, label: r }))} />
      <TextAreaField label="Note to merchant" required rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What the merchant needs to know…" />
      <Button variant="primary" block disabled={!valid} onClick={() => onSubmit('forward_merchant', 'Case forwarded to the merchant.')}>
        Forward case
      </Button>
    </div>
  );
}

function BuildPacketForm({ onSubmit }) {
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const valid = reason && message;

  return (
    <div className="stack stack--tight">
      <SelectField label="Representment Reason" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Select a reason…" options={REPRESENTMENT_REASONS.map((r) => ({ value: r, label: r }))} />
      <SelectField label="Intermember Message" required value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Select a message…" options={INTERMEMBER_MESSAGES.map((m) => ({ value: m, label: m }))} />
      <Button variant="primary" block disabled={!valid} onClick={() => onSubmit('build_packet', 'Representment packet assembled and queued for the merchant to review.')}>
        Build packet
      </Button>
    </div>
  );
}

function RouteDecisionForm({ onSubmit }) {
  const [target, setTarget] = useState('');
  const [note, setNote] = useState('');

  return (
    <div className="stack stack--tight">
      <SelectField label="Route to" required value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Select a destination…" options={ROUTE_TARGETS.map((t) => ({ value: t, label: t }))} />
      <TextAreaField label="Note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional context for the next reviewer…" />
      <Button variant="primary" block disabled={!target} onClick={() => onSubmit('route_decision', `Routed to ${target}.`)}>
        Route case
      </Button>
    </div>
  );
}

/* ---------- Issuer forms ---------- */

function RaiseChargebackForm({ c, onSubmit }) {
  const codes = useMemo(() => allReasonCodes().filter((rc) => rc.schemeId === c.network), [c.network]);
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const valid = code && note.trim();

  return (
    <div className="stack stack--tight">
      <SelectField
        label="Reason code"
        required
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Select a reason code…"
        options={codes.map((rc) => ({ value: rc.code, label: `${rc.code} — ${rc.label}` }))}
      />
      <TextAreaField label="Cardholder statement" required rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What the cardholder told you…" />
      <Button variant="primary" block disabled={!valid} onClick={() => onSubmit('raise_chargeback', `Chargeback raised — reason ${code}.`)}>
        Raise chargeback
      </Button>
    </div>
  );
}

function RequestDocsForm({ onSubmit }) {
  const [topics, setTopics] = useState([]);
  const toggle = (t) => setTopics((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  return (
    <div className="stack stack--tight">
      <div className="field">
        <span className="field__label">What to request</span>
        <div className="stack stack--xtight">
          {DOC_REQUEST_TOPICS.map((t) => (
            <label key={t} className="row row--xtight" style={{ cursor: 'pointer' }}>
              <input type="checkbox" className="checkbox" checked={topics.includes(t)} onChange={() => toggle(t)} />
              <span className="small">{t}</span>
            </label>
          ))}
        </div>
      </div>
      <Button variant="primary" block disabled={topics.length === 0} onClick={() => onSubmit('request_docs', `Requested from cardholder: ${topics.join(', ')}.`)}>
        Send request
      </Button>
    </div>
  );
}

function CloseClaimForm({ c, onSubmit }) {
  const [outcome, setOutcome] = useState('');
  const [note, setNote] = useState('');
  const valid = outcome && note.trim();

  return (
    <div className="stack stack--tight">
      <SelectField label="Outcome" required value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Select an outcome…" options={CLOSE_OUTCOMES.map((o) => ({ value: o, label: o }))} />
      <TextAreaField label="Closing note" required rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Summarise the decision…" />
      <Button variant="primary" block disabled={!valid} onClick={() => onSubmit('close_claim', `Claim closed — ${formatCurrency(c.disputeAmount, c.currency)} — ${outcome}.`)}>
        Close claim
      </Button>
    </div>
  );
}

export function ActionsCard({ c, onSubmit, perspective = 'merchant' }) {
  const brand = useBrand();
  const [active, setActive] = useState(null);
  const resolutions = useMemo(() => resolutionsFor(perspective), [perspective]);
  // Merchant special instructions only ever name merchant action ids, so this
  // is naturally a no-op for the other two perspectives.
  const blocked = useMemo(() => (perspective === 'merchant' ? blockedActions(c.id) : new Map()), [c.id, perspective]);

  if (active) {
    const spec = resolutions.find((r) => r.id === active);
    return (
      <div className="stack stack--tight">
        <div className="row row--tight">
          <button type="button" className="icon-btn" onClick={() => setActive(null)} aria-label="Back to actions">
            <Icon name="arrowLeft" size={15} />
          </button>
          <span className="small strong">{spec.label}</span>
        </div>

        {active === 'representment' && <RepresentmentForm c={c} onSubmit={onSubmit} />}
        {active === 'write_off' && <WriteOffForm c={c} onSubmit={onSubmit} />}
        {active === 'charge_entity' && <ChargeEntityForm onSubmit={onSubmit} />}
        {active === 'split_case' && <SplitCaseForm c={c} onSubmit={onSubmit} />}

        {active === 'forward_merchant' && <ForwardMerchantForm onSubmit={onSubmit} />}
        {active === 'build_packet' && <BuildPacketForm onSubmit={onSubmit} />}
        {active === 'route_decision' && <RouteDecisionForm onSubmit={onSubmit} />}

        {active === 'raise_chargeback' && <RaiseChargebackForm c={c} onSubmit={onSubmit} />}
        {active === 'request_docs' && <RequestDocsForm onSubmit={onSubmit} />}
        {active === 'close_claim' && <CloseClaimForm c={c} onSubmit={onSubmit} />}
      </div>
    );
  }

  return (
    <div className="stack stack--tight">
      <div className="action-tiles">
        {resolutions.map((r) => {
          const block = blocked.get(r.id);
          const tile = (
            <button
              key={r.id}
              type="button"
              className="action-tile"
              disabled={Boolean(block)}
              onClick={() => setActive(r.id)}
            >
              <Icon name={r.icon} size={14} className="action-tile__icon" />
              {r.label}
              {block && <Icon name="lock" size={11} className="subtle" />}
            </button>
          );

          return block ? (
            <Tooltip
              key={r.id}
              label={<><span className="tooltip__title">{block.title}</span>{block.text}</>}
              wide
            >
              {tile}
            </Tooltip>
          ) : tile;
        })}
      </div>

      {blocked.size > 0 && (
        <p className="micro subtle row row--xtight">
          <Icon name="info" size={11} />
          {blocked.size === 1 ? 'One action is' : `${blocked.size} actions are`} blocked by a special instruction.
        </p>
      )}

      <p className="micro subtle">
        Case amount {formatCurrency(c.disputeAmount, c.currency)} · {brand.terms.entity} {c.entityLabel}
      </p>
    </div>
  );
}

export default ActionsCard;
