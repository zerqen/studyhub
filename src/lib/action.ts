import { getUserId } from "./session";
import { revalidatePath } from "next/cache";

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

export async function withUser<T>(fn: (userId: string) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const userId = await getUserId();
    const data = await fn(userId);
    return { ok: true, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Неизвестная ошибка";
    if (message === "unauthorized") return { ok: false, error: "Нужно войти в аккаунт" };
    return { ok: false, error: message };
  }
}

export function refreshAll() {
  revalidatePath("/", "layout");
}
