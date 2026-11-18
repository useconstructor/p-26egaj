import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/**
 * Owner access foundation (server only — never import from a client component).
 * The platform provisions OWNER_ACCESS_CODE and JWT_SECRET for every database project.
 * The owner signs in by entering that code; there is no sign-up, no seeded owner row
 * and no default password. Reuse this module instead of writing new owner auth.
 */
export const OWNER_COOKIE = "owner_session";
const SESSION_MS = 12 * 60 * 60 * 1000;

function secret(): string {
  const value = process.env.JWT_SECRET || process.env.OWNER_ACCESS_CODE;
  if (!value) throw new Error("Owner access is not configured");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function equal(a: string, b: string): boolean {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Timing-safe comparison of a submitted code with the provisioned OWNER_ACCESS_CODE. */
export function ownerCodeMatches(code: unknown): boolean {
  const expected = process.env.OWNER_ACCESS_CODE;
  if (!expected || typeof code !== "string") return false;
  const a = createHmac("sha256", "owner-code").update(code.trim()).digest();
  const b = createHmac("sha256", "owner-code").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Opaque signed token: "<expiresAt>.<signature>". */
export function createOwnerToken(now = Date.now()): string {
  const expiresAt = String(now + SESSION_MS);
  return `${expiresAt}.${sign(expiresAt)}`;
}

export function ownerTokenValid(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [expiresAt, signature] = token.split(".");
  if (!expiresAt || !signature || !/^\d+$/.test(expiresAt) || Number(expiresAt) < now) return false;
  try { return equal(signature, sign(expiresAt)); } catch { return false; }
}

export const ownerCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MS / 1000,
};

/** True when the current request carries a valid owner session (server components and route handlers). */
export async function isOwner(): Promise<boolean> {
  const store = await cookies();
  return ownerTokenValid(store.get(OWNER_COOKIE)?.value);
}

/** For route handlers: a 401 Response when the caller is not the owner, otherwise null. */
export async function requireOwner(): Promise<Response | null> {
  if (await isOwner()) return null;
  return Response.json({ error: "Inicia sesión como dueño para continuar." }, { status: 401, headers: { "Cache-Control": "no-store" } });
}

// Sign-in is the one abuse-prone endpoint: bound failed attempts per client.
const failures = new Map<string, { count: number; resetAt: number }>();
export function signInAllowed(client: string, now = Date.now()): boolean {
  const entry = failures.get(client);
  return !entry || entry.resetAt < now || entry.count < 10;
}
export function recordSignInFailure(client: string, now = Date.now()): void {
  const entry = failures.get(client);
  if (!entry || entry.resetAt < now) failures.set(client, { count: 1, resetAt: now + 15 * 60 * 1000 });
  else entry.count++;
}
