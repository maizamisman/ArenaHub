"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/auth/request";
import { checkAccess } from "@/auth/guard";
import { moderatePhoto } from "@/data/photos";

export async function moderate(photoId: string, action: "approve" | "remove" | "restore"): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (checkAccess(user, "staff") !== "ok") return { ok: false, error: "Your session has ended. Sign in again." };
  try {
    moderatePhoto(user!.id, photoId, action);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
  revalidatePath("/photos");
  return { ok: true };
}
