import { redirect } from "next/navigation";

/** The old Customer Masters screen: everything it had is in the Customer Master now. */
export default function Page() {
  redirect("/customers");
}
