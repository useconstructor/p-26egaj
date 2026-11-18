import "server-only";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import type { Client, Transaction } from "@libsql/client";
import { db } from "@/lib/db";
import { ensureSchema } from "./schema";
export type Executor = Pick<Client | Transaction, "execute">;
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: Record<string, string>, public current?: object) { super(message); }
}
export function invalid(fields: Record<string, string>): never { throw new ApiError(400, "VALIDATION", "Revisa los campos indicados.", fields); }
export function missing(): never { throw new ApiError(404, "NOT_FOUND", "No encontramos el pedido solicitado."); }
export function json(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store", "Vary": "Cookie, Origin" } }); }
export function route(fn: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try { await ensureSchema(); return await fn(request); }
    catch (error) {
      if (error instanceof ApiError) return json({ error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}), ...(error.current ? { current: error.current } : {}) } }, error.status);
      return json({ error: { code: "UNAVAILABLE", message: "No pudimos completar la solicitud. Conserva tus datos e inténtalo de nuevo." } }, 503);
    }
  };
}
export async function transaction<T>(fn: (tx: Transaction) => Promise<T>, mode: "write" | "read" = "write"): Promise<T> {
  const tx = await db.transaction(mode);
  try { const result = await fn(tx); await tx.commit(); return result; }
  catch (error) { await tx.rollback(); throw error; } finally { tx.close(); }
}
export function strict(value: unknown, keys: string[], required = keys): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid({ body: "Se requiere un objeto JSON." });
  const object = value as Record<string, unknown>;
  const fields: Record<string, string> = Object.create(null);
  for (const key of Object.keys(object)) if (!keys.includes(key)) fields[key] = "Campo no permitido.";
  for (const key of required) if (!Object.prototype.hasOwnProperty.call(object, key)) fields[key] = "Campo obligatorio.";
  if (Object.keys(fields).length) invalid(fields);
  return object;
}
export async function body(request: Request, keys: string[], required = keys) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) invalid({ body: "Envía contenido JSON." });
  if (Number(request.headers.get("content-length") || 0) > 16384) invalid({ body: "Solicitud demasiado grande." });
  const reader = request.body?.getReader();
  if (!reader) invalid({ body: "Se requiere contenido JSON." });
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 16384) { await reader.cancel(); invalid({ body: "Solicitud demasiado grande." }); } chunks.push(part.value); }
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { invalid({ body: "JSON no válido." }); }
  return strict(parsed, keys, required);
}
export function query(request: Request, keys: string[]) {
  const search = new URL(request.url).searchParams;
  for (const key of search.keys()) if (!keys.includes(key) || search.getAll(key).length !== 1) invalid({ [key]: "Parámetro no permitido o repetido." });
  return search;
}
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export function uuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) invalid({ [field]: "Identificador no válido." });
  return value;
}
export function integer(value: unknown, field: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) invalid({ [field]: `Usa un entero entre ${min} y ${max}.` });
  return value;
}
export function dateValid(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function policy(now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const lastDate = new Date(Date.parse(`${today}T00:00:00Z`) + 30 * 86400000).toISOString().slice(0, 10);
  return { timezone: "America/Bogota", today, lastDate, minNoticeMinutes: 60, firstTime: "10:00", lastTime: "18:00", capacity: 6 };
}
export function pickupDate(value: unknown, now = new Date()): string {
  const p = policy(now);
  if (typeof value !== "string" || !dateValid(value) || value < p.today || value > p.lastDate) invalid({ date: "Elige una fecha desde hoy hasta 30 días después." });
  return value;
}
export const eligible = (date: string, time: string, now = new Date()) => Date.parse(`${date}T${time}:00-05:00`) >= now.getTime() + 3600000;
export const slotId = (date: string, time: string) => `${date}_${time}`;
