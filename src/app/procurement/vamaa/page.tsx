import { redirect } from "next/navigation";
import { today } from "@/lib/dates";

// redirects to today, so it must run on every request, never once at build time
export const dynamic = "force-dynamic";

export default function VamaaLandingPage() {
  redirect(`/procurement/vamaa/${today()}`);
}
