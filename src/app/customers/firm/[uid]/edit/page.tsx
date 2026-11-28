import { EntityFormPage } from "@/components/masters/EntityFormPage";

export const dynamic = "force-dynamic";

/** Edit a customer (every Customer Master field). */
export default async function Page({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  return <EntityFormPage slug="distribution" id={uid} />;
}
