import { route } from "@/lib/server/core";
import { getDraft, putDraft } from "@/lib/server/drafts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const GET = route(getDraft);
export const PUT = route(putDraft);
