import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ConditionalShell } from "@/components/conditional-shell";
import { getClasses, getLastCalc } from "@/lib/data";
import type { SidebarClass } from "@/components/app-sidebar";
import { COMPANY, SITE_NAME, SITE_URL } from "@/lib/site";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description: `${SITE_NAME} portal by ${COMPANY}.`,
  applicationName: SITE_NAME,
  // out of search by default: only the public pages (sign in, forgot password, privacy policy, delete account) say otherwise
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  let classes: SidebarClass[] = [];
  let calc = null;
  try {
    const [rows, lastCalc] = await Promise.all([getClasses(), getLastCalc()]);
    classes = rows.map((c) => ({
      code: c.code,
      label: c.plural_name ?? c.name,
      count: c.object_count,
    }));
    calc = lastCalc;
  } catch {
    // the login screen renders before the model is reachable
  }

  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-background text-foreground antialiased">
        <ConditionalShell classes={classes} calc={calc}>
          {children}
        </ConditionalShell>
      </body>
    </html>
  );
}
