import { db } from "@/lib/db";
import { ApiError, type Executor, body, dateValid, eligible, integer, invalid, json, pickupDate, query, slotId, strict, transaction } from "./core";
import { products, type Product } from "./catalog";
import { requireSession } from "./auth";
export type Draft = { items: { productId: string; quantity: number; productRevision: number }[]; date: string; time: string; name: string; phone: string; note: string };
export type Line = { productId: string; productRevision: number; presentationId: string; presentationVersion: number; name: string; presentation: string; quantity: number; unitPrice: number; subtotal: number };
export const emptyDraft = (): Draft => ({ items: [], date: "", time: "", name: "", phone: "", note: "" });
export function validateDraft(value: unknown, complete: boolean, now = new Date(), checkTime = true): Draft {
  const draft = strict(value, ["items", "date", "time", "name", "phone", "note"]);
  const fields: Record<string, string> = Object.create(null);
  if (!Array.isArray(draft.items) || draft.items.length > 4 || (complete && draft.items.length === 0)) fields.items = "Elige entre uno y cuatro productos.";
  const items: Draft["items"] = []; const seen = new Set<string>(); let units = 0;
  if (Array.isArray(draft.items)) for (const [index, value] of draft.items.entries()) {
    const item = strict(value, ["productId", "quantity", "productRevision"]);
    if (typeof item.productId !== "string" || !/^[a-z0-9-]{1,64}$/.test(item.productId)) fields[`items.${index}.productId`] = "Producto no válido.";
    else if (seen.has(item.productId)) fields[`items.${index}.productId`] = "No repitas un producto.";
    else seen.add(item.productId);
    if (typeof item.quantity !== "number" || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) fields[`items.${index}.quantity`] = "Usa una cantidad entera entre 1 y 99.";
    else units += item.quantity;
    if (typeof item.productRevision !== "number" || !Number.isSafeInteger(item.productRevision) || item.productRevision < 1) fields[`items.${index}.productRevision`] = "Revisión no válida.";
    items.push({ productId: item.productId as string, quantity: item.quantity as number, productRevision: item.productRevision as number });
  }
  if (units > 198) fields.items = "El máximo por pedido es de 198 unidades.";
  for (const key of ["date", "time", "name", "phone", "note"] as const) if (typeof draft[key] !== "string") fields[key] = "Se requiere texto.";
  if (typeof draft.name === "string" && ((complete && !draft.name.length) || draft.name.length > 100 || (draft.name.length > 0 && !draft.name.trim()))) fields.name = "Escribe un nombre de 1 a 100 caracteres, no solo espacios.";
  if (typeof draft.phone === "string" && ((complete || draft.phone.length > 0) && !/^3[0-9]{9}$/.test(draft.phone))) fields.phone = "Escribe diez dígitos, comenzando por 3.";
  if (typeof draft.note === "string" && draft.note.length > 500) fields.note = "La nota admite hasta 500 caracteres.";
  if (typeof draft.date === "string" && (complete || draft.date.length > 0)) {
    try { if (checkTime) pickupDate(draft.date, now); else if (!dateValid(draft.date)) throw new Error("date"); } catch { fields.date = "Elige una fecha desde hoy hasta 30 días después."; }
  }
  if (typeof draft.time === "string" && (complete || draft.time.length > 0) && !/^(1[0-8]):00$/.test(draft.time)) fields.time = "Elige una franja horaria entre 10:00 y 18:00.";
  if (checkTime && !fields.date && !fields.time && draft.date && draft.time && !eligible(String(draft.date), String(draft.time), now)) fields.time = "La recogida requiere al menos una hora de anticipación.";
  if (Object.keys(fields).length) invalid(fields);
  return { items, date: draft.date as string, time: draft.time as string, name: draft.name as string, phone: draft.phone as string, note: draft.note as string };
}
export function canonical(draft: Draft) {
  return JSON.stringify({ items: [...draft.items].sort((a, b) => a.productId.localeCompare(b.productId)).map(i => ({ productId: i.productId, quantity: i.quantity, productRevision: i.productRevision })), date: draft.date, time: draft.time, name: draft.name, phone: draft.phone, note: draft.note });
}
export function line(product: Product, quantity: number): Line { return { productId: product.id, productRevision: product.revision, presentationId: product.presentationId, presentationVersion: product.presentationVersion, name: product.name, presentation: product.presentation, quantity, unitPrice: product.unitPrice, subtotal: product.unitPrice * quantity }; }
export async function currentLines(tx: Executor, draft: Draft, requireAvailable = true): Promise<Line[]> {
  const list = await products(tx); const fields: Record<string, string> = Object.create(null);
  for (const [index, item] of draft.items.entries()) if (!list.some(p => p.id === item.productId)) fields[`items.${index}.productId`] = "El producto no existe.";
  if (Object.keys(fields).length) invalid(fields);
  const changed = list.filter(p => draft.items.some(i => i.productId === p.id && (i.productRevision !== p.revision || (requireAvailable && !p.available))));
  if (changed.length) throw new ApiError(409, "PRODUCT_CHANGED", "Cambió la disponibilidad o la revisión. Conserva tu selección y revisa los valores actuales.", undefined, { products: changed });
  return draft.items.map(item => line(list.find(p => p.id === item.productId)!, item.quantity));
}
async function historicalPreview(tx: Executor, draft: Draft) {
  if (!draft.items.length) return null;
  const lines: Line[] = [];
  for (const item of draft.items) {
    const result = await tx.execute({ sql: "SELECT * FROM md_product_revisions WHERE product_id=? AND revision=?", args: [item.productId, item.productRevision] });
    const row = result.rows[0]; if (!row) return null;
    lines.push({ productId: item.productId, productRevision: item.productRevision, presentationId: String(row.presentation_id), presentationVersion: Number(row.presentation_version), name: String(row.name), presentation: String(row.presentation), quantity: item.quantity, unitPrice: Number(row.unit_price), subtotal: item.quantity * Number(row.unit_price) });
  }
  return { lines, total: lines.reduce((sum, l) => sum + l.subtotal, 0) };
}
export async function readDraft(tx: Executor, sessionId: string) {
  const result = await tx.execute({ sql: "SELECT * FROM md_drafts WHERE session_id=?", args: [sessionId] });
  const row = result.rows[0];
  const draft: Draft = row ? JSON.parse(String(row.payload_json)) : emptyDraft();
  return { version: row ? Number(row.version) : 0, draft, preview: await historicalPreview(tx, draft), updatedAt: row ? String(row.updated_at) : null };
}
export async function assertDraft(tx: Executor, sessionId: string, version: number, draft: Draft) {
  const current = await readDraft(tx, sessionId);
  if (current.version !== version || canonical(current.draft) !== canonical(draft)) throw new ApiError(409, "DRAFT_VERSION", "El borrador cambió. Compara tu edición con la versión guardada.", undefined, current);
}
export async function checkSlot(tx: Executor, draft: Draft) {
  const id = slotId(draft.date, draft.time);
  const result = await tx.execute({ sql: "SELECT occupied,capacity FROM md_slots WHERE id=?", args: [id] });
  const row = result.rows[0];
  if (row && Number(row.occupied) >= Number(row.capacity)) throw new ApiError(409, "SLOT_FULL", "Esta franja está completa. Elige otra franja.", undefined, { slot: { id, date: draft.date, time: draft.time, occupied: Number(row.occupied), capacity: 6, available: false } });
  return { date: draft.date, time: draft.time, slotId: id };
}
export async function getDraft(request: Request) {
  query(request, []);
  return json(await transaction(async tx => { const active = await requireSession(request, "visitor", false, tx); return readDraft(tx, active.id); }, "read"));
}
export async function putDraft(request: Request) {
  query(request, []); await requireSession(request, "visitor", true);
  const input = await body(request, ["expectedVersion", "draft"]);
  const version = integer(input.expectedVersion, "expectedVersion");
  const draft = validateDraft(input.draft, false);
  const result = await transaction(async tx => {
    const active = await requireSession(request, "visitor", true, tx);
    const current = await readDraft(tx, active.id);
    if (version !== current.version) throw new ApiError(409, "DRAFT_VERSION", "El borrador cambió. Compara las versiones antes de guardar.", undefined, current);
    validateDraft(draft, false);
    await currentLines(tx, draft);
    const updatedAt = new Date().toISOString();
    const saved = await tx.execute({ sql: `INSERT INTO md_drafts(session_id,version,payload_json,updated_at) VALUES(?,1,?,?) ON CONFLICT(session_id) DO UPDATE SET version=version+1,payload_json=excluded.payload_json,updated_at=excluded.updated_at WHERE version=?`, args: [active.id, canonical(draft), updatedAt, version] });
    if (saved.rowsAffected !== 1) throw new ApiError(409, "DRAFT_VERSION", "El borrador cambió.", undefined, await readDraft(tx, active.id));
    return readDraft(tx, active.id);
  });
  return json(result);
}
export async function reviewDraft(request: Request) {
  query(request, []); const active = await requireSession(request, "visitor", true);
  const input = await body(request, ["draftVersion", "draft"]);
  const version = integer(input.draftVersion, "draftVersion");
  const draft = validateDraft(input.draft, true);
  // A read transaction gives one coherent snapshot and makes review business-read-only.
  const tx = await db.transaction("read");
  try {
    const lines = await currentLines(tx, draft);
    await assertDraft(tx, active.id, version, draft);
    const pickup = await checkSlot(tx, draft);
    await tx.commit(); return json({ draftVersion: version, lines, total: lines.reduce((sum, l) => sum + l.subtotal, 0), pickup });
  } catch (error) { await tx.rollback(); throw error; } finally { tx.close(); }
}
