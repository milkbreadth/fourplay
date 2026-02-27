"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface SpotifyImage {
  url: string;
  width: number;
  height: number;
}

interface Artist {
  id: string;
  name: string;
  images: SpotifyImage[];
  genres: string[];
  popularity: number;
  external_urls: { spotify: string };
}

type State =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "error"; message: string }
  | { status: "loaded"; artists: Artist[] };

export default function ArtistPool() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    fetch("/api/spotify/artist-pool")
      .then(async (res) => {
        if (res.status === 401) {
          setState({ status: "unauthenticated" });
          return;
        }
        if (!res.ok) throw new Error("Failed to load artist pool");
        const data = await res.json();
        setState({ status: "loaded", artists: data.artists ?? [] });
      })
      .catch((err: Error) => {
        setState({ status: "error", message: err.message });
      });
  }, []);

  if (state.status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400 text-lg animate-pulse">Loading…</p>
      </div>
    );
  }

  if (state.status === "unauthenticated") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold">Artist Pool</h1>
        <p className="text-gray-500">Connect Spotify to explore your artist pool.</p>
        <a
          href="/api/spotify/login"
          className="px-6 py-3 bg-[#1DB954] text-black font-semibold rounded-full hover:bg-[#1ed760] transition-colors"
        >
          Connect with Spotify
        </a>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-500">Error: {state.message}</p>
      </div>
    );
  }

  const { artists } = state;

  return (
    <main className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Artist Pool</h1>
      <p className="text-gray-500 mb-8">
        Your top artists and their related artists — {artists.length} total.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {artists.map((artist) => {
          const image = artist.images.find((img) => img.width <= 300) ?? artist.images[0];
          return (
            <a
              key={artist.id}
              href={artist.external_urls.spotify}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 group"
            >
              <div className="relative w-full aspect-square rounded-full overflow-hidden shadow-lg group-hover:scale-105 transition-transform">
                {image ? (
                  <Image
                    src={image.url}
                    alt={artist.name}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                    <span className="text-4xl text-gray-400">{artist.name[0]}</span>
                  </div>
                )}
              </div>
              <p className="text-sm font-medium text-center leading-tight group-hover:underline">
                {artist.name}
              </p>
            </a>
          );
        })}
      </div>
    </main>
  );
}
