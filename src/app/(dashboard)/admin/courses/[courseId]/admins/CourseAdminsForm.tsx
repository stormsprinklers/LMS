"use client";

import { assignCourseAdmin, removeCourseAdmin } from "@/lib/actions/exams-admin";
import { UserAssignmentList } from "@/components/ui/UserAssignmentList";
import { useRouter } from "next/navigation";

export function CourseAdminsForm({
  courseId,
  users,
  adminUserIds,
}: {
  courseId: string;
  users: { id: string; email: string; name: string | null }[];
  adminUserIds: string[];
}) {
  const router = useRouter();
  const adminSet = new Set(adminUserIds);

  return (
    <div className="w-full max-w-lg rounded-xl border bg-white p-4 sm:p-5">
      <UserAssignmentList
        users={users}
        assignedIds={adminSet}
        onToggle={async (userId, checked) => {
          if (checked) await assignCourseAdmin(courseId, userId);
          else await removeCourseAdmin(courseId, userId);
          router.refresh();
        }}
      />
    </div>
  );
}
