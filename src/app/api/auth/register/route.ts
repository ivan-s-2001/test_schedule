import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  companyName: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, password, firstName, lastName, companyName } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Email already exists" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, passwordHash, firstName, lastName },
    });

    const org = await tx.organization.create({
      data: {
        name: companyName,
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
            isActive: true,
            isActivated: true,
          },
        },
        divisions: {
          create: {
            title: "Alle",
            description: "Standard-Arbeitsbereich",
            isSystem: true,
          },
        },
      },
    });

    return { user, org };
  });

  return NextResponse.json(
    { userId: result.user.id, orgId: result.org.id },
    { status: 201 }
  );
}
