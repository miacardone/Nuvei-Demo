import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader, Card, Tabs } from '@/components/ui/Surface';
import Icon from '@/components/ui/Icon';
import SuggestionsTab from '@/components/revenue/SuggestionsTab';
import CreateTab from '@/components/revenue/CreateTab';
import { settingsFor } from '@/data/indemnification';
import { MERCHANTS } from '@/data/portfolio';
import { MERCHANT_GROUPS } from '@/data/merchants';
import { SelectField } from '@/components/ui/Form';
import useIndemnification from '@/hooks/useIndemnification';
import useSavedSuggestions from '@/hooks/useSavedSuggestions';
import useStandingRules from '@/hooks/useStandingRules';
import useMerchantFlags from '@/hooks/useMerchantFlags';

/**
 * REVENUE RULES
 *
 * Two tabs, in the order you would use them:
 *
 *   SUGGESTIONS — what the console already thinks is worth doing, ranked by
 *   what the site has actually been busy with, plus the record of everything
 *   saved out of Create and what was decided about it.
 *
 *   CREATE — ask your own question. A questionnaire on the left, a live answer
 *   on the right that recomputes as you fill it in; nothing needs saving
 *   before you can see what a rule would do.
 *
 * `prefill` is how the two connect: opening a suggestion in Create remounts
 * the questionnaire with its subject and question already chosen. It is keyed
 * so the form re-seeds rather than merging into whatever was there before.
 */

const TABS = [
  { value: 'suggestions', label: 'Suggestions' },
  { value: 'create', label: 'Create' },
];

export function RevenueRules() {
  // Both tabs read indemnification and saved suggestions, and both write them,
  // so the page subscribes once and every figure stays in step.
  useIndemnification();
  useMerchantFlags();
  const saved = useSavedSuggestions();
  const standingRules = useStandingRules();

  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState('suggestions');

  /* One picker for the whole screen. Both tabs read the same selection, so
     narrowing to a segment up here narrows the suggestions, the activity and
     the standing-rule counts together rather than each tab carrying its own
     idea of who is in scope. */
  const [scope, setScope] = useState('all');
  const scoped = scope === 'all'
    ? MERCHANTS
    : MERCHANTS.filter((m) => (scope.startsWith('g:') ? m.groupId === scope.slice(2) : m.id === scope));
  const [prefill, setPrefill] = useState({ ctx: { settingsFor } });
  const [seed, setSeed] = useState(0);

  /* Arriving from site search with a question attached: open Create on the
     Describe it route with the sentence already in the bar, which runs it and
     lands the reader on the answer. The parameter is cleared afterwards so a
     refresh does not keep re-asking a question they have moved on from. */
  useEffect(() => {
    const ask = searchParams.get('ask');
    if (!ask) return;
    setPrefill({ ctx: { settingsFor }, starter: 'describe', askQuery: ask });
    setSeed((n) => n + 1);
    setTab('create');
    const next = new URLSearchParams(searchParams);
    next.delete('ask');
    setSearchParams(next, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const openInCreate = (next) => {
    setPrefill({ ctx: { settingsFor }, ...next });
    setSeed((n) => n + 1);
    setTab('create');
  };

  return (
    <>
      <PageHeader
        title="Revenue rules"
        description="Ask what your merchants could be worth, or let the console tell you — then apply it to the ones it affects."
        actions={(
          <SelectField
            aria-label="Merchants in scope"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            options={[
              { value: 'all', label: `All merchants (${MERCHANTS.length})` },
              ...MERCHANT_GROUPS
                .filter((g) => MERCHANTS.some((m) => m.groupId === g.id))
                .map((g) => ({ value: `g:${g.id}`, label: `${g.label} (${MERCHANTS.filter((m) => m.groupId === g.id).length})` })),
              ...MERCHANTS.map((m) => ({ value: m.id, label: m.name })),
            ]}
          />
        )}
      />

      <div className="stack">
        {/* A plain statement of what this screen is for. Everything below it
            assumes you already know what indemnification is and why a
            chargeback ratio matters; someone opening it cold does not. */}
        <Card bodyClassName="card__body--tight">
          <div className="row row--xtight row--nowrap" style={{ alignItems: 'flex-start' }}>
            <Icon name="info" size={15} style={{ marginTop: 2, color: 'var(--c-primary)', flex: 'none' }} />
            <div className="stack stack--xtight">
              <span className="small strong">What this screen is for</span>
              <p className="small" style={{ margin: 0 }}>
                Chargebacks cost your merchants money. You can sell them protection from that — you take
                on the losses, they pay you a small slice of what they process. This screen works out
                <b> who is worth protecting, what to charge them,</b> and lets you apply it to a whole
                group of merchants at once instead of one at a time.
              </p>
              <p className="micro subtle" style={{ margin: 0 }}>
                <b>Suggestions</b> tells you what it already thinks is worth doing.
                {' '}<b>Create</b> is where you ask your own question. Nothing is saved until you press a button.
              </p>
            </div>
          </div>
        </Card>

        <Card bodyClassName="card__body--flush">
          <div style={{ padding: '0 var(--s-4)' }}>
            <Tabs tabs={TABS} value={tab} onChange={setTab} />
          </div>
        </Card>

        {tab === 'suggestions' && (
          <SuggestionsTab saved={saved} standingRules={standingRules} merchants={scoped} onOpenInCreate={openInCreate} />
        )}

        {tab === 'create' && (
          <CreateTab key={seed} prefill={prefill} merchants={scoped} onSaved={() => setTab('suggestions')} />
        )}

        <Card bodyClassName="card__body--tight">
          <div className="row row--xtight row--nowrap" style={{ alignItems: 'flex-start' }}>
            <Icon name="info" size={13} style={{ marginTop: 2, color: 'var(--c-ink-subtle)', flex: 'none' }} />
            <p className="micro subtle" style={{ margin: 0 }}>
              <strong>How these are worked out.</strong> Expected loss is the disputed value we do not win back:
              annual volume × chargeback ratio × (1 − win rate). Revenue uses the same calculation as the merchant
              record — basis points of volume, or a flat fee on every transaction. Net is revenue minus expected
              loss. Activity scores each merchant on its last 30 days of case volume, disputed value, overdue count
              and analyst time. These are estimates from the current book, not a forecast.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}

export default RevenueRules;
