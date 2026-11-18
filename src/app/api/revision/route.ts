import { route } from "@/lib/server/core";
import { reviewDraft } from "@/lib/server/drafts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const POST = route(reviewDraft);
