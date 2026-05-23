import { LogoMark } from "@/components/brand/Logo";
import { prisma } from "@/lib/db";
import { isInviteActive } from "@/lib/invites/validate";
import { notFound } from "next/navigation";
import { AcceptInviteForm } from "./AcceptInviteForm";

export const metadata = { title: "Accept invite" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await prisma.invite.findUnique({ where: { token } });

  if (!invite || !isInviteActive(invite)) {
    notFound();
  }

  const openSignup = invite.openSignup;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-storm-light-grey px-4">
      <div className="w-full max-w-md rounded-2xl border border-storm-light-blue/60 bg-white p-8 shadow-lg">
        <LogoMark size={120} priority className="mb-6" />
        <h1 className="font-title text-center text-2xl font-bold text-storm-navy">
          Join Storm Sprinklers LMS
        </h1>
        <p className="mt-2 text-center text-sm text-storm-navy/60">
          {openSignup
            ? "Create your account with your work email and name."
            : `Set up your account for ${invite.email}`}
        </p>
        {invite.label && openSignup && (
          <p className="mt-1 text-center text-xs text-storm-navy/50">
            {invite.label}
          </p>
        )}
        <div className="mt-8">
          <AcceptInviteForm
            token={token}
            openSignup={openSignup}
            prefillEmail={invite.email}
          />
        </div>
      </div>
    </div>
  );
}
