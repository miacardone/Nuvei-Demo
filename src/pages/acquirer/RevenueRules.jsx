import { useState } from 'react';
import { PageHeader, Card, Tabs } from '@/components/ui/Surface';
import Icon from '@/components/ui/Icon';
import SuggestionsTab from '@/components/revenue/SuggestionsTab';
import CreateTab from '@/components/revenue/CreateTab';
import { settingsFor } from '@/data/indemnification';
import useIndemnification from '@/hooks/useIndemnification';
import useSavedSuggestions from '@/hooks/useSavedSuggestions';

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
  const saved = useSavedSuggestions();

  const [tab, setTab] = useState('suggestions');
  const [prefill, setPrefill] = useState({ ctx: { settingsFor } });
  const [seed, setSeed] = useState(0);

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
      />

      <div className="stack">
        <Card bodyClassName="card__body--flush">
          <div style={{ padding: '0 var(--s-4)' }}>
            <Tabs tabs={TABS} value={tab} onChange={setTab} />
          </div>
        </Card>

        {tab === 'suggestions' && (
          <SuggestionsTab saved={saved} onOpenInCreate={openInCreate} />
        )}

        {tab === 'create' && (
          <CreateTab key={seed} prefill={prefill} onSaved={() => setTab('suggestions')} />
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
