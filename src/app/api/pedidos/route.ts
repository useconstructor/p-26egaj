import { route } from "@/lib/server/core";
import { getOrders, createOrder } from "@/lib/server/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const GET = route(getOrders);
export const POST = route(createOrder);
