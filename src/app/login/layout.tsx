import type { Metadata } from "next";
import { COMPANY, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Sign in | Gaia Dairy",
  description: `Sign in to the ${SITE_NAME} portal of ${COMPANY}, Raipur: orders, deliveries, distributors and accounts for Gaia staff and partners.`,
  robots: { index: true, follow: true },
  alternates: { canonical: "/login" },
  openGraph: { type: "website", siteName: SITE_NAME, title: `${SITE_NAME} portal`, url: "/login", images: ["/icon.png"] },
};

/** Who runs the site, for search engines: the name, logo and address shown beside a search result. */
const ORGANIZATION = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: COMPANY,
      alternateName: [SITE_NAME, "Vama Dairy", "Gaia"],
      url: SITE_URL,
      logo: `${SITE_URL}/icon.png`,
      address: { "@type": "PostalAddress", addressLocality: "Raipur", addressRegion: "Chhattisgarh", addressCountry: "IN" },
    },
    { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: SITE_NAME, url: SITE_URL, publisher: { "@id": `${SITE_URL}/#organization` } },
  ],
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION) }} />
      {children}
    </>
  );
}
