import { redirect } from "next/navigation";
import { today } from "@/lib/dates";

export default function VamaaLandingPage() {
  redirect(`/procurement/vamaa/${today()}`);
}
