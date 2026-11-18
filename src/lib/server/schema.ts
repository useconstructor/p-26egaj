import "server-only";
import { db } from "@/lib/db";
import type { InStatement } from "@libsql/client";

let ready: Promise<void> | undefined;
const ddl = [
  `CREATE TABLE IF NOT EXISTS md_meta (key TEXT PRIMARY KEY,value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS md_presentations (id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version>0),renderer_key TEXT NOT NULL,PRIMARY KEY(id,version))`,
  `CREATE TABLE IF NOT EXISTS md_products (id TEXT PRIMARY KEY,current_revision INTEGER NOT NULL,available INTEGER NOT NULL CHECK(available IN(0,1)),version INTEGER NOT NULL CHECK(version>0),position INTEGER NOT NULL UNIQUE)`,
  `CREATE TABLE IF NOT EXISTS md_product_revisions (product_id TEXT NOT NULL REFERENCES md_products(id),revision INTEGER NOT NULL CHECK(revision>0),name TEXT NOT NULL,category TEXT NOT NULL CHECK(category IN('tortas','postres')),presentation TEXT NOT NULL,unit_price INTEGER NOT NULL CHECK(unit_price>0),presentation_id TEXT NOT NULL,presentation_version INTEGER NOT NULL,PRIMARY KEY(product_id,revision),FOREIGN KEY(presentation_id,presentation_version) REFERENCES md_presentations(id,version))`,
  `CREATE TABLE IF NOT EXISTS md_slots (id TEXT PRIMARY KEY,date TEXT NOT NULL,time TEXT NOT NULL,occupied INTEGER NOT NULL DEFAULT 0 CHECK(occupied BETWEEN 0 AND 6),capacity INTEGER NOT NULL DEFAULT 6 CHECK(capacity=6),UNIQUE(date,time))`,
  `CREATE TABLE IF NOT EXISTS md_sessions (id TEXT PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,csrf_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN('visitor','owner')),expires_at TEXT NOT NULL,revoked_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS md_drafts (session_id TEXT PRIMARY KEY REFERENCES md_sessions(id),version INTEGER NOT NULL CHECK(version>0),payload_json TEXT NOT NULL,updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS md_login_attempts (key_hash TEXT PRIMARY KEY,count INTEGER NOT NULL,window_start INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS md_orders (id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES md_sessions(id),slot_id TEXT NOT NULL REFERENCES md_slots(id),status TEXT NOT NULL CHECK(status IN('recibido','en_preparacion','listo','entregado')),version INTEGER NOT NULL CHECK(version>0),name TEXT NOT NULL,phone TEXT NOT NULL,note TEXT NOT NULL,total INTEGER NOT NULL CHECK(total>0),created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS md_order_lines (order_id TEXT NOT NULL REFERENCES md_orders(id),product_id TEXT NOT NULL,product_revision INTEGER NOT NULL,presentation_id TEXT NOT NULL,presentation_version INTEGER NOT NULL,name TEXT NOT NULL,presentation TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 99),unit_price INTEGER NOT NULL CHECK(unit_price>0),subtotal INTEGER NOT NULL CHECK(subtotal=quantity*unit_price),PRIMARY KEY(order_id,product_id),FOREIGN KEY(product_id,product_revision) REFERENCES md_product_revisions(product_id,revision),FOREIGN KEY(presentation_id,presentation_version) REFERENCES md_presentations(id,version))`,
  `CREATE TABLE IF NOT EXISTS md_order_history (order_id TEXT NOT NULL REFERENCES md_orders(id),version INTEGER NOT NULL,from_status TEXT,to_status TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(order_id,version))`,
  `CREATE TABLE IF NOT EXISTS md_operations (session_id TEXT NOT NULL REFERENCES md_sessions(id),key TEXT NOT NULL,payload_hash TEXT NOT NULL,payload_json TEXT NOT NULL,order_id TEXT NOT NULL REFERENCES md_orders(id),created_at TEXT NOT NULL,PRIMARY KEY(session_id,key))`,
  `CREATE INDEX IF NOT EXISTS md_orders_owner ON md_orders(session_id,created_at)`,
  `CREATE INDEX IF NOT EXISTS md_orders_slot ON md_orders(slot_id)`,
];
// These are the four explicitly requested fictional catalogue records, never orders.
const seeds = [
  ["chocolate", "Torta de chocolate", "tortas", "Entera, 8 porciones orientativas", 68000],
  ["vainilla-frutos-rojos", "Torta de vainilla y frutos rojos", "tortas", "Entera, 8 porciones orientativas", 72000],
  ["cheesecake-maracuya", "Cheesecake de maracuyá", "postres", "Individual", 14000],
  ["brownie-cacao", "Brownie de cacao", "postres", "Individual", 8000],
] as const;

export function ensureSchema() {
  if (!ready) ready = initialize().catch(error => { ready = undefined; throw error; });
  return ready;
}
async function initialize() {
  const tx = await db.transaction("write");
  try {
    await tx.batch(ddl);
    const marker = await tx.execute({ sql: "SELECT value FROM md_meta WHERE key=?", args: ["masa-dulce-v1"] });
    if (!marker.rows.length) {
      const inserts: InStatement[] = [];
      for (const [index, [id, name, category, presentation, price]] of seeds.entries()) {
        inserts.push({ sql: "INSERT OR IGNORE INTO md_presentations(id,version,renderer_key) VALUES(?,1,?)", args: [id, id] });
        inserts.push({ sql: "INSERT OR IGNORE INTO md_products(id,current_revision,available,version,position) VALUES(?,1,1,1,?)", args: [id, index + 1] });
        inserts.push({ sql: "INSERT OR IGNORE INTO md_product_revisions(product_id,revision,name,category,presentation,unit_price,presentation_id,presentation_version) VALUES(?,1,?,?,?,?,?,1)", args: [id, name, category, presentation, price, id] });
      }
      inserts.push({ sql: "INSERT INTO md_meta(key,value) VALUES(?,?)", args: ["masa-dulce-v1", new Date().toISOString()] });
      await tx.batch(inserts);
    }
    await tx.commit();
  } catch (error) { await tx.rollback(); throw error; } finally { tx.close(); }
}
