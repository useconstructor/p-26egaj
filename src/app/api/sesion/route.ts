import { route } from "@/lib/server/core";
import { getVisitor, initializeVisitor } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const GET = route(getVisitor);
export const POST = route(initializeVisitor);
