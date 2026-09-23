import { useEffect } from 'react';
import { MERCHANTS } from '@/data/portfolio';
import { settingsFor } from '@/data/indemnification';
import { raiseNotification } from '@/data/notifications-store';
import { matchMerchants } from '@/domain/revenue';
import useStandingRules from '@/hooks/useStandingRules';

/**
 * Makes standing "alert me" rules actually fire.
 *
 * Mounted once in the app shell, so it runs on every page rather than only on
 * the screen the rule was written on. That is the whole difference between an
 * alert and a report: a rule that only speaks up when you go and look at it is
 * something you have to remember to check.
 *
 * WHAT THIS HONESTLY IS. There is no server and no scheduler here, so nothing
 * fires at 3am. What happens instead is that every standing alert rule is
 * re-evaluated against the live portfolio each time the console loads or the
 * rules change, and anything newly matching raises a notification in the bell.
 * For a demo that is the same experience — you cross the threshold, the bell
 * lights up, wherever you happen to be — without pretending to infrastructure
 * that does not exist.
 *
 * Each alert is keyed by rule and merchant, so crossing a threshold tells you
 * once rather than once per page view.
 */
export function useStandingAlerts() {
  const rules = useStandingRules();

  useEffect(() => {
    rules
      .filter((r) => r.enabled && r.action === 'alert')
      .forEach((rule) => {
        const matching = matchMerchants(MERCHANTS, rule.criteria, 'all', { settingsFor });
        matching.forEach((m) => {
          raiseNotification({
            title: rule.name,
            detail: `${m.name} — ${(m.chargebackRatio ?? 0).toFixed(2)}% chargeback ratio.`,
            alertKey: `${rule.id}:${m.id}`,
          });
        });
      });
  }, [rules]);
}

export default useStandingAlerts;
