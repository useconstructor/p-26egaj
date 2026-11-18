import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { ApiError, type Executor, body, hash, integer, json, missing, query, strict, transaction, uuid } from "./core";
import { requireSession, session } from "./auth";
import { assertDraft, canonical, checkSlot, currentLines, validateDraft } from "./drafts";

export async function readOrder(tx: Executor, id: string) {
  const result = await tx.execute({ sql: "SELECT o.*,s.date,s.time FROM md_orders o JOIN md_slots s ON s.id=o.slot_id WHERE o.id=?", args: [id] });
  const row = result.rows[0]; if (!row) missing();
  const lines = await tx.execute({ sql: "SELECT l.* FROM md_order_lines l JOIN md_products p ON p.id=l.product_id WHERE l.order_id=? ORDER BY p.position", args: [id] });
  const history = await tx.execute({ sql: "SELECT version,from_status,to_status,created_at FROM md_order_history WHERE order_id=? ORDER BY version", args: [id] });
  return {
    id: String(row.id), status: String(row.status), version: Number(row.version), name: String(row.name), phone: String(row.phone), note: String(row.note), total: Number(row.total), pickup: { date: String(row.date), time: String(row.time) },
    lines: lines.rows.map(l => ({ productId: String(l.product_id), productRevision: Number(l.product_revision), presentationId: String(l.presentation_id), presentationVersion: Number(l.presentation_version), name: String(l.name), presentation: String(l.presentation), quantity: Number(l.quantity), unitPrice: Number(l.unit_price), subtotal: Number(l.subtotal) })),
    history: history.rows.map(h => ({ version: Number(h.version), fromStatus: h.from_status === null ? null : String(h.from_status), toStatus: String(h.to_status), createdAt: String(h.created_at) })), createdAt: String(row.created_at),
  };
}
export async function getOrders(request: Request) {
  const search = query(request, ["id"]);
  const id = search.has("id") ? uuid(search.get("id"), "id") : null;
  const result = await transaction(async tx => {
    const owner = id ? await session("owner", tx) : null;
    const visitor = owner ? null : await requireSession(request, "visitor", false, tx);
    if (id) {
      const owned = await tx.execute({ sql: owner ? "SELECT id FROM md_orders WHERE id=?" : "SELECT id FROM md_orders WHERE id=? AND session_id=?", args: owner ? [id] : [id, visitor!.id] });
      if (!owned.rows.length) missing();
      return { order: await readOrder(tx, id) };
    }
    const rows = await tx.execute({ sql: "SELECT id FROM md_orders WHERE session_id=? ORDER BY created_at DESC,id", args: [visitor!.id] });
    const orders = []; for (const row of rows.rows) orders.push(await readOrder(tx, String(row.id)));
    return { orders };
  }, "read");
  return json(result);
}
export async function createOrder(request: Request) {
  query(request, []); await requireSession(request, "visitor", true);
  const input = await body(request, ["key", "draftVersion", "draft"]);
  const key = uuid(input.key, "key"), version = integer(input.draftVersion, "draftVersion");
  // Reject unknown/missing fields before lookup. Value validation belongs to new
  // operations: an existing key must identify its original immutable payload.
  const submitted = strict(input.draft, ["items", "date", "time", "name", "phone", "note"]);
  const items = Array.isArray(submitted.items)
    ? submitted.items.map(item => strict(item, ["productId", "quantity", "productRevision"]))
    : null;
  const comparable = {
    draftVersion: version,
    draft: {
      ...submitted,
      ...(items?.every(item => typeof item.productId === "string")
        ? { items: [...items].sort((a, b) => (a.productId as string).localeCompare(b.productId as string)) }
        : {}),
    },
  };
  const result = await transaction(async tx => {
    const active = await requireSession(request, "visitor", true, tx);
    const previous = await tx.execute({ sql: "SELECT payload_json,order_id FROM md_operations WHERE session_id=? AND key=?", args: [active.id, key] });
    const operation = previous.rows[0];
    if (operation) {
      if (!isDeepStrictEqual(JSON.parse(String(operation.payload_json)), comparable)) throw new ApiError(409, "IDEMPOTENCY_PAYLOAD", "Esta clave pertenece a otro envío. Recupera el pedido original o inicia una intención nueva.");
      const orderId = String(operation.order_id); return { status: 200, orderId, order: await readOrder(tx, orderId) };
    }
    const now = new Date();
    const draft = validateDraft(submitted, true, now);
    const payload = JSON.stringify({ draftVersion: version, draft: JSON.parse(canonical(draft)) });
    const payloadHash = hash(payload);
    const lines = await currentLines(tx, draft);
    await assertDraft(tx, active.id, version, draft);
    const pickup = await checkSlot(tx, draft);
    await tx.execute({ sql: "INSERT OR IGNORE INTO md_slots(id,date,time,occupied,capacity) VALUES(?,?,?,0,6)", args: [pickup.slotId, draft.date, draft.time] });
    const held = await tx.execute({ sql: "UPDATE md_slots SET occupied=occupied+1 WHERE id=? AND occupied<capacity AND capacity=6", args: [pickup.slotId] });
    if (held.rowsAffected !== 1) throw new ApiError(409, "SLOT_FULL", "Esta franja está completa. Elige otra franja.", undefined, { slot: { id: pickup.slotId, date: draft.date, time: draft.time, occupied: 6, capacity: 6, available: false } });
    const orderId = randomUUID(), createdAt = now.toISOString(), total = lines.reduce((sum, l) => sum + l.subtotal, 0);
    await tx.execute({ sql: "INSERT INTO md_orders(id,session_id,slot_id,status,version,name,phone,note,total,created_at) VALUES(?,?,?,'recibido',1,?,?,?,?,?)", args: [orderId, active.id, pickup.slotId, draft.name, draft.phone, draft.note, total, createdAt] });
    for (const l of lines) await tx.execute({ sql: "INSERT INTO md_order_lines(order_id,product_id,product_revision,presentation_id,presentation_version,name,presentation,quantity,unit_price,subtotal) VALUES(?,?,?,?,?,?,?,?,?,?)", args: [orderId, l.productId, l.productRevision, l.presentationId, l.presentationVersion, l.name, l.presentation, l.quantity, l.unitPrice, l.subtotal] });
    await tx.execute({ sql: "INSERT INTO md_order_history(order_id,version,from_status,to_status,created_at) VALUES(?,1,NULL,'recibido',?)", args: [orderId, createdAt] });
    await tx.execute({ sql: "INSERT INTO md_operations(session_id,key,payload_hash,payload_json,order_id,created_at) VALUES(?,?,?,?,?,?)", args: [active.id, key, payloadHash, payload, orderId, createdAt] });
    return { status: 201, orderId, order: await readOrder(tx, orderId) };
  });
  return json({ orderId: result.orderId, order: result.order }, result.status);
}
export async function getOperation(request: Request) {
  const search = query(request, ["key"]); const key = uuid(search.get("key"), "key");
  const result = await transaction(async tx => {
    const active = await requireSession(request, "visitor", false, tx);
    const found = await tx.execute({ sql: "SELECT order_id FROM md_operations WHERE session_id=? AND key=?", args: [active.id, key] });
    const row = found.rows[0]; if (!row) missing();
    const orderId = String(row.order_id);
    return { state: "committed", orderId, order: await readOrder(tx, orderId) };
  }, "read");
  return json(result);
}
