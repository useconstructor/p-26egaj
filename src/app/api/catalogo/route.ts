import { route } from "@/lib/server/core";
import { getCatalog } from "@/lib/server/catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const GET = route(getCatalog);
