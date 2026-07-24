import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { themeInitScript } from "@/lib/theme/script";
import { ToastProvider } from "@/components/toast/ToastProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.growthlink.uk"),
  title: "Growth Link",
  description: "Inbox conversacional, CRM y ATS con IA sobre WhatsApp.",
  applicationName: "Growth Link",
  openGraph: {
    siteName: "Growth Link",
    title: "Growth Link",
    description: "Inbox conversacional, CRM y ATS con IA sobre WhatsApp.",
    url: "https://www.growthlink.uk",
    locale: "es_AR",
    type: "website",
    images: ["/growth_businesss_logo.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Growth Link",
    description: "Inbox conversacional, CRM y ATS con IA sobre WhatsApp.",
    images: ["/growth_businesss_logo.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Sets data-theme before hydration to avoid a flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          <ToastProvider />
        </ThemeProvider>
      </body>
    </html>
  );
}
