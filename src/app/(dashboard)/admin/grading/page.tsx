import { redirect } from "next/navigation";

export default function GradingInboxRedirect() {
  redirect("/admin/grades?view=pending");
}
