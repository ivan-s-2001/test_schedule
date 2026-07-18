import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const rawEmail = params.email;
  const email = Array.isArray(rawEmail) ? rawEmail[0] : rawEmail;

  redirect(email ? `/?email=${encodeURIComponent(email)}` : "/");
}
