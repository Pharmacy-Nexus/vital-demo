import { redirect } from "next/navigation";

export default function DocumentsPage() {
  redirect("/dashboard/record?tab=files");
}
