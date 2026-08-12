import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" }, sitemap: "https://rental-electricity-splitter-tw.su-yu-grace.chatgpt.site/sitemap.xml" };
}
