/**
 * Deterministic sandbox data for the demo.
 *
 * Fixed values, not randomised — a demo must render identically on the server
 * and the client, and identically every time it is shown.
 *
 * NOTE: these figures are illustrative placeholders, not Nuvei numbers. Swap
 * them for the real CPO dataset when it lands.
 */

export const kpis = [
  { label: "Authorization rate", value: "94.2%", delta: +1.8, note: "vs. last 30d" },
  { label: "Processed volume", value: "$48.6M", delta: +6.3, note: "last 30 days" },
  { label: "Recovered declines", value: "$1.24M", delta: +12.1, note: "via cascading" },
  { label: "Avg. cost per txn", value: "$0.31", delta: -4.2, note: "blended" },
];

export type Provider = {
  name: string;
  region: string;
  share: number;
  authRate: number;
  status: "healthy" | "degraded" | "offline";
};

export const providers: Provider[] = [
  { name: "Nuvei Acquiring", region: "EU", share: 38, authRate: 95.6, status: "healthy" },
  { name: "Nuvei Acquiring", region: "US", share: 27, authRate: 93.1, status: "healthy" },
  { name: "Local acquirer — BR", region: "LATAM", share: 14, authRate: 88.4, status: "degraded" },
  { name: "Local acquirer — SG", region: "APAC", share: 12, authRate: 92.0, status: "healthy" },
  { name: "Backup PSP", region: "Global", share: 9, authRate: 90.7, status: "healthy" },
];

export type RoutingRule = {
  id: string;
  name: string;
  condition: string;
  action: string;
  enabled: boolean;
};

export const routingRules: RoutingRule[] = [
  {
    id: "R-01",
    name: "EU cards → local acquiring",
    condition: "issuer_country in EEA AND amount < 5,000 EUR",
    action: "Route to Nuvei Acquiring (EU)",
    enabled: true,
  },
  {
    id: "R-02",
    name: "Soft decline cascade",
    condition: "response_code in (51, 61, 65) AND attempt = 1",
    action: "Retry on next-best provider after 90s",
    enabled: true,
  },
  {
    id: "R-03",
    name: "Low-risk 3DS exemption",
    condition: "risk_score < 20 AND amount < 250 EUR",
    action: "Request TRA exemption",
    enabled: true,
  },
  {
    id: "R-04",
    name: "High-value step-up",
    condition: "amount >= 2,000 EUR",
    action: "Force challenge 3DS",
    enabled: false,
  },
];

export type Transaction = {
  id: string;
  merchant: string;
  amount: string;
  method: string;
  provider: string;
  status: "approved" | "declined" | "recovered" | "pending";
  time: string;
};

export const recentTransactions: Transaction[] = [
  { id: "txn_8f21c", merchant: "Atlas Retail", amount: "€124.00", method: "Visa ••4291", provider: "Nuvei EU", status: "approved", time: "14:02" },
  { id: "txn_8f21a", merchant: "Vertex SaaS", amount: "$1,290.00", method: "Mastercard ••7712", provider: "Nuvei US", status: "recovered", time: "14:01" },
  { id: "txn_8f219", merchant: "Atlas Retail", amount: "R$ 89,90", method: "Pix", provider: "Local BR", status: "approved", time: "13:59" },
  { id: "txn_8f216", merchant: "Northwind Travel", amount: "€2,410.00", method: "Visa ••1102", provider: "Nuvei EU", status: "pending", time: "13:58" },
  { id: "txn_8f214", merchant: "Vertex SaaS", amount: "$49.00", method: "Amex ••3004", provider: "Backup PSP", status: "declined", time: "13:56" },
  { id: "txn_8f211", merchant: "Kite Studio", amount: "S$ 320.00", method: "GrabPay", provider: "Local SG", status: "approved", time: "13:55" },
];
