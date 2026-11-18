import { route } from "@/lib/server/core";
import { getOperation } from "@/lib/server/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const GET = route(getOperation);
