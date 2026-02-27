import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const state = crypto.randomUUID();
  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI ??
    "http://127.0.0.1:3000/api/spotify/callback";

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "user-top-read",
    redirect_uri: redirectUri,
    state,
  });

  const cookieStore = await cookies();
  cookieStore.set("spotify_auth_state", state, {
    httpOnly: true,
    maxAge: 600,
    path: "/",
    sameSite: "lax",
  });

  return NextResponse.redirect(
    `https://accounts.spotify.com/authorize?${params}`
  );
}
