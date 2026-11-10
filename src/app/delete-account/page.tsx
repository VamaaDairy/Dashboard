import type { Metadata } from "next";
import { GaiaLogo } from "@/components/brand";
import { DeletionForm } from "./form";

export const metadata: Metadata = {
  title: "Delete your account | Gaia Dairy",
  description: "Ask Vamaa Dairy to delete your Gaia Dairy app account and its data.",
};

/** Public: where a Gaia Dairy app customer asks for their account to be deleted (linked from the Play Store). */
export default function DeleteAccountPage() {
  return (
    <article className="mx-auto max-w-xl px-5 py-10 text-sm leading-relaxed">
      <GaiaLogo className="mx-auto mb-6 w-40" />
      <h1 className="mb-2 text-2xl font-semibold">Delete your Gaia Dairy account</h1>
      <p className="mb-6 text-muted-foreground">
        For the Gaia Dairy app by Vamaa Dairy Private Limited. Enter the mobile number and 5-digit PIN you sign in with, and we will delete your account.
      </p>

      <DeletionForm />

      <section className="mt-8 space-y-3">
        <h2 className="text-base font-semibold">What happens next</h2>
        <ul className="list-disc space-y-1.5 pl-6">
          <li>We delete your account within 7 days of your request and sign you out of the app on every phone.</li>
          <li>Deleted: your name, mobile number, PIN, saved delivery address and location, subscriptions, and the notification settings of your phones.</li>
          <li>
            Kept: the bills of orders you already placed (items, amount, date, delivery address and payment reference) are kept for up to 8 years, as
            Indian tax and accounting law requires. They are not used for anything else.
          </li>
          <li>If you have an order that is on its way or paid but not yet delivered, we finish or refund it first.</li>
        </ul>
        <p>
          Forgot your PIN? Reset it in the app first, or write to <a className="underline" href="mailto:customercare@vamaadairy.com">customercare@vamaadairy.com</a> or
          call +91 8085959595 from your registered number.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-base font-semibold">Gaia Delivery Partner, Gaia Distributors and Gaia Salesforce</h2>
        <p>
          This form is for Gaia Dairy customer accounts. To delete a delivery partner, distributor, retailer or staff account, write to{" "}
          <a className="underline" href="mailto:customercare@vamaadairy.com">customercare@vamaadairy.com</a> or call +91 8085959595 from your
          registered number. We delete your profile, PIN, location history and notification settings; invoices, payments, and tax and payroll
          records are kept only for as long as the law requires.
        </p>
      </section>
    </article>
  );
}
