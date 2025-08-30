import "@/styles/globals.css";
import { Metadata, Viewport } from "next";
import clsx from "clsx";
import { Providers } from "./providers";
import { fontSans, fontFigtree } from "@/config/fonts";

const seoConfig = {
  siteName: "VPS ALERT",
  title: "Real-time OVH VPS Availability Monitor",
  description:
    "Get instant notifications when OVH VPS becomes available. Monitor stock across all datacenters in real-time with automated email alerts. Never miss your preferred VPS configuration again.",
  keywords:
    "OVH VPS monitor, VPS availability, server monitoring, OVH stock alerts, VPS notifications, real-time monitoring, server availability, VPS tracker, hosting alerts, cloud server monitor",
  url: "https://vpsalert.online",
  image: "/og-image.jpg",
  favicon: "/favicon.ico",
  author: "VPS Alert Team",
  type: "website",
  locale: "en_US",
  alternateLocales: ["id_ID"],
};

export const metadata: Metadata = {
  metadataBase: new URL(seoConfig.url),
  title: {
    default: seoConfig.title,
    template: `%s | ${seoConfig.siteName}`,
  },
  description: seoConfig.description,
  keywords: seoConfig.keywords,
  authors: [{ name: seoConfig.author, url: seoConfig.url }],
  creator: seoConfig.author,
  publisher: seoConfig.siteName,
  // Open Graph
  openGraph: {
    type: "website",
    locale: seoConfig.locale,
    alternateLocale: seoConfig.alternateLocales,
    url: seoConfig.url,
    siteName: seoConfig.siteName,
    title: seoConfig.title,
    description: seoConfig.description,
    images: [
      {
        url: seoConfig.image,
        width: 1200,
        height: 630,
        alt: `${seoConfig.siteName} - Real-time OVH VPS Availability Monitor`,
        type: "image/jpeg",
      },
    ],
    emails: "support@vpsalert.online",
  },

  // Icons
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "android-chrome",
        url: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        rel: "android-chrome",
        url: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  },

  // Sitemap and Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // Sitemap reference
  alternates: {
    canonical: seoConfig.url,
    languages: {
      "en-US": `${seoConfig.url}/en`,
      "id-ID": `${seoConfig.url}/id`,
    },
    types: {
      "application/xml": `${seoConfig.url}/sitemap.xml`,
      "application/rss+xml": `${seoConfig.url}/feed.xml`,
    },
  },

  category: "technology",
  applicationName: seoConfig.siteName,
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning lang="en">
      <head>
        <link href="/sitemap.xml" rel="sitemap" type="application/xml" />

        {/* Additional favicon meta tags for better browser support */}
        <link href="/favicon.ico" rel="icon" type="image/x-icon" />
        <link
          href="/favicon-16x16.png"
          rel="icon"
          sizes="16x16"
          type="image/png"
        />
        <link
          href="/favicon-32x32.png"
          rel="icon"
          sizes="32x32"
          type="image/png"
        />
        <link
          href="/apple-touch-icon.png"
          rel="apple-touch-icon"
          sizes="180x180"
        />

        {/* Preload critical resources for better performance */}
        <link as="image" href="/favicon-32x32.png" rel="preload" />
        <link as="image" href="/apple-touch-icon.png" rel="preload" />
        {/* <link
          as="font"
          href="/fonts/figtree.woff2"
          rel="preload"
          type="font/woff2"
          crossOrigin="anonymous"
        /> */}

        {/* Web App Manifest */}
        <link href="/site.webmanifest" rel="manifest" />

        {/* PWA Meta Tags */}
        <meta content="yes" name="mobile-web-app-capable" />
        <meta content="yes" name="apple-mobile-web-app-capable" />
        <meta
          content="black-translucent"
          name="apple-mobile-web-app-status-bar-style"
        />
        <meta content="VPS Alert" name="apple-mobile-web-app-title" />
        <meta content="VPS Alert" name="application-name" />
        <meta content="#006FEE" name="msapplication-TileColor" />
        <meta content="/browserconfig.xml" name="msapplication-config" />

        {/* Security Headers */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="X-Frame-Options" content="DENY" />
        <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />
      </head>
      <body
        className={clsx(
          "bg-[#EEF6FF] dark:bg-[#000710] font-figtree antialiased transition-colors",
          fontFigtree.variable
        )}
      >
        <Providers themeProps={{ attribute: "class", defaultTheme: "dark" }}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
