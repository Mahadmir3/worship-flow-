export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { youTubeId } from "@/lib/youtube";

/**
 * Resolve a song's concrete YouTube video (from its stored search link),
 * cache the result on the song, and return the video id for in-page embed.
 */
export async function GET(req: NextRequest) {
  const user = await requireUser();
  const songId = req.nextUrl.searchParams.get("songId") || "";
  const song = await prisma.song.findFirst({
    where: { id: songId, organizationId: user.organizationId },
    select: { id: true, title: true, artist: true, youtubeUrl: true },
  });
  if (!song) return NextResponse.json({ error: "not found" }, { status: 404 });

  // already a concrete video?
  const existing = youTubeId(song.youtubeUrl);
  if (existing) return NextResponse.json({ videoId: existing });

  // build the search query from the stored search link (or title+artist)
  let q = "";
  if (song.youtubeUrl) {
    try {
      const u = new URL(song.youtubeUrl);
      q = u.searchParams.get("search_query") || "";
    } catch {
      // ignore malformed
    }
  }
  if (!q) q = `${song.artist || ""} ${song.title}`.trim();

  try {
    const res = await fetch(
      "https://www.youtube.com/results?search_query=" + encodeURIComponent(q),
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          "Accept-Language": "en",
        },
        redirect: "follow",
      }
    );
    // Stream-read and stop as soon as the first videoId appears — the results
    // page is ~1.3MB and the id sits near the top; capping keeps memory flat.
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let html = "";
    let m: RegExpMatchArray | null = null;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      m = html.match(/videoId\\?"?:\\?"?([A-Za-z0-9_-]{11})/);
      if (m || html.length > 500_000) {
        await reader.cancel();
        break;
      }
    }
    if (!m) return NextResponse.json({ error: "no video found" }, { status: 502 });
    const videoId = m[1];
    // cache so next time it's instant
    await prisma.song.update({
      where: { id: song.id },
      data: { youtubeUrl: `https://www.youtube.com/watch?v=${videoId}` },
    });
    return NextResponse.json({ videoId });
  } catch {
    return NextResponse.json({ error: "lookup failed" }, { status: 502 });
  }
}
