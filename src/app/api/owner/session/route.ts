import { route } from "@/lib/server/core";
import { getOwner, loginOwner, logoutOwner } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const GET = route(getOwner);
export const POST = route(loginOwner);
export const DELETE = route(logoutOwner);
