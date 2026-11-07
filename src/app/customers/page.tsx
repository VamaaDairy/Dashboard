import { redirect } from "next/navigation";

/** Customer Master opens on distributors. */
export default function CustomersPage() {
  redirect("/customers/distributors");
}
