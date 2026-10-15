import { redirect } from "next/navigation";

// Default page: the app opens on Ιστορικό
export default function DefaultPage() {
  redirect("/illnesses");
}
