import { AppShell } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Delta } from "@/components/ui/delta";
import {
  kpis,
  providers,
  recentTransactions,
  routingRules,
} from "@/lib/demo-data";

export default function OverviewPage() {
  return (
    <AppShell title="Overview">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-[var(--brand-radius)] border border-line bg-surface-raised p-5"
            >
              <p className="text-sm text-ink-muted">{kpi.label}</p>
              <p className="mt-2 font-display text-3xl font-semibold tracking-tight tnum">
                {kpi.value}
              </p>
              <p className="mt-2 flex items-center gap-2">
                <Delta value={kpi.delta} />
                <span className="text-xs text-ink-muted">{kpi.note}</span>
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card title="Traffic by provider" className="xl:col-span-2">
            <table className="w-full text-sm">
              <thead className="bg-surface-sunken text-left text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Provider</th>
                  <th className="px-5 py-2.5 font-medium">Region</th>
                  <th className="px-5 py-2.5 font-medium">Share</th>
                  <th className="px-5 py-2.5 font-medium">Auth rate</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p, i) => (
                  <tr key={`${p.name}-${p.region}`} className={i > 0 ? "border-t border-line" : ""}>
                    <td className="px-5 py-3 font-medium">{p.name}</td>
                    <td className="px-5 py-3 text-ink-muted">{p.region}</td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-sunken">
                          <span
                            className="block h-full rounded-full bg-accent"
                            style={{ width: `${p.share}%` }}
                          />
                        </span>
                        <span className="tnum text-ink-muted">{p.share}%</span>
                      </span>
                    </td>
                    <td className="px-5 py-3 tnum">{p.authRate.toFixed(1)}%</td>
                    <td className="px-5 py-3">
                      <StatusPill status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="Active routing rules">
            <ul className="divide-y divide-line">
              {routingRules.map((rule) => (
                <li key={rule.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">{rule.name}</p>
                    <StatusPill status={rule.enabled ? "active" : "paused"} />
                  </div>
                  <p className="mt-1 font-mono text-xs leading-relaxed text-ink-muted">
                    {rule.condition}
                  </p>
                  <p className="mt-1 text-xs text-accent">→ {rule.action}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card title="Recent transactions">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken text-left text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-5 py-2.5 font-medium">Transaction</th>
                <th className="px-5 py-2.5 font-medium">Merchant</th>
                <th className="px-5 py-2.5 font-medium">Amount</th>
                <th className="px-5 py-2.5 font-medium">Method</th>
                <th className="px-5 py-2.5 font-medium">Routed to</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map((t, i) => (
                <tr key={t.id} className={i > 0 ? "border-t border-line" : ""}>
                  <td className="px-5 py-3 font-mono text-xs">{t.id}</td>
                  <td className="px-5 py-3 font-medium">{t.merchant}</td>
                  <td className="px-5 py-3 tnum">{t.amount}</td>
                  <td className="px-5 py-3 text-ink-muted">{t.method}</td>
                  <td className="px-5 py-3 text-ink-muted">{t.provider}</td>
                  <td className="px-5 py-3">
                    <StatusPill status={t.status} />
                  </td>
                  <td className="px-5 py-3 tnum text-ink-muted">{t.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </AppShell>
  );
}
