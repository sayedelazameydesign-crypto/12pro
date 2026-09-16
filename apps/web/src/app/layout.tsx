import type { Metadata } from 'next';
import { AppShell } from '@/components/shell/AppShell';
import './globals.css';

export const metadata: Metadata = {
  title: 'CeliaOS / Nawah - Agent OS Control Plane',
  description: 'Full Agent OS interface - Chat + Projects + Missions + Memory + Tools + MCP + Connectors + Approvals + Trust',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
