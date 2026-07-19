import { TopNav } from "@/components/layout/top-nav";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/providers/query-provider";
import { SocketProvider } from "@/components/providers/socket-provider";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { ChatWidget } from "@/components/ai/chat-widget";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <QueryProvider>
          <SocketProvider>
            <div className="min-h-screen bg-background text-foreground">
              <TopNav />
              <div className="lg:pl-[260px]">
                <main className="app-content min-h-screen">{children}</main>
              </div>
            </div>
            <ChatWidget />
            <Toaster
              position="top-right"
              richColors={false}
              toastOptions={{
                classNames: {
                  toast:
                    "border-border bg-popover text-popover-foreground shadow-[var(--outline-menu-shadow)]",
                  title: "text-foreground",
                  description: "text-muted-foreground",
                  actionButton: "bg-primary text-primary-foreground",
                  cancelButton: "bg-secondary text-secondary-foreground",
                },
              }}
            />
          </SocketProvider>
        </QueryProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
