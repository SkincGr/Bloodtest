import { redirect } from "next/navigation";

// Default page: redirect to blood exams archive
export default function DefaultPage() {
  redirect("/tests");
}
