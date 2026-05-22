import { Suspense } from "react";
import { LogoMark } from "@/components/brand/Logo";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-storm-light-grey px-4">
      <div className="w-full max-w-md rounded-2xl border border-storm-light-blue/60 bg-white p-8 shadow-lg">
        <LogoMark size={140} priority className="mb-6" />
        <h1 className="font-title text-center text-2xl font-bold text-storm-navy">
          Employee Learning
        </h1>
        <p className="mt-2 text-center text-sm text-storm-navy/60">
          Sign in with your Storm Sprinklers account
        </p>
        <div className="mt-8">
          <Suspense fallback={<p className="text-center text-sm text-storm-navy/60">Loading…</p>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
