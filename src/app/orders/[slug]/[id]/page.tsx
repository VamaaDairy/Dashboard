import { EntityFormPage } from "@/components/masters/EntityFormPage";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  return <EntityFormPage slug={slug} id={id} />;
}
