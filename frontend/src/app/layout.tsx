import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { StartupProvider } from "@/components/providers/startup-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pharmacy Management System",
  description: "Pharmacy Management Simplified",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <StartupProvider>
            {children}
          </StartupProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
