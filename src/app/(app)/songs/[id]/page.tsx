import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Link2, ListMusic, Music2, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canDo } from "@/lib/perms";
import { KEYS } from "@/lib/music";
import { fmtDate } from "@/lib/format";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { addArrangement, updateArrangement } from "@/actions/songs";
import { addMediaLink } from "@/actions/media";
import { ChartView } from "@/components/ChartView";
import { MusicPlayer, youTubeId } from "@/components/MusicPlayer";

export const metadata = { title: "Song" };

export default async function SongPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ arr?: string }>;
}) {
  const params = await paramsPromise;
  const searchParams = await searchParamsPromise;
  const user = await requireUser();
  const song = await prisma.song.findFirst({
    where: { id: params.id, organizationId: user.organizationId },
    include: {
      arrangements: true,
      media: true,
      items: { include: { service: true }, orderBy: { service: { date: "desc" } } },
    },
  });
  if (!song) notFound();

  const manage = await canDo(user, "manage_songs");
  const current =
    song.arrangements.find((a) => a.id === searchParams.arr) || song.arrangements[0];
  const usages = song.items.slice(0, 10);
  const yt = song.media.map((m) => youTubeId(m.url)).find(Boolean);
  const ytMedia = yt ? song.media.find((m) => youTubeId(m.url) === yt) : null;
  const audio = song.media.find((m) => m.type === "AUDIO");

  return (
    <div className="space-y-6">
      <Link href="/songs" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink/50 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Song library
      </Link>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{song.title}</h1>
              {song.defaultKey && <Badge className="border-brand-200 bg-brand-50 text-brand-700">Key {song.defaultKey}</Badge>}
              {song.bpm && <Badge className="border-line bg-paper text-ink/60">{song.bpm} BPM</Badge>}
              {song.genre && <Badge className="border-line bg-paper text-ink/60">{song.genre}</Badge>}
            </div>
            <p className="mt-2 text-sm text-ink/55">
              {song.artist || "Unknown artist"}
              {song.writer ? ` · written by ${song.writer}` : ""}
            </p>
            <p className="mt-1 text-xs text-ink/40">
              {song.ccliNumber ? `CCLI #${song.ccliNumber}` : "No CCLI number"}
              {song.copyright ? ` · ${song.copyright}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(song.tags || "").split(",").filter(Boolean).map((tag) => (
                <Badge key={tag} className="border-line bg-paper text-ink/55">#{tag.trim()}</Badge>
              ))}
            </div>
          </div>
          {manage && (
            <div className="flex gap-2">
              <Modal
                title="Add arrangement"
                subtitle="e.g. Acoustic, Full Band, Youth, Choir"
                trigger={<button className="btn-primary btn-sm"><Plus className="h-4 w-4" /> Arrangement</button>}
              >
                <form action={addArrangement} className="space-y-4">
                  <input type="hidden" name="songId" value={song.id} />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label" htmlFor="ar-name">Name</label>
                      <input id="ar-name" name="name" required className="input" placeholder="e.g. Acoustic" />
                    </div>
                    <div>
                      <label className="label" htmlFor="ar-key">Key</label>
                      <select id="ar-key" name="key" className="input" defaultValue={song.defaultKey || ""}>
                        <option value="">—</option>
                        {KEYS.map((k) => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor="ar-chart">Chord chart</label>
                    <textarea id="ar-chart" name="chart" rows={6} className="input font-mono text-xs" placeholder={"[Verse]\nG     D\nline…"} />
                  </div>
                  <div>
                    <label className="label" htmlFor="ar-lyrics">Lyrics</label>
                    <textarea id="ar-lyrics" name="lyrics" rows={4} className="input" />
                  </div>
                  <button className="btn-primary w-full">Add arrangement</button>
                </form>
              </Modal>
              <Modal
                title="Add media link"
                subtitle="YouTube, Spotify, practice tracks, PDFs…"
                trigger={<button className="btn-secondary btn-sm"><Link2 className="h-4 w-4" /> Media link</button>}
              >
                <form action={addMediaLink} className="space-y-4">
                  <input type="hidden" name="songId" value={song.id} />
                  <input type="hidden" name="folder" value="songs" />
                  <div>
                    <label className="label" htmlFor="md-name">Name</label>
                    <input id="md-name" name="name" required className="input" placeholder="e.g. Practice track (YouTube)" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label" htmlFor="md-url">URL</label>
                      <input id="md-url" name="url" required type="url" className="input" placeholder="https://…" />
                    </div>
                    <div>
                      <label className="label" htmlFor="md-type">Type</label>
                      <select id="md-type" name="type" className="input">
                        <option value="LINK">Link</option>
                        <option value="AUDIO">Audio</option>
                        <option value="VIDEO">Video</option>
                        <option value="PDF">PDF</option>
                      </select>
                    </div>
                  </div>
                  <button className="btn-primary w-full">Add media</button>
                </form>
              </Modal>
            </div>
          )}
        </div>
      </div>

      {/* Arrangement tabs */}
      <div className="flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Arrangements">
        {song.arrangements.map((a) => (
          <Link
            key={a.id}
            href={`/songs/${song.id}?arr=${a.id}`}
            role="tab"
            aria-selected={current?.id === a.id}
            className={`chip whitespace-nowrap px-4 py-2 ${current?.id === a.id ? "border-brand-700 bg-brand-700 text-white" : "border-line bg-surface text-ink/65 hover:border-brand-300"}`}
          >
            {a.name}{a.key ? ` · ${a.key}` : ""}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title={`${current?.name ?? "Original"} — chord chart`}
              subtitle="Tap the key controls to transpose for any instrument"
              icon={<ListMusic className="h-4 w-4" />}
              action={
                manage && current ? (
                  <Modal
                    title={`Edit “${current.name}”`}
                    trigger={<button className="btn-secondary btn-sm">Edit chart</button>}
                  >
                    <form action={updateArrangement} className="space-y-4">
                      <input type="hidden" name="arrangementId" value={current.id} />
                      <input type="hidden" name="songId" value={song.id} />
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="label" htmlFor="ue-name">Name</label>
                          <input id="ue-name" name="name" defaultValue={current.name} className="input" />
                        </div>
                        <div>
                          <label className="label" htmlFor="ue-key">Key</label>
                          <select id="ue-key" name="key" defaultValue={current.key || ""} className="input">
                            <option value="">—</option>
                            {KEYS.map((k) => (
                              <option key={k} value={k}>{k}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="label" htmlFor="ue-chart">Chord chart</label>
                        <textarea id="ue-chart" name="chart" rows={10} defaultValue={current.chart} className="input font-mono text-xs" />
                      </div>
                      <div>
                        <label className="label" htmlFor="ue-lyrics">Lyrics</label>
                        <textarea id="ue-lyrics" name="lyrics" rows={6} defaultValue={current.lyrics} className="input" />
                      </div>
                      <button className="btn-primary w-full">Save arrangement</button>
                    </form>
                  </Modal>
                ) : undefined
              }
            />
            <div className="p-5">
              {current?.chart ? (
                <ChartView chart={current.chart} sourceKey={current.key || song.defaultKey} />
              ) : (
                <EmptyState title="No chart yet" hint="Add a chord chart so musicians can transpose and practice." icon={<Music2 className="h-6 w-6" />} />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Lyrics" subtitle={current?.key ? `Arrangement: ${current.name}` : undefined} icon={<FileText className="h-4 w-4" />} />
            <div className="p-5">
              {current?.lyrics ? (
                <pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-ink/80">{current.lyrics}</pre>
              ) : (
                <p className="text-sm text-ink/45">No lyrics added.</p>
              )}
              <p className="mt-4 rounded-xl bg-paper px-4 py-3 text-xs leading-relaxed text-ink/45">
                ℹ️ Demo lyrics in this workspace are original placeholder text. Replace them with your
                licensed lyrics and report usage to CCLI.
              </p>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {ytMedia && (
            <div>
              <p className="mb-2 text-sm font-bold text-ink">Practice media</p>
              <MusicPlayer url={ytMedia.url} youtubeId={yt} title={ytMedia.name} />
            </div>
          )}
          {audio && (
            <div>
              <p className="mb-2 text-sm font-bold text-ink">Audio</p>
              <MusicPlayer url={audio.url} title={audio.name} />
            </div>
          )}

          <Card>
            <CardHeader title="Media & files" icon={<Link2 className="h-4 w-4" />} />
            {song.media.length === 0 ? (
              <EmptyState title="No media" hint="Link YouTube practice videos, audio tracks or PDF charts." />
            ) : (
              <ul className="divide-y divide-line/70">
                {song.media.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 px-5 py-3">
                    <span className="min-w-0 truncate text-sm font-medium text-ink">{m.name}</span>
                    <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-brand-700 hover:underline">
                      Open →
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Usage history" subtitle={`${song.items.length} services`} icon={<Music2 className="h-4 w-4" />} />
            {usages.length === 0 ? (
              <EmptyState title="Not used yet" hint="Add it to a service plan to see history here." />
            ) : (
              <ul className="divide-y divide-line/70">
                {usages.map((i) => (
                  <li key={i.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <Link href={`/services/${i.serviceId}`} className="text-ink/70 hover:text-brand-700">{i.service.title}</Link>
                    <span className="text-xs text-ink/40">{fmtDate(i.service.date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
