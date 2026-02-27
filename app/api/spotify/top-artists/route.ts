import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("spotify_access_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const res = await fetch(
    "https://api.spotify.com/v1/me/top/artists?limit=10&time_range=long_term",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      next: { revalidate: 0 },
    }
  );

  if (res.status === 401) {
    return NextResponse.json({ error: "Token expired" }, { status: 401 });
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch top artists" },
      { status: 500 }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
