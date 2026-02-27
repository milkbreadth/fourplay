import { NextResponse } from "next/server";
import { cookies } from "next/headers";

interface SpotifyArtist {
  id: string;
  name: string;
  images: { url: string; width: number; height: number }[];
  genres: string[];
  popularity: number;
  external_urls: { spotify: string };
}

async function getLastfmSimilar(
  artistName: string,
  apiKey: string
): Promise<string[]> {
  const params = new URLSearchParams({
    method: "artist.getSimilar",
    artist: artistName,
    api_key: apiKey,
    format: "json",
    limit: "10",
  });
  const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`, {
    next: { revalidate: 0 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  if (data.error) {
    console.error(
      `Last.fm error for "${artistName}": [${data.error}] ${data.message}`
    );
    return [];
  }
  return (data.similarartists?.artist ?? []).map(
    (a: { name: string }) => a.name
  );
}

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("spotify_access_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const lastfmApiKey = process.env.LASTFM_API_KEY!;

  // 1. Fetch top artists from Spotify
  const topRes = await fetch(
    "https://api.spotify.com/v1/me/top/artists?limit=10&time_range=medium_term",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      next: { revalidate: 0 },
    }
  );

  if (topRes.status === 401) {
    return NextResponse.json({ error: "Token expired" }, { status: 401 });
  }

  if (!topRes.ok) {
    return NextResponse.json(
      { error: "Failed to fetch top artists" },
      { status: 500 }
    );
  }

  const topData = await topRes.json();
  const topArtists: SpotifyArtist[] = topData.items ?? [];
  const topArtistNames = new Set(topArtists.map((a) => a.name.toLowerCase()));

  // 2. Level 1: similar artists for each top artist (~10 calls)
  const level1Results = await Promise.all(
    topArtists.map((artist) => getLastfmSimilar(artist.name, lastfmApiKey))
  );

  const level1Names = new Set<string>();
  for (const names of level1Results) {
    for (const name of names) {
      if (!topArtistNames.has(name.toLowerCase())) {
        level1Names.add(name);
      }
    }
  }

  // 3. Level 2: similar artists for each level-1 artist (~100 calls)
  const level2Results = await Promise.all(
    Array.from(level1Names).map((name) => getLastfmSimilar(name, lastfmApiKey))
  );

  const allSimilarNames = new Set<string>(level1Names);
  for (const names of level2Results) {
    for (const name of names) {
      if (!topArtistNames.has(name.toLowerCase())) {
        allSimilarNames.add(name);
      }
    }
  }

  console.log(`all similar names size: ${allSimilarNames.size}`)

  // 4. Search Spotify for each similar artist name to get full artist data
  const spotifySearchResults = await Promise.all(
    Array.from(allSimilarNames).map(async (name) => {
      const params = new URLSearchParams({ q: name, type: "artist", limit: "1" });
      const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        next: { revalidate: 0 },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return (data?.artists?.items?.[0] as SpotifyArtist) ?? null;
    })
  );

  // 5. Combine and deduplicate by Spotify artist ID
  const allArtists = new Map<string, SpotifyArtist>();
  for (const artist of topArtists) {
    allArtists.set(artist.id, artist);
  }
  for (const artist of spotifySearchResults) {
    if (artist) {
      allArtists.set(artist.id, artist);
    }
  }
  console.log(`artists length:${allArtists.size}`)

  // 6. Fisher-Yates shuffle
  const artists = Array.from(allArtists.values());
  for (let i = artists.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [artists[i], artists[j]] = [artists[j], artists[i]];
  }

  return NextResponse.json({ artists });
}
