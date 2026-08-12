import type { Metadata, Viewport } from "next";
import "./globals.css";

const title = "分租電費計算器｜公共電費按人數公平分攤";
const description = "免費線上分租電費計算器。輸入帳單金額、總用電度數、各房電表與居住人數，自動拆分房內及公共電費，清楚列出每房與每人應付金額。";

export const metadata: Metadata = {
  metadataBase: new URL("https://rental-electricity-splitter-tw.su-yu-grace.chatgpt.site"),
  title,
  description,
  keywords: ["分租電費計算", "租屋電費", "公共電費分攤", "套房電費計算", "室友電費", "電費計算器"],
  alternates: { canonical: "/" },
  openGraph: { title, description, url: "/", siteName: "分電", locale: "zh_TW", type: "website" },
  twitter: { card: "summary", title, description },
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = { themeColor: "#f7f9f7", width: "device-width", initialScale: 1 };

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "分租電費計算器",
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "TWD" },
  description,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant-TW"><body><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />{children}</body></html>;
}
