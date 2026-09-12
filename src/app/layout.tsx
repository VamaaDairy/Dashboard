import type { Metadata } from "next";
import "./globals.css";
import { ConditionalShell } from "@/components/conditional-shell";
import { getClasses, getLastCalc } from "@/lib/data";
import type { SidebarClass } from "@/components/app-sidebar";

export const metadata: Metadata = {
  title: "Gaia Costing",
  description: "Product costing workspace",
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
    <html lang="en">
      <body className="bg-white text-slate-800">
        <ConditionalShell classes={classes} calc={calc}>
          {children}
        </ConditionalShell>
      </body>
    </html>
  );
}
