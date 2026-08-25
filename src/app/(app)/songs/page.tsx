import Link from "next/link";
import { ListMusic, Music2, Plus, Search } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canDo } from "@/lib/perms";
import { KEYS } from "@/lib/music";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { createSong } from "@/actions/songs";

export const metadata = { title: "Songs" };

export default async function SongsPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{ q?: string }> }) {
  const searchParams = await searchParamsPromise;
  const user = await requireUser();
  const q = (searchParams.q || "").trim();

  const songs = await prisma.song.findMany({
    where: {
      organizationId: user.organizationId,
      ...(q
        ? { OR: [{ title: { contains: q } }, { artist: { contains: q } }, { tags: { contains: q } }] }
        : {}),
    },
    include: { arrangements: true, items: { include: { service: true } } },
    orderBy: { title: "asc" },
  });

  const manage = await canDo(user, "manage_songs");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Song library</h1>
          <p className="mt-1 text-sm text-ink/50">{songs.length} songs with charts, lyrics & arrangements</p>
        </div>
        {manage && (
          <Modal
            title="Add a song"
            subtitle="You can add charts, lyrics and media right after."
            wide
            trigger={<button className="btn-primary"><Plus className="h-4 w-4" /> Add song</button>}
          >
            <form action={createSong} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="sg-title">Title</label>
                  <input id="sg-title" name="title" required className="input" placeholder="e.g. Way Maker" />
                </div>
                <div>
                  <label className="label" htmlFor="sg-artist">Artist / recording</label>
                  <input id="sg-artist" name="artist" className="input" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="sg-writer">Writer(s)</label>
                  <input id="sg-writer" name="writer" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="sg-key">Default key</label>
                  <select id="sg-key" name="defaultKey" className="input">
                    <option value="">—</option>
                    {KEYS.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor="sg-bpm">BPM</label>
                  <input id="sg-bpm" name="bpm" type="number" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="sg-genre">Genre</label>
                  <input id="sg-genre" name="genre" className="input" placeholder="e.g. Worship" />
                </div>
                <div>
                  <label className="label" htmlFor="sg-ccli">CCLI #</label>
                  <input id="sg-ccli" name="ccliNumber" className="input" />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="sg-tags">Tags (comma separated)</label>
                <input id="sg-tags" name="tags" className="input" placeholder="e.g. faithfulness, healing, Africa" />
              </div>
              <div>
                <label className="label" htmlFor="sg-chart">Chord chart (optional now)</label>
                <textarea id="sg-chart" name="chart" rows={4} className="input font-mono text-xs" placeholder={"[Verse]\nG        D\nLyric line…"} />
              </div>
              <div>
                <label className="label" htmlFor="sg-lyrics">Lyrics (demo/original or licensed)</label>
                <textarea id="sg-lyrics" name="lyrics" rows={4} className="input" />
              </div>
              <button className="btn-primary w-full">Add song</button>
            </form>
          </Modal>
        )}
      </div>

      <form className="flex gap-2" role="search">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
          <input name="q" defaultValue={q} className="input pl-10" placeholder="Search title, artist or tag…" aria-label="Search songs" />
        </div>
        <button className="btn-secondary">Search</button>
      </form>

      {songs.length === 0 ? (
        <div className="card">
          <EmptyState icon={<ListMusic className="h-6 w-6" />} title="No songs yet" hint="Build your church's worship library — charts, lyrics, keys and media for every song." />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {songs.map((s) => {
            const uses = s.items.length;
            const lastUsed = s.items
              .map((i) => i.service.date)
              .sort()
              .reverse()[0];
            return (
              <Link key={s.id} href={`/songs/${s.id}`} className="card flex flex-col gap-3 p-5 transition hover:border-brand-300 hover:shadow-pop">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <Music2 className="h-5 w-5" />
                  </span>
                  {s.defaultKey && <Badge className="border-brand-200 bg-brand-50 text-brand-700">Key {s.defaultKey}</Badge>}
                </div>
                <div>
                  <p className="font-extrabold text-ink">{s.title}</p>
                  <p className="text-xs text-ink/50">
                    {s.artist || "—"}
                    {s.bpm ? ` · ${s.bpm} BPM` : ""}
                  </p>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-1.5">
                  {(s.tags || "").split(",").filter(Boolean).slice(0, 3).map((tag) => (
                    <Badge key={tag} className="border-line bg-paper text-ink/55">#{tag.trim()}</Badge>
                  ))}
                  <Badge className="border-emerald-100 bg-emerald-50 text-emerald-600">{s.arrangements.length} arrangement{s.arrangements.length === 1 ? "" : "s"}</Badge>
                </div>
                <p className="text-[11px] text-ink/40">
                  {uses > 0 ? `Used ${uses}×${lastUsed ? ` · last ${lastUsed}` : ""}` : "Not scheduled yet"}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
