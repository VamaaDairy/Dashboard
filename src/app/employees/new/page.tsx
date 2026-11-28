import { EntityFormPage } from "@/components/masters/EntityFormPage";

export const dynamic = "force-dynamic";

/** Add an employee (every Employee Master field). */
export default function Page() {
  return <EntityFormPage slug="staffs" id={null} />;
}
