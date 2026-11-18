import { NextResponse } from "next/server";
import {
  OWNER_COOKIE, createOwnerToken, isOwner, ownerCodeMatches, ownerCookieOptions,
  recordSignInFailure, signInAllowed,
} from "@/lib/owner-access";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

/** GET → { owner: boolean } */
export async function GET() {
  return NextResponse.json({ owner: await isOwner() }, { headers: noStore });
}

/** POST { code } → signs the owner in with the provisioned OWNER_ACCESS_CODE. */
export async function POST(request: Request) {
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!signInAllowed(client)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." }, { status: 429, headers: noStore });
  }
  const body = await request.json().catch(() => null);
  if (!ownerCodeMatches(body?.code)) {
    recordSignInFailure(client);
    return NextResponse.json({ error: "El código de acceso no es correcto." }, { status: 401, headers: noStore });
  }
  const response = NextResponse.json({ owner: true }, { headers: noStore });
  response.cookies.set(OWNER_COOKIE, createOwnerToken(), ownerCookieOptions);
  return response;
}

/** DELETE → signs the owner out. */
export async function DELETE() {
  const response = NextResponse.json({ owner: false }, { headers: noStore });
  response.cookies.set(OWNER_COOKIE, "", { ...ownerCookieOptions, maxAge: 0 });
  return response;
}
