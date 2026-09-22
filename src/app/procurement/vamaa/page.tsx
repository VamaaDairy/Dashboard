import { redirect } from "next/navigation";

export default function VamaaLandingPage() {
  redirect(`/procurement/vamaa/${new Date().toISOString().slice(0, 10)}`);
}
