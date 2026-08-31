import { AppShell } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { Delta } from "@/components/ui/delta";
import {
  kpis,
  providers,
  recentTransactions,
  routingRules,
  type Provider,
  type Transaction,
} from "@/lib/demo-data";

const providerColumns: Column<Provider>[] = [
  { key: "name", header: "Provider", cell: (p) => p.name, primary: true, className: "font-medium" },
  { key: "region", header: "Region", cell: (p) => p.region, className: "text-ink-muted" },
  {
    key: "share",
    header: "Share",
    cell: (p) => (
      <span className="flex items-center justify-end gap-2 md:justify-start">
        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-sunken md:w-24">
          <span
            className="block h-full rounded-full bg-accent"
            style={{ width: `${p.share}%` }}
          />
        </span>
        <span className="tnum text-ink-muted">{p.share}%</span>
      </span>
    ),
  },
  {
    key: "auth",
    header: "Auth rate",
    cell: (p) => `${p.authRate.toFixed(1)}%`,
    className: "tnum",
  },
  {
    key: "status",
    header: "Status",
    cell: (p) => <StatusPill status={p.status} />,
    trailing: true,
  },
];

const transactionColumns: Column<Transaction>[] = [
  { key: "id", header: "Transaction", cell: (t) => t.id, secondary: true, className: "code text-xs" },
  { key: "merchant", header: "Merchant", cell: (t) => t.merchant, primary: true, className: "font-medium" },
  { key: "amount", header: "Amount", cell: (t) => t.amount, className: "tnum" },
  { key: "method", header: "Method", cell: (t) => t.method, className: "text-ink-muted" },
  { key: "provider", header: "Routed to", cell: (t) => t.provider, className: "text-ink-muted" },
  {
    key: "status",
    header: "Status",
    cell: (t) => <StatusPill status={t.status} />,
    trailing: true,
  },
  { key: "time", header: "Time", cell: (t) => t.time, className: "tnum text-ink-muted" },
];

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
            <DataTable
              columns={providerColumns}
              rows={providers}
              rowKey={(p) => `${p.name}-${p.region}`}
            />
          </Card>

          <Card title="Active routing rules">
            <ul className="divide-y divide-line">
              {routingRules.map((rule) => (
                <li key={rule.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">{rule.name}</p>
                    <StatusPill status={rule.enabled ? "active" : "paused"} />
                  </div>
                  <p className="mt-1 code break-words text-xs leading-relaxed text-ink-muted">
                    {rule.condition}
                  </p>
                  <p className="mt-1 text-xs text-accent">→ {rule.action}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card title="Recent transactions">
          <DataTable
            columns={transactionColumns}
            rows={recentTransactions}
            rowKey={(t) => t.id}
          />
        </Card>
      </div>
    </AppShell>
  );
}
