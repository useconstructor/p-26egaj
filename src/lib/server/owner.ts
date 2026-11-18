import { ApiError, body, dateValid, integer, invalid, json, missing, policy, query, transaction, uuid } from "./core";
import { requireSession } from "./auth";
import { products } from "./catalog";
import { readOrder } from "./orders";
const states = ["recibido", "en_preparacion", "listo", "entregado"];
export async function agenda(request: Request) {
  const search = query(request, ["fecha"]); await requireSession(request, "owner");
  const now = new Date(); const date = search.get("fecha") || policy(now).today;
  if (!dateValid(date)) invalid({ fecha: "Fecha no válida." });
  const orders = await transaction(async tx => {
    await requireSession(request, "owner", false, tx);
    const rows = await tx.execute({ sql: "SELECT o.id FROM md_orders o JOIN md_slots s ON s.id=o.slot_id WHERE s.date=? ORDER BY s.time,o.created_at,o.id", args: [date] });
    const list = []; for (const row of rows.rows) list.push(await readOrder(tx, String(row.id)));
    return list;
  }, "read");
  return json({ date, serverNow: now.toISOString(), orders });
}
export async function changeStatus(request: Request) {
  query(request, []); await requireSession(request, "owner", true);
  const input = await body(request, ["id", "expectedVersion", "fromStatus", "toStatus"]);
  const id = uuid(input.id, "id"), version = integer(input.expectedVersion, "expectedVersion", 1);
  if (typeof input.fromStatus !== "string" || !states.includes(input.fromStatus)) invalid({ fromStatus: "Estado no válido." });
  if (typeof input.toStatus !== "string" || !states.includes(input.toStatus)) invalid({ toStatus: "Estado no válido." });
  const result = await transaction(async tx => {
    await requireSession(request, "owner", true, tx);
    const current = await readOrder(tx, id);
    if (current.version !== version) throw new ApiError(409, "ORDER_VERSION", "El pedido cambió. Revisa su estado actual.", undefined, { order: current });
    if (current.status !== input.fromStatus || states.indexOf(input.toStatus as string) !== states.indexOf(current.status) + 1) throw new ApiError(409, "TRANSITION", "Solo puedes avanzar al siguiente estado del pedido.", undefined, { order: current });
    const updated = await tx.execute({ sql: "UPDATE md_orders SET status=?,version=version+1 WHERE id=? AND version=? AND status=?", args: [input.toStatus as string, id, version, input.fromStatus as string] });
    if (updated.rowsAffected !== 1) throw new ApiError(409, "ORDER_VERSION", "El pedido cambió.", undefined, { order: await readOrder(tx, id) });
    await tx.execute({ sql: "INSERT INTO md_order_history(order_id,version,from_status,to_status,created_at) VALUES(?,?,?,?,?)", args: [id, version + 1, current.status, input.toStatus as string, new Date().toISOString()] });
    return readOrder(tx, id);
  });
  return json({ order: result });
}
export async function ownerProducts(request: Request) { query(request, []); await requireSession(request, "owner"); return json({ products: await products() }); }
export async function changeProduct(request: Request) {
  query(request, []); await requireSession(request, "owner", true);
  const input = await body(request, ["id", "expectedRevision", "available"]);
  if (typeof input.id !== "string" || !/^[a-z0-9-]{1,64}$/.test(input.id)) invalid({ id: "Producto no válido." });
  const revision = integer(input.expectedRevision, "expectedRevision", 1);
  if (typeof input.available !== "boolean") invalid({ available: "Indica si está disponible." });
  const product = await transaction(async tx => {
    await requireSession(request, "owner", true, tx);
    const current = (await products(tx)).find(p => p.id === input.id); if (!current) missing();
    if (current.revision !== revision) throw new ApiError(409, "PRODUCT_CHANGED", "El producto cambió. Revisa la versión actual.", undefined, { product: current, products: [current] });
    if (current.available === input.available) return current;
    await tx.execute({ sql: `INSERT INTO md_product_revisions(product_id,revision,name,category,presentation,unit_price,presentation_id,presentation_version) SELECT product_id,revision+1,name,category,presentation,unit_price,presentation_id,presentation_version FROM md_product_revisions WHERE product_id=? AND revision=?`, args: [current.id, revision] });
    const updated = await tx.execute({ sql: "UPDATE md_products SET available=?,current_revision=current_revision+1,version=version+1 WHERE id=? AND current_revision=?", args: [input.available ? 1 : 0, current.id, revision] });
    if (updated.rowsAffected !== 1) throw new ApiError(409, "PRODUCT_CHANGED", "El producto cambió.");
    return { ...current, available: input.available, revision: revision + 1 };
  });
  return json({ product });
}
