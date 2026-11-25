import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forgot password | Gaia Dairy",
  description: "Reset your Gaia Dairy portal password with a code sent to your email.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/login/forgot" },
};

export default function ForgotLayout({ children }: { children: React.ReactNode }) {
  return children;
}
