import { EntityFormPage } from "@/components/masters/EntityFormPage";

export const dynamic = "force-dynamic";

/** Add a customer (every Customer Master field). */
export default function Page() {
  return <EntityFormPage slug="distribution" id={null} />;
}
