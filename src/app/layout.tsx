import type { ReactNode } from "react";
import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import "@refinedev/antd/dist/reset.css";
import "./globals-gamma.css";
import "@utils/suppress-warnings";
import { AppShell } from "./AppShell";
import { PwaRegister } from "@components/PwaRegister";
import { LoginLanding } from "@components/auth-page/LoginLanding";
import { AuthPage } from "@components/auth-page";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"),
  title: "Academia Crystal Diamante",
  description: "Plataforma Educativa",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/icon.svg",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    title: "Plataforma Educativa",
    description: "Academia Crystal Diamante",
    siteName: "Academia Crystal Diamante",
    images: [
      {
        url: "/api/og-image",
        width: 1200,
        height: 630,
        alt: "Academia Crystal Diamante - Plataforma Educativa",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Plataforma Educativa",
    description: "Academia Crystal Diamante",
    images: ["/api/og-image"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Crystal Diamante",
  },
};

export const viewport: Viewport = {
  themeColor: "#ff2aa1",
};

const LayoutFallback = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      fontSize: 14,
      color: "#4b5563",
    }}
  >
    Preparando la interfaz…
  </div>
);

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <Suspense fallback={<LayoutFallback />}>
          <AppShell>{children}</AppShell>
        </Suspense>
        <PwaRegister />
      </body>
    </html>
  );
}