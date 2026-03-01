"use client";

import { use } from "react";
import { redirect } from "next/navigation";
import { HoursTable } from "@/components/reporting/hours-table";

interface ReportingMonthPageProps {
  params: Promise<{ month: string }>;
}

function parseMonthParam(param: string): { month: number; year: number } | null {
  const match = param.match(/^(\d{1,2})-(\d{4})$/);
  if (!match) return null;
  const month = parseInt(match[1], 10);
  const year = parseInt(match[2], 10);
  if (month < 1 || month > 12) return null;
  return { month, year };
}

export default function ReportingMonthPage({ params }: ReportingMonthPageProps) {
  const { month: monthParam } = use(params);
  const parsed = parseMonthParam(monthParam);

  if (!parsed) {
    const now = new Date();
    redirect(`/reporting/${now.getMonth() + 1}-${now.getFullYear()}`);
  }

  return <HoursTable month={parsed.month} year={parsed.year} />;
}
