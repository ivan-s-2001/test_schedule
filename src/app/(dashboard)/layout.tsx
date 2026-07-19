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
        defaultTheme="light"
        forcedTheme="light"
        enableSystem={false}
      >
        <QueryProvider>
          <SocketProvider>
            <div className="min-h-screen bg-white text-[#111319]">
              <TopNav />
              <main className="mx-auto w-full max-w-[1600px] px-4 py-5 md:px-6 md:py-6 lg:px-8">
                {children}
              </main>
            </div>
            <ChatWidget />
            <Toaster position="top-right" richColors={false} />
          </SocketProvider>
        </QueryProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
