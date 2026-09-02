import { useEffect, useState } from 'react';
import { Button, Badge } from '@/components/ui/Surface';
import { CheckboxRow, RadioRow, TextField } from '@/components/ui/Form';
import { useToast } from '@/context/ToastContext';
import useIndemnification from '@/hooks/useIndemnification';
import { BASES, annualCharge, applyIndemnification, settingsFor } from '@/data/indemnification';
import { formatCompactCurrency, formatCurrency } from '@/utils/format';

/**
 * Liability & indemnification.
 *
 * Named to stay clear of Alert settings' "Service level", which is the network
 * alert tier (Self Service / Full Service) and an unrelated setting. Two
 * different things sharing a heading is how an operator changes the wrong one.
 *
 * The acquirer takes on liability for this merchant's chargebacks in exchange
 * for a charge, priced either as a flat fee per dispute or in basis points of
 * processed volume.
 *
 * The form edits a DRAFT and commits on Apply. Nothing here writes as you type:
 * a half-entered rate is a real commercial term, and a control that took effect
 * mid-keystroke would mean 4 bps was briefly live on the way to 45. Apply stays
 * disabled until the draft actually differs from what is stored, so the button
 * never confirms a change it did not make.
 */
export function IndemnificationPanel({ merchant }) {
  const { notify } = useToast();
  const all = useIndemnification();
  const saved = settingsFor(merchant?.id);

  const [draft, setDraft] = useState(saved);

  // Re-seed when the panel is opened on a different merchant, or when the
  // stored value changes underneath us.
  useEffect(() => { setDraft(settingsFor(merchant?.id)); }, [merchant?.id, all]);

  if (!merchant) return null;

  const dirty =
    draft.enabled !== saved.enabled
    || draft.basis !== saved.basis
    || Number(draft.fee) !== Number(saved.fee)
    || Number(draft.bps) !== Number(saved.bps);

  const rateInvalid =
    draft.enabled
    && (draft.basis === 'bps'
      ? !(Number(draft.bps) > 0 && Number(draft.bps) <= 1000)
      : !(Number(draft.fee) > 0));

  const projected = annualCharge(merchant, draft);

  const apply = () => {
    applyIndemnification(merchant.id, draft);
    notify(
      draft.enabled
        ? `Indemnification applied to ${merchant.name} — ${draft.basis === 'bps' ? `${draft.bps} bps of volume` : `${formatCurrency(draft.fee)} per dispute`}.`
        : `Indemnification removed from ${merchant.name}.`,
      'success',
    );
  };

  return (
    <div className="stack stack--tight indemnity">
      <div className="row row--between row--nowrap">
        <span className="row row--xtight">
          <span className="small strong">Liability &amp; indemnification</span>
          <Badge tone={saved.enabled ? 'success' : 'neutral'} dot>
            {saved.enabled ? 'Indemnified' : 'Not indemnified'}
          </Badge>
        </span>
      </div>

      <CheckboxRow
        label="Indemnify this merchant"
        description={`${merchant.name} is not liable for chargebacks covered by this arrangement — the loss sits with us.`}
        checked={draft.enabled}
        onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
      />

      {/* Pricing is only meaningful once the arrangement exists. */}
      <fieldset className="indemnity__pricing" disabled={!draft.enabled}>
        <legend className="micro subtle">Charge basis</legend>

        <div className="stack stack--xtight">
          {BASES.map((b) => (
            <RadioRow
              key={b.id}
              name={`indemnity-basis-${merchant.id}`}
              label={b.label}
              description={b.hint}
              value={b.id}
              checked={draft.basis === b.id}
              onChange={() => setDraft((d) => ({ ...d, basis: b.id }))}
            />
          ))}
        </div>

        <div className="indemnity__rate">
          {draft.basis === 'bps' ? (
            <TextField
              label="Rate"
              type="number"
              min="1"
              max="1000"
              step="1"
              value={draft.bps}
              onChange={(e) => setDraft((d) => ({ ...d, bps: e.target.value }))}
              hint="Basis points of processed volume. 100 bps = 1%."
              error={draft.enabled && !(Number(draft.bps) > 0 && Number(draft.bps) <= 1000) ? 'Enter 1–1000 bps.' : undefined}
            />
          ) : (
            <TextField
              label="Fee"
              type="number"
              min="0"
              step="0.01"
              value={draft.fee}
              onChange={(e) => setDraft((d) => ({ ...d, fee: e.target.value }))}
              hint="Charged per dispute."
              error={draft.enabled && !(Number(draft.fee) > 0) ? 'Enter an amount above zero.' : undefined}
            />
          )}

          {/* The two bases price completely differently for the same merchant —
              one scales with disputes, the other with turnover — so the effect
              of the choice is shown rather than left to be worked out. */}
          <div className="detail-row">
            <span className="detail-row__k">Projected annual charge</span>
            <span className="detail-row__v mono">
              {draft.enabled && !rateInvalid ? formatCompactCurrency(projected) : '—'}
            </span>
          </div>
          <p className="micro subtle">
            {draft.basis === 'bps'
              ? `${draft.bps || 0} bps of ${formatCompactCurrency(merchant.projectedVolume ?? 0)} projected volume.`
              : `${formatCurrency(Number(draft.fee) || 0)} across ${merchant.disputeVolume ?? 0} disputes.`}
          </p>
        </div>
      </fieldset>

      <div className="row row--tight">
        <Button variant="primary" onClick={apply} disabled={!dirty || rateInvalid}>Apply</Button>
        {dirty && <Button variant="secondary" onClick={() => setDraft(saved)}>Discard changes</Button>}
      </div>
    </div>
  );
}

export default IndemnificationPanel;
