import { apiUrl } from "./apiUrl";

export interface AuthUser {
  email: string;
  [key: string]: unknown;
}

interface Tokens {
  accessToken: string;
  refreshToken: string | null;
}

const STORAGE_KEY = "arcair.auth";

function loadTokens(): Tokens | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

let tokens: Tokens | null = loadTokens();

function setTokens(next: Tokens | null) {
  tokens = next;
  try {
    if (next) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode); the in-memory session still works.
  }
}

export function hasSession(): boolean {
  return tokens !== null;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      detail?: unknown;
      message?: string;
    };
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) {
      const first = body.detail[0] as { msg?: string } | undefined;
      if (first?.msg) return first.msg;
    }
    if (body.message) return body.message;
  } catch {
    // Non-JSON error body: use the status fallback below.
  }
  if (response.status === 401) return "Invalid email or password.";
  return `Request failed with status ${response.status}`;
}

function readTokens(body: Record<string, unknown>): Tokens | null {
  const access = body.access_token ?? body.accessToken ?? body.token;
  if (typeof access !== "string" || !access) return null;
  const refresh = body.refresh_token ?? body.refreshToken;
  return {
    accessToken: access,
    refreshToken: typeof refresh === "string" ? refresh : null,
  };
}

async function post(
  path: string,
  body?: unknown,
  authorized = false,
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (authorized && tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;
  return fetch(apiUrl(path), {
    method: "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

let refreshing: Promise<boolean> | null = null;

/** Exchanges the refresh token for new tokens; clears the session on failure. */
export function refreshSession(): Promise<boolean> {
  if (!tokens?.refreshToken) {
    setTokens(null);
    return Promise.resolve(false);
  }
  refreshing ??= (async () => {
    try {
      const response = await post("/auth/refresh", {
        refresh_token: tokens?.refreshToken,
      });
      if (!response.ok) {
        setTokens(null);
        return false;
      }
      const next = readTokens(await response.json());
      if (!next) {
        setTokens(null);
        return false;
      }
      setTokens({ ...next, refreshToken: next.refreshToken ?? tokens?.refreshToken ?? null });
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** fetch with the Bearer token; retries once after a refresh on 401. */
export async function authFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const send = () =>
    fetch(apiUrl(path), {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.headers as Record<string, string> | undefined),
        ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
      },
    });
  const response = await send();
  if (response.status === 401 && (await refreshSession())) return send();
  return response;
}

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await authFetch("/auth/me");
  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()) as AuthUser;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await post("/auth/login", { email, password });
  if (!response.ok) throw new Error(await errorMessage(response));
  const next = readTokens(await response.json());
  if (!next) throw new Error("Login succeeded but no access token was returned.");
  setTokens(next);
  try {
    return await getCurrentUser();
  } catch (error) {
    setTokens(null);
    throw error;
  }
}

export async function register(
  email: string,
  password: string,
  fullName?: string,
): Promise<void> {
  const response = await post("/auth/register", {
    email,
    password,
    ...(fullName ? { display_name: fullName } : {}),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
}

export async function logout(): Promise<void> {
  try {
    await authFetch("/auth/logout", { method: "POST" });
  } catch {
    // The local session is cleared regardless of the network result.
  } finally {
    setTokens(null);
  }
}

export async function verifyEmail(token: string): Promise<void> {
  const response = await post("/auth/verify-email", { token });
  if (!response.ok) throw new Error(await errorMessage(response));
}

export async function resendVerification(email: string): Promise<void> {
  const response = await post("/auth/resend-verification", { email });
  if (!response.ok) throw new Error(await errorMessage(response));
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const response = await authFetch("/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
}
