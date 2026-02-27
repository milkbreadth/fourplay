import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const cookieStore = await cookies();
  const savedState = cookieStore.get("spotify_auth_state")?.value;

  cookieStore.delete("spotify_auth_state");

  if (error || !code) {
    return NextResponse.redirect(
      new URL("/?error=spotify_auth_failed", req.url)
    );
  }

  if (!savedState || state !== savedState) {
    return NextResponse.redirect(new URL("/?error=state_mismatch", req.url));
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI ??
    "http://127.0.0.1:3000/api/spotify/callback";

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${clientId}:${clientSecret}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      new URL("/?error=token_exchange_failed", req.url)
    );
  }

  const tokenData = await tokenRes.json();

  const response = NextResponse.redirect(new URL("/", req.url));

  response.cookies.set("spotify_access_token", tokenData.access_token, {
    httpOnly: true,
    maxAge: tokenData.expires_in,
    path: "/",
    sameSite: "lax",
  });

  if (tokenData.refresh_token) {
    response.cookies.set("spotify_refresh_token", tokenData.refresh_token, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
    });
  }

  return response;
}
