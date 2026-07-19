import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/auth-helpers";

const replySchema = z.object({
  body: z.string().min(1),
});

// POST /api/messages/[id]/reply — reply to a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;

  // Find the parent message
  const parent = await db.message.findFirst({
    where: {
      id,
      organizationId: member.organizationId,
      OR: [
        { senderId: member.user.id },
        { recipients: { some: { userId: member.user.id } } },
      ],
    },
    include: {
      recipients: { select: { userId: true } },
    },
  });

  if (!parent) {
    return NextResponse.json({ error: "Parent message not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = replySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ошибка проверки данных", details: parsed.error.issues },
      { status: 400 }
    );
  }

  // Reply goes to the original sender + all original recipients (minus the current user)
  const recipientIds = new Set<string>();
  recipientIds.add(parent.senderId);
  for (const r of parent.recipients) {
    recipientIds.add(r.userId);
  }
  recipientIds.delete(member.user.id); // Don't send to yourself

  const reply = await db.message.create({
    data: {
      organizationId: member.organizationId,
      senderId: member.user.id,
      subject: parent.subject.startsWith("Re: ") ? parent.subject : `Re: ${parent.subject}`,
      body: parsed.data.body,
      parentId: id,
      recipients: {
        create: Array.from(recipientIds).map((userId) => ({
          userId,
          isRead: false,
          isDeleted: false,
        })),
      },
    },
    include: {
      sender: {
        select: { id: true, firstName: true, lastName: true, profileImage: true },
      },
      recipients: {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
    },
  });

  return NextResponse.json({ message: reply }, { status: 201 });
}
