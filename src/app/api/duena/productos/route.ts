import { route } from "@/lib/server/core";
import { ownerProducts, changeProduct } from "@/lib/server/owner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const GET = route(ownerProducts);
export const POST = route(changeProduct);
