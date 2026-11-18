import { db } from "@/lib/db";
import { type Executor, eligible, invalid, json, pickupDate, policy, query, slotId, transaction } from "./core";
export type Product = { id: string; name: string; category: string; presentation: string; unitPrice: number; available: boolean; revision: number; presentationId: string; presentationVersion: number; position: number };
export async function products(executor: Executor = db): Promise<Product[]> {
  const result = await executor.execute(`SELECT p.id,p.available,p.position,r.* FROM md_products p JOIN md_product_revisions r ON r.product_id=p.id AND r.revision=p.current_revision ORDER BY p.position`);
  return result.rows.map(row => ({ id: String(row.id), name: String(row.name), category: String(row.category), presentation: String(row.presentation), unitPrice: Number(row.unit_price), available: Boolean(row.available), revision: Number(row.revision), presentationId: String(row.presentation_id), presentationVersion: Number(row.presentation_version), position: Number(row.position) }));
}
export async function getCatalog(request: Request) {
  const search = query(request, ["filtro", "disponibilidad"]);
  const filter = search.get("filtro") ?? "todos", availability = search.get("disponibilidad") ?? "todos";
  if (!["todos", "tortas", "postres"].includes(filter)) invalid({ filtro: "Filtro no válido." });
  if (!["todos", "disponibles", "pausados"].includes(availability)) invalid({ disponibilidad: "Filtro no válido." });
  const list = (await products()).filter(p => (filter === "todos" || p.category === filter) && (availability === "todos" || p.available === (availability === "disponibles")));
  const now = new Date(); return json({ products: list, serverNow: now.toISOString(), policy: policy(now) });
}
export async function ensureSlots(executor: Executor, date: string) {
  for (let hour = 10; hour <= 18; hour++) {
    const time = `${hour}:00`;
    await executor.execute({ sql: "INSERT OR IGNORE INTO md_slots(id,date,time,occupied,capacity) VALUES(?,?,?,0,6)", args: [slotId(date, time), date, time] });
  }
}
export async function getAvailability(request: Request) {
  const search = query(request, ["fecha"]); const now = new Date(); const p = policy(now);
  const date = pickupDate(search.get("fecha") || p.today, now);
  const slots = await transaction(async tx => {
    await ensureSlots(tx, date);
    const result = await tx.execute({ sql: "SELECT * FROM md_slots WHERE date=? ORDER BY time", args: [date] });
    return result.rows.map(row => {
      const time = String(row.time); const occupied = Number(row.occupied);
      const reason = !eligible(date, time, now) ? "anticipacion" : occupied >= 6 ? "completa" : null;
      return { id: String(row.id), date, time, occupied, capacity: 6, available: reason === null, reason };
    });
  });
  const next = slots.find(s => s.available);
  return json({ date, serverNow: now.toISOString(), policy: p, slots, nextAvailable: next ? { id: next.id, date, time: next.time } : null });
}
