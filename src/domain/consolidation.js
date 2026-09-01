/**
 * CONSOLIDATION
 * =============
 * Groups cases that belong together operationally, so an analyst decides once
 * instead of N times — and, in one specific case, so the same money is not paid
 * out twice.
 *
 * Three linking rules, configured in brand.config:
 *   same card    min 2, 90-day window
 *   same order   min 2, 120-day window
 *   same seller  min 3, 30-day window, open only
 *
 * WHY THE THRESHOLDS DIFFER. Two disputes on one card is already worth
 * surfacing. Two against one seller is just a seller with volume — hence three,
 * a tight window and an open-only filter. Tuned loosely this flagged 60% of the
 * book, then 28%; at that rate analysts learn to ignore the flag entirely.
 *
 * WHAT COUNTS AS A DOUBLE REFUND. Only a SHARED ORDER can actually be paid
 * twice. A seller group that happens to contain a chargeback and a claim across
 * two different orders is two separate losses — real, but not a double-dip, and
 * labelling it as one would be wrong.
 */

import brand from '@/brand/brand.config';
import { isClosed } from '@/domain/statuses';

const DAY = 86_400_000;

const KEY_BUILDERS = {
  same_card: (c) => (c.caseType === 'chargeback' && c.ccBin ? `${c.ccBin}:${c.ccLast4}` : null),
  same_order: (c) => c.orderId ?? null,
  same_seller: (c) => c.sellerId ?? null,
};

const LABEL_BUILDERS = {
  same_card: (cases) => `Card •••• ${cases[0].ccLast4}`,
  same_order: (cases) => `Order ${cases[0].orderId}`,
  same_seller: (cases) => `Seller ${cases[0].seller}`,
};

/**
 * Largest run of cases whose dates all fall inside `windowDays`.
 * A plain min/max span check would reject a genuine cluster because one stale
 * case shares the key, so this slides a window and keeps the best run.
 */
function largestClusterWithin(cases, windowDays) {
  if (windowDays == null) return cases;

  const sorted = [...cases].sort((a, b) => new Date(a.dateCreated) - new Date(b.dateCreated));
  const windowMs = windowDays * DAY;

  let best = [];
  let start = 0;

  for (let end = 0; end < sorted.length; end += 1) {
    while (new Date(sorted[end].dateCreated) - new Date(sorted[start].dateCreated) > windowMs) start += 1;
    const run = sorted.slice(start, end + 1);
    if (run.length > best.length) best = run;
  }
  return best;
}

export function buildConsolidationGroups(cases, config = brand.consolidation) {
  const groups = [];

  config.rules.forEach((rule) => {
    const buildKey = KEY_BUILDERS[rule.id];
    if (!buildKey) return;

    const eligible = cases.filter((c) => {
      if (rule.openOnly && isClosed(c.status)) return false;
      return buildKey(c) != null;
    });

    const buckets = new Map();
    eligible.forEach((c) => {
      const key = buildKey(c);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(c);
    });

    buckets.forEach((bucket, key) => {
      if (bucket.length < rule.minSize) return;

      const cluster = largestClusterWithin(bucket, rule.windowDays);
      if (cluster.length < rule.minSize) return;

      const caseTypes = new Set(cluster.map((c) => c.caseType));
      const totalExposure = cluster.reduce((sum, c) => sum + (c.disputeAmount ?? 0), 0);

      groups.push({
        id: `${rule.id}:${key}`,
        ruleId: rule.id,
        ruleLabel: rule.label,
        ruleDescription: rule.description,
        key,
        label: LABEL_BUILDERS[rule.id]?.(cluster) ?? key,
        size: cluster.length,
        caseIds: cluster.map((c) => c.id),
        cases: cluster,
        totalExposure: Math.round(totalExposure * 100) / 100,
        currency: cluster[0].currency,
        crossChannel: caseTypes.size > 1,
        /**
         * Only a shared ORDER can be refunded twice. A cross-channel seller
         * group is two distinct losses, not a double-dip.
         */
        duplicateRefundRisk: caseTypes.size > 1 && rule.id === 'same_order',
        openCount: cluster.filter((c) => !isClosed(c.status)).length,
        windowDays: rule.windowDays,
      });
    });
  });

  return groups.sort((a, b) => b.totalExposure - a.totalExposure);
}

export function indexGroupsByCase(groups) {
  const index = new Map();
  groups.forEach((group) => {
    group.caseIds.forEach((caseId) => {
      if (!index.has(caseId)) index.set(caseId, []);
      index.get(caseId).push(group);
    });
  });
  return index;
}

/** `flaggedRate` is the number to watch — drift above ~15% and retune. */
export function consolidationStats(cases, groups) {
  const flagged = new Set(groups.flatMap((g) => g.caseIds));
  const duplicateRisk = groups.filter((g) => g.duplicateRefundRisk);

  return {
    groupCount: groups.length,
    flaggedCases: flagged.size,
    flaggedRate: cases.length ? (flagged.size / cases.length) * 100 : 0,
    crossChannelGroups: groups.filter((g) => g.crossChannel).length,
    duplicateRiskGroups: duplicateRisk.length,
    totalExposure: Math.round(groups.reduce((s, g) => s + g.totalExposure, 0) * 100) / 100,
    duplicateRefundExposure:
      Math.round(duplicateRisk.reduce((s, g) => s + g.totalExposure - (g.cases[0]?.disputeAmount ?? 0), 0) * 100) / 100,
  };
}

/** Panel copy — kept beside the rules so wording and threshold cannot drift. */
export function explainGroup(group) {
  if (group.duplicateRefundRisk) {
    return `This ${brand.terms.order} is being disputed through two channels at once — a card ${brand.terms.chargeback} and a ${brand.terms.claimProgramme} ${brand.terms.claim}. Worked separately, the same ${brand.terms.order} gets refunded twice.`;
  }
  switch (group.ruleId) {
    case 'same_card':
      return `${group.size} disputes were presented on the same card within ${group.windowDays} days. A shared card usually means one decision, and often one fraud pattern.`;
    case 'same_order':
      return `The same ${brand.terms.order} has been disputed ${group.size} times. Check for a duplicate presentment before responding to either.`;
    case 'same_seller':
      return `${group.size} open disputes against this ${brand.terms.seller} inside ${group.windowDays} days. Treat as a ${brand.terms.seller}-level pattern rather than ${group.size} unrelated cases. These are separate ${brand.terms.orders ?? 'orders'} — separate losses, not one refund paid twice.`;
    default:
      return group.ruleDescription;
  }
}
