import { AppShell } from "@/components/AppShell";
import { UrlCleaner } from "@/components/UrlCleaner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <UrlCleaner />
      {children}
    </AppShell>
  );
}
