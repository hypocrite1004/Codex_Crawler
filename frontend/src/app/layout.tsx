import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Navbar from "@/components/Navbar";
import { Toaster } from "react-hot-toast";
import ScrollToTop from "@/components/ScrollToTop";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "SecurNet | Advanced Security Insights",
  description: "Share and discover the latest cyber security issues, vectors, and defense mechanisms.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.variable}>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#fff',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            },
            success: {
              iconTheme: { primary: 'var(--accent-primary)', secondary: '#000' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: '#fff' },
            },
          }}
        />
        <Navbar />
        <main className="main-content">
          {children}
        </main>
        <ScrollToTop />
      </body>
    </html>
  );
}
