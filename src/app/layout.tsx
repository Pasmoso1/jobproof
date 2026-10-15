import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { FirstTouchAttributionCapture } from "@/components/first-touch-attribution-capture";
import { PartnerRefCapture } from "@/components/partner-ref-capture";
import MetaPageViewTracker from "@/components/MetaPageViewTracker";
import { buildGa4BootstrapScript } from "@/lib/ga4-environment";
import { buildMetaPixelBootstrapScript } from "@/lib/meta-pixel-environment";
import "./globals.css";

const ga4BootstrapScript = buildGa4BootstrapScript();
const metaPixelBootstrapScript = buildMetaPixelBootstrapScript();

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JobProof",
  description:
    "JobProof helps Canadian contractors turn customer inquiries into professional quotes, win more jobs, and keep every job organized.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {metaPixelBootstrapScript ? (
          <Script id="meta-pixel" strategy="afterInteractive">
            {metaPixelBootstrapScript}
          </Script>
        ) : null}
        {ga4BootstrapScript ? (
          <Script id="google-analytics" strategy="afterInteractive">
            {ga4BootstrapScript}
          </Script>
        ) : null}
        <Suspense fallback={null}>
          <MetaPageViewTracker />
          <FirstTouchAttributionCapture />
          <PartnerRefCapture />
        </Suspense>
        {children}
      </body>
    </html>
  );
}

