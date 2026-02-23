import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "AI Wrapper — Build AI Automations Without Code",
  description:
    "Deploy and automate AI workflows with clicks, not code. Connect WhatsApp, Telegram, Gmail, Slack, OpenAI and more. Powered by OpenClaw.",
  keywords: "AI automation, no-code, OpenClaw, workflow builder, AI agent",
  openGraph: {
    title: "AI Wrapper — Build AI Automations Without Code",
    description:
      "Deploy and automate AI workflows with clicks, not code.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
