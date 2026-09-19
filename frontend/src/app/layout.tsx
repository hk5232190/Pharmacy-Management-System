import type { Metadata } from "next";
import "./globals.css";
import { StartupProvider } from "@/components/providers/startup-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { SystemPreferencesProvider } from "@/contexts/SystemPreferencesContext";
import { Toaster } from "@/components/ui/sonner";
import { Inter } from "next/font/google";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  preload: false,   // skip network fetch during build; font loads from browser cache
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Arial", "sans-serif"],
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
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SystemPreferencesProvider>
            <StartupProvider>
              <AuthProvider>
                <ProfileProvider>
                  {children}
                </ProfileProvider>
              </AuthProvider>
            </StartupProvider>
          </SystemPreferencesProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
