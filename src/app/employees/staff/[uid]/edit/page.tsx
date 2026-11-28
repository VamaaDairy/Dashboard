import { EntityFormPage } from "@/components/masters/EntityFormPage";

export const dynamic = "force-dynamic";

/** Edit an employee (every Employee Master field). */
export default async function Page({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  return <EntityFormPage slug="staffs" id={uid} />;
}
