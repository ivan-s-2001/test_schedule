import { EmailAccessGate } from "@/components/auth/email-access-gate";

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const rawEmail = params.email;
  const email = Array.isArray(rawEmail) ? rawEmail[0] ?? null : rawEmail ?? null;

  return <EmailAccessGate email={email} />;
}
