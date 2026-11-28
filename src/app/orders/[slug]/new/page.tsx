import { redirect } from "next/navigation";
import { EntityFormPage } from "@/components/masters/EntityFormPage";
import { newHref } from "@/lib/masters/home";
import { MASTERS } from "@/lib/masters/schemas";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // the Customer / Employee Master's form is in its own section now
  if (MASTERS[slug]?.home) redirect(newHref(MASTERS[slug]));
  return <EntityFormPage slug={slug} id={null} />;
}
