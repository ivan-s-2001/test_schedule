import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Самостоятельная регистрация отключена" },
    { status: 403 }
  );
}
