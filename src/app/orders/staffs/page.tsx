import { redirect } from "next/navigation";

/** The old Employee Profile screen: everything it had is in the Employee Master now. */
export default function Page() {
  redirect("/employees");
}
