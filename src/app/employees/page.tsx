import { redirect } from "next/navigation";

/** Employee Master opens on the Salesforce group. */
export default function EmployeesPage() {
  redirect("/employees/salesforce");
}
