"use client";

import { createCertificationRule } from "@/lib/actions/admin";
import { useRouter } from "next/navigation";

export function CertRuleForm({
  courses,
}: {
  courses: { id: string; title: string }[];
}) {
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await createCertificationRule(
      fd.get("courseId") as string,
      fd.get("title") as string,
      Number(fd.get("validityMonths")),
    );
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 rounded-xl border bg-white p-4">
      <select name="courseId" required className="rounded border px-2 py-1">
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
      <input name="title" placeholder="Certification title" required className="rounded border px-2 py-1" />
      <input name="validityMonths" type="number" defaultValue={12} className="w-24 rounded border px-2 py-1" />
      <button type="submit" className="rounded bg-storm-pink px-3 py-1 text-sm text-white">
        Add rule
      </button>
    </form>
  );
}
