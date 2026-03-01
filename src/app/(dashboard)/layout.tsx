import { TopNav } from "@/components/layout/top-nav";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/providers/query-provider";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <QueryProvider>
          <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <TopNav />
            <main className="mx-auto max-w-[1400px] p-4 md:p-6">
              {children}
            </main>
          </div>
          <Toaster position="top-right" />
        </QueryProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
