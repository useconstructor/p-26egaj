import { route } from "@/lib/server/core";
import { agenda } from "@/lib/server/owner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const GET = route(agenda);
