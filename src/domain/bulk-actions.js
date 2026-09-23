/**
 * BULK ACTIONS
 * ============
 * What you can do to a selection of merchants in one move.
 *
 * Revenue rules could previously only set a price, which meant "take bulk
 * actions in one place" was half true — anything that was not indemnification
 * still sent you around the site. Each action here writes to a real store and
 * is visible afterwards in the place you would go looking for it, because an
 * action that fires a toast and changes nothing is worse than no action.
 *
 * `config` shape is the action's own business. `describe` is what the
 * confirmation dialog says out loud before anything is written, so a reader
 * always sees the sentence, not just the button.
 */

import { applyIndemnification } from '@/data/indemnification';
import { setFlagsBulk } from '@/data/merchant-flags';
import { raiseNotification } from '@/data/notifications-store';
import { downloadCsv } from '@/utils/export';
import { formatCompactCurrency, formatCurrency, formatNumber } from '@/utils/format';

export const BULK_ACTIONS = [
  {
    id: 'indemnify',
    label: 'Set indemnification',
    hint: 'Take on their chargeback liability at a price.',
    icon: 'shield',
    /** Only this one prices, so only this one shows the revenue columns. */
    priced: true,
    verb: 'Indemnify',
    describe: (count, config) => `Indemnification will be switched on for ${formatNumber(count)} merchant${count === 1 ? '' : 's'} at ${
      config.basis === 'bps' ? `${config.bps} bps of processed volume` : `${formatCurrency(config.fee)} per transaction`
    }.`,
    run: (merchants, config) => {
      merchants.forEach((m) => applyIndemnification(m.id, { enabled: true, ...config }));
      return `Indemnification applied to ${formatNumber(merchants.length)} merchant${merchants.length === 1 ? '' : 's'}.`;
    },
  },
  {
    id: 'review',
    label: 'Flag for risk review',
    hint: 'Queue them for the underwriting team.',
    icon: 'searchCheck',
    verb: 'Flag',
    describe: (count) => `${formatNumber(count)} merchant${count === 1 ? '' : 's'} will be flagged for risk review and will show a review marker in Portfolio.`,
    run: (merchants, config) => {
      setFlagsBulk(merchants.map((m) => m.id), { review: true, note: config?.note || 'Flagged from Revenue rules.' });
      return `${formatNumber(merchants.length)} merchant${merchants.length === 1 ? '' : 's'} flagged for review.`;
    },
  },
  {
    id: 'watchlist',
    label: 'Add to watchlist',
    hint: 'Keep them in view without changing anything.',
    icon: 'eye',
    verb: 'Watch',
    describe: (count) => `${formatNumber(count)} merchant${count === 1 ? '' : 's'} will be added to the watchlist. Nothing about their arrangement changes.`,
    run: (merchants) => {
      setFlagsBulk(merchants.map((m) => m.id), { watchlist: true });
      return `${formatNumber(merchants.length)} merchant${merchants.length === 1 ? '' : 's'} added to the watchlist.`;
    },
  },
  {
    id: 'assign',
    label: 'Assign an owner',
    hint: 'Give the accounts to one person.',
    icon: 'user',
    needsOwner: true,
    verb: 'Assign',
    describe: (count, config) => `${formatNumber(count)} merchant${count === 1 ? '' : 's'} will be assigned to ${config.owner || 'nobody yet — pick an owner'}.`,
    run: (merchants, config) => {
      setFlagsBulk(merchants.map((m) => m.id), { owner: config.owner ?? null });
      return `${formatNumber(merchants.length)} merchant${merchants.length === 1 ? '' : 's'} assigned to ${config.owner}.`;
    },
  },
  {
    id: 'alert',
    label: 'Alert me',
    hint: 'Raise a notification when a merchant matches.',
    icon: 'bell',
    verb: 'Alert on',
    describe: (count) => `A notification will be raised for ${formatNumber(count)} merchant${count === 1 ? '' : 's'} that match right now. Leave the rule standing and you will be told about anything that matches later, wherever you are in the console.`,
    run: (merchants, config) => {
      const raised = merchants.filter((m) => raiseNotification({
        title: config?.ruleName ? `${config.ruleName}` : 'Merchants matched your rule',
        detail: `${m.name} — ${(m.chargebackRatio ?? 0).toFixed(2)}% chargeback ratio, ${formatCompactCurrency(m.projectedVolume ?? 0)} annual volume.`,
        /* One alert per merchant per rule. Without this the rule would shout
           again on every page load, which is how people learn to ignore a
           bell. */
        alertKey: `${config?.ruleId ?? 'once'}:${m.id}`,
      })).length;

      return raised
        ? `${formatNumber(raised)} alert${raised === 1 ? '' : 's'} raised — check the bell.`
        : 'Already alerted on all of these.';
    },
  },
  {
    id: 'export',
    label: 'Export the list',
    hint: 'Download the selection as a spreadsheet.',
    icon: 'download',
    /** Writes nothing, so it needs no confirmation and no standing form. */
    readOnly: true,
    verb: 'Export',
    describe: (count) => `${formatNumber(count)} merchant${count === 1 ? '' : 's'} will be downloaded as a CSV. Nothing is changed.`,
    run: (merchants) => {
      downloadCsv(
        [
          { key: 'name', header: 'Merchant' },
          { key: 'groupLabel', header: 'Group' },
          { key: 'riskTier', header: 'Risk tier' },
          { key: 'status', header: 'Status' },
          { key: 'projectedVolume', header: 'Annual volume' },
          { key: 'chargebackRatio', header: 'Chargeback ratio %' },
          { key: 'exposure', header: 'Open exposure' },
        ],
        merchants,
        'revenue-rules-selection',
      );
      return `Exported ${formatNumber(merchants.length)} merchant${merchants.length === 1 ? '' : 's'}.`;
    },
  },
];

export const bulkActionFor = (id) => BULK_ACTIONS.find((a) => a.id === id);

/**
 * How far a standing rule has drifted from the portfolio.
 *
 * A policy is judged on the gap between what it says and what is true, so a
 * standing rule reports the merchants that qualify today but do not yet match
 * what it would do. That is the only number that makes a rule worth leaving
 * switched on.
 */
export function ruleDrift(rule, merchants, { settingsFor, flagsFor, alreadyAlerted = () => true }) {
  const conforms = (m) => {
    if (rule.action === 'indemnify') {
      const s = settingsFor(m.id);
      return s.enabled
        && s.basis === rule.config.basis
        && (rule.config.basis === 'bps' ? Number(s.bps) === Number(rule.config.bps) : Number(s.fee) === Number(rule.config.fee));
    }
    if (rule.action === 'review') return flagsFor(m.id).review === true;
    if (rule.action === 'watchlist') return flagsFor(m.id).watchlist === true;
    if (rule.action === 'assign') return flagsFor(m.id).owner === rule.config.owner;
    if (rule.action === 'alert') return alreadyAlerted(rule.id, m.id);
    return true; // export has nothing to conform to
  };

  const pending = merchants.filter((m) => !conforms(m));
  return {
    qualifying: merchants.length,
    pending,
    conforming: merchants.length - pending.length,
    volume: pending.reduce((s, m) => s + (m.projectedVolume ?? 0), 0),
    summary: pending.length === 0
      ? 'Everything that qualifies already matches.'
      : `${formatNumber(pending.length)} of ${formatNumber(merchants.length)} qualifying merchants do not match yet — ${formatCompactCurrency(pending.reduce((s, m) => s + (m.projectedVolume ?? 0), 0))} of volume.`,
  };
}
