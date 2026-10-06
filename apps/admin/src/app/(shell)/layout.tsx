import type { ReactNode } from 'react';
import { AppShell } from '@/features/shell/app-shell';

// Access is enforced by src/proxy.ts (navigation) and by the BFF (data).
export default function ShellLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
