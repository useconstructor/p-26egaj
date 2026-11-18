import { cookies } from "next/headers";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { OWNER_COOKIE, createOwnerToken, isOwner, ownerCodeMatches } from "@/lib/owner-access";
import { ApiError, body, hash, json, query, transaction, type Executor } from "./core";

const VISITOR_COOKIE = "md_session";
const OWNER_NONCE_COOKIE = "md_owner";
const AGE_SECONDS = 12 * 60 * 60;
export type Session = { id: string; role: "visitor" | "owner"; csrfToken: string; expiresAt: string };
function trustedOrigins() {
  const origins = new Set<string>();
  if (process.env.APP_ORIGIN) origins.add(new URL(process.env.APP_ORIGIN).origin);
  if (process.env.VERCEL_URL) origins.add(new URL(`https://${process.env.VERCEL_URL}`).origin);
  if (!origins.size) throw new ApiError(503, "UNAVAILABLE", "El origen de la aplicación no está configurado.");
  return origins;
}
export function origin(request: Request) {
  const actual = request.headers.get("origin");
  if (!actual || !trustedOrigins().has(actual)) throw new ApiError(403, "FORBIDDEN", "El origen de la solicitud no está autorizado.");
}
export function cookieOptions(request: Request) {
  // Only configured origins decide security; Host and forwarded headers do not.
  const supplied = request.headers.get("origin");
  const configured = supplied && trustedOrigins().has(supplied) ? supplied : process.env.APP_ORIGIN || `https://${process.env.VERCEL_URL}`;
  const secure = new URL(configured).protocol === "https:";
  return { httpOnly: true, secure, sameSite: secure ? "none" as const : "lax" as const, partitioned: secure, path: "/", maxAge: AGE_SECONDS };
}
function csrf(rawToken: string) { return createHmac("sha256", rawToken).update("masa-dulce-csrf-v1").digest("base64url"); }
function equal(a: string, b: string) { const left = Buffer.from(a); const right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); }
async function rawCredential(role: "visitor" | "owner") {
  const store = await cookies();
  if (role === "visitor") return store.get(VISITOR_COOKIE)?.value;
  if (!(await isOwner())) return undefined;
  const foundation = store.get(OWNER_COOKIE)?.value;
  const nonce = store.get(OWNER_NONCE_COOKIE)?.value;
  return foundation && nonce ? `${foundation}:${nonce}` : undefined;
}
export async function session(role: "visitor" | "owner" = "visitor", executor: Executor = db): Promise<Session | null> {
  const token = await rawCredential(role);
  if (!token || token.length > 512) return null;
  const result = await executor.execute({ sql: "SELECT id,role,csrf_hash,expires_at FROM md_sessions WHERE token_hash=? AND role=? AND revoked_at IS NULL AND expires_at>?", args: [hash(token), role, new Date().toISOString()] });
  const row = result.rows[0];
  const csrfToken = csrf(token);
  if (!row || !equal(hash(csrfToken), String(row.csrf_hash))) return null;
  return { id: String(row.id), role, csrfToken, expiresAt: String(row.expires_at) };
}
export async function requireSession(request: Request, role: "visitor" | "owner" = "visitor", mutate = false, executor: Executor = db) {
  if (mutate) origin(request);
  const active = await session(role, executor);
  if (!active) throw new ApiError(401, "UNAUTHORIZED", role === "owner" ? "Inicia sesión para consultar la agenda." : "No se pudo verificar tu sesión. Recupera el acceso para continuar.");
  if (mutate && !equal(request.headers.get("x-csrf-token") || "", active.csrfToken)) throw new ApiError(403, "FORBIDDEN", "No se pudo verificar la solicitud. Recupera el acceso.");
  return active;
}
async function insertSession(tx: Executor, raw: string, role: "visitor" | "owner") {
  const value: Session = { id: randomUUID(), role, csrfToken: csrf(raw), expiresAt: new Date(Date.now() + AGE_SECONDS * 1000).toISOString() };
  await tx.execute({ sql: "INSERT INTO md_sessions(id,token_hash,csrf_hash,role,expires_at) VALUES(?,?,?,?,?)", args: [value.id, hash(raw), hash(value.csrfToken), role, value.expiresAt] });
  return value;
}
function visitorResult(active: Session) { return { authenticated: true, role: "visitor", csrfToken: active.csrfToken, expiresAt: active.expiresAt }; }
export async function getVisitor(request: Request) { query(request, []); return json(visitorResult(await requireSession(request))); }
export async function initializeVisitor(request: Request) {
  query(request, []); origin(request);
  const input = await body(request, ["recover"], []);
  if ("recover" in input && input.recover !== true) throw new ApiError(400, "VALIDATION", "Revisa la solicitud.", { recover: "La recuperación debe ser explícita." });
  const existing = await session();
  // Never rotate a still-valid identity (nor transfer any old records).
  if (existing) return json(visitorResult(existing));
  const previousCookie = (await cookies()).get(VISITOR_COOKIE)?.value;
  if (previousCookie && input.recover !== true) throw new ApiError(401, "UNAUTHORIZED", "La sesión anterior no está disponible. Recupera el acceso explícitamente.");
  const raw = randomBytes(32).toString("base64url");
  const active = await transaction(tx => insertSession(tx, raw, "visitor"));
  const response = json(visitorResult(active));
  response.cookies.set(VISITOR_COOKIE, raw, cookieOptions(request));
  return response;
}
export async function getOwner(request: Request) {
  query(request, []);
  const active = await session("owner");
  return json(active ? { owner: true, csrfToken: active.csrfToken } : { owner: false });
}
export async function loginOwner(request: Request) {
  query(request, []); origin(request);
  const input = await body(request, ["code"]);
  if (typeof input.code !== "string" || input.code.length > 1024) throw new ApiError(400, "VALIDATION", "Revisa el código.", { code: "Código no válido." });
  if (!process.env.OWNER_ACCESS_CODE) throw new ApiError(503, "UNAVAILABLE", "El acceso privado no está configurado.");
  const store = await cookies();
  const bucketToken = store.get("md_login")?.value;
  const bucket = bucketToken && /^[a-f0-9]{64}$/.test(bucketToken) ? bucketToken : randomBytes(32).toString("hex");
  // Keep the contracted attempt limit scoped to this login session.
  // An unrelated visitor must not lock every owner out of the application.
  const bucketKeys = [hash(`bucket:${bucket}`)];
  const now = Date.now();
  const result = await transaction(async tx => {
    for (const key of bucketKeys) {
      const found = await tx.execute({ sql: "SELECT count,window_start FROM md_login_attempts WHERE key_hash=?", args: [key] });
      const row = found.rows[0];
      if (row && Number(row.window_start) > now - 900000 && Number(row.count) >= 10) return { status: 429 } as const;
    }
    if (!ownerCodeMatches(input.code)) {
      for (const key of bucketKeys) await tx.execute({ sql: `INSERT INTO md_login_attempts(key_hash,count,window_start) VALUES(?,1,?) ON CONFLICT(key_hash) DO UPDATE SET count=CASE WHEN window_start<=? THEN 1 ELSE count+1 END,window_start=CASE WHEN window_start<=? THEN excluded.window_start ELSE window_start END`, args: [key, now, now - 900000, now - 900000] });
      return { status: 401 } as const;
    }
    const prior = await session("owner", tx);
    if (prior) await tx.execute({ sql: "UPDATE md_sessions SET revoked_at=? WHERE id=?", args: [new Date(now).toISOString(), prior.id] });
    const signed = createOwnerToken(now);
    const nonce = randomBytes(32).toString("base64url");
    const active = await insertSession(tx, `${signed}:${nonce}`, "owner");
    for (const key of bucketKeys) await tx.execute({ sql: "DELETE FROM md_login_attempts WHERE key_hash=?", args: [key] });
    return { status: 200, signed, nonce, active } as const;
  });
  let response: NextResponse;
  if (result.status !== 200) {
    response = json({ error: { code: result.status === 429 ? "RATE_LIMIT" : "UNAUTHORIZED", message: result.status === 429 ? "Demasiados intentos. Espera quince minutos antes de volver a intentar." : "El código de acceso no es correcto." } }, result.status);
    if (result.status === 429) response.headers.set("Retry-After", "900");
  } else {
    response = json({ owner: true, csrfToken: result.active.csrfToken });
    response.cookies.set(OWNER_COOKIE, result.signed, cookieOptions(request));
    response.cookies.set(OWNER_NONCE_COOKIE, result.nonce, cookieOptions(request));
  }
  response.cookies.set("md_login", bucket, cookieOptions(request));
  return response;
}
export async function logoutOwner(request: Request) {
  query(request, []);
  await transaction(async tx => { const active = await requireSession(request, "owner", true, tx); await tx.execute({ sql: "UPDATE md_sessions SET revoked_at=? WHERE id=?", args: [new Date().toISOString(), active.id] }); });
  const response = json({ owner: false });
  for (const name of [OWNER_COOKIE, OWNER_NONCE_COOKIE]) response.cookies.set(name, "", { ...cookieOptions(request), maxAge: 0 });
  return response;
}
