"use server";

import { z } from "zod";
import { action } from "@/server/auth/action";

export const markAllNotificationsReadAction = action({ capability: null, schema: z.object({}) }, async (ctx) => {
  await ctx.db.notification.updateMany({
    where: { recipientUserId: ctx.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return { ok: true };
});

export const markNotificationReadAction = action(
  { capability: null, schema: z.object({ id: z.string().min(1).max(40) }) },
  async (ctx, input) => {
    await ctx.db.notification.updateMany({
      where: { id: input.id, recipientUserId: ctx.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  },
);
