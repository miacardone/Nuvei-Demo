import { AppShell } from "@/components/shell/app-shell";
import { PendingPanel } from "@/components/ui/pending-panel";

export default function Page() {
  return (
    <AppShell title="Routing rules">
      <PendingPanel area="Routing rules" />
    </AppShell>
  );
}
