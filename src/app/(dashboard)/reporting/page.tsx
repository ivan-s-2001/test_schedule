import { redirect } from "next/navigation";

export default function ReportingPage() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  redirect(`/reporting/${month}-${year}`);
}
