"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  createSessionValue,
  isAuthConfigured,
  sessionCookieOptions,
  verifyCredentials,
} from "@/lib/auth";

export type LoginState = { error?: string };

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  // Trimmed: a trailing space picked up when pasting a credential is the most
  // common cause of a "correct" password being rejected.
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!isAuthConfigured()) {
    return {
      error:
        "Sign-in is not configured on the server. Set DEMO_PASSWORD in .env.local and restart the dev server.",
    };
  }

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
