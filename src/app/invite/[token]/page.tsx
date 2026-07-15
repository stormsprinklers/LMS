import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";

export const metadata = { title: "Account setup" };

export default async function InvitePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-storm-light-grey px-4">
      <div className="w-full max-w-md rounded-2xl border border-storm-light-blue/60 bg-white p-8 shadow-lg">
        <LogoMark size={120} priority className="mb-6" />
        <h1 className="font-title text-center text-2xl font-bold text-storm-navy">
          Accounts come from the CRM
        </h1>
        <p className="mt-3 text-center text-sm text-storm-navy/70">
          LMS no longer uses invite passwords. An admin must create your employee
          profile in the CRM (with email, password, and mobile phone for SMS 2FA),
          then sync you to the LMS.
        </p>
        <p className="mt-6 text-center">
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded-lg bg-storm-medium-blue px-5 text-sm font-semibold text-white no-underline"
          >
            Go to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
