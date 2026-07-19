import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/auth-helpers";

// GET /api/messages/[id] — get message detail + mark as read
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;

  const message = await db.message.findFirst({
    where: {
      id,
      organizationId: member.organizationId,
      OR: [
        { senderId: member.user.id },
        { recipients: { some: { userId: member.user.id } } },
      ],
    },
    include: {
      sender: {
        select: { id: true, firstName: true, lastName: true, profileImage: true },
      },
      recipients: {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, profileImage: true },
          },
        },
      },
      replies: {
        include: {
          sender: {
            select: { id: true, firstName: true, lastName: true, profileImage: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!message) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Mark as read if user is a recipient
  await db.messageRecipient.updateMany({
    where: { messageId: id, userId: member.user.id },
    data: { isRead: true },
  });

  return NextResponse.json({ message });
}

// PATCH /api/messages/[id] — mark read/unread, trash, restore
const patchSchema = z.object({
  isRead: z.boolean().optional(),
  isDeleted: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ошибка проверки данных", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data: Record<string, boolean> = {};
  if (parsed.data.isRead !== undefined) data.isRead = parsed.data.isRead;
  if (parsed.data.isDeleted !== undefined) data.isDeleted = parsed.data.isDeleted;

  const updated = await db.messageRecipient.updateMany({
    where: { messageId: id, userId: member.user.id },
    data,
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/messages/[id] — permanently delete
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;

  // Only sender can permanently delete, or recipient removes their copy
  const message = await db.message.findFirst({
    where: { id, organizationId: member.organizationId },
  });

  if (!message) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (message.senderId === member.user.id) {
    // Sender deletes — remove the whole message
    await db.message.delete({ where: { id } });
  } else {
    // Recipient deletes their copy permanently
    await db.messageRecipient.deleteMany({
      where: { messageId: id, userId: member.user.id },
    });
  }

  return NextResponse.json({ success: true });
}
