import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import GMIStatusBar from "@/components/GMIStatusBar";
import ErrorBoundary from "@/components/ErrorBoundary";
import I18nProvider from "@/components/I18nProvider";

export const metadata: Metadata = {
  title: "DocTransAgent — AI Translation & Knowledge Base",
  description:
    "AI-powered multilingual document translation & GraphRAG knowledge platform. Built on GMI Cloud.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className="antialiased">
        <I18nProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex flex-col flex-1" style={{ marginLeft: "224px" }}>
              <GMIStatusBar />
              <main className="flex-1 p-8">
                <ErrorBoundary>{children}</ErrorBoundary>
              </main>
            </div>
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
