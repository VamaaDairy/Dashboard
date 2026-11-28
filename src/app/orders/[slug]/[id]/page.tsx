import { redirect } from "next/navigation";
import { EntityFormPage } from "@/components/masters/EntityFormPage";
import { editHref } from "@/lib/masters/home";
import { MASTERS } from "@/lib/masters/schemas";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  // the Customer / Employee Master's form is in its own section now
  if (MASTERS[slug]?.home) redirect(editHref(MASTERS[slug], id));
  return <EntityFormPage slug={slug} id={id} />;
}
