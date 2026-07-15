"use client";

export function OpenSignupLinkForm() {
  return (
    <div className="rounded-xl border border-storm-medium-blue/30 bg-storm-medium-blue/5 p-4 sm:p-5">
      <h3 className="font-medium text-storm-navy">Open signup</h3>
      <p className="mt-1 text-sm text-storm-navy/60">
        Open signup links are disabled. Create employees in the CRM with a mobile
        phone number for SMS 2FA, sync them to the LMS, then they sign in here with
        the same email and password.
      </p>
    </div>
  );
}
