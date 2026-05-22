import { PageHeader } from "@/components/ui/PageHeader";
import { NewExamForm } from "./NewExamForm";
import { listCoursesForExam, listUsersForAssignment } from "@/lib/actions/exams-admin";

export const metadata = { title: "New exam" };

export default async function NewExamPage() {
  const [courses, users] = await Promise.all([
    listCoursesForExam(),
    listUsersForAssignment(),
  ]);

  return (
    <>
      <PageHeader title="Create exam" description="Configure settings and assign learners." />
      <NewExamForm courses={courses} users={users} />
    </>
  );
}
