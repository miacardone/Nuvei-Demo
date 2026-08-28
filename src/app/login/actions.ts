"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  createSessionValue,
  sessionCookieOptions,
  verifyCredentials,
} from "@/lib/auth";

export type LoginState = { error?: string };

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!verifyCredentials(username, password)) {
    // Deliberately vague: never reveal which of the two was wrong.
    return { error: "Incorrect username or password." };
  }

  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSessionValue(username), sessionCookieOptions);
  redirect("/");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
