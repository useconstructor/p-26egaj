import { route } from "@/lib/server/core";
import { changeStatus } from "@/lib/server/owner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const POST = route(changeStatus);
