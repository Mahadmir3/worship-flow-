import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ListChecks,
  Music4,
  Plus,
  Target,
  Trash2,
  UserPlus,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { REHEARSAL_SONG_STATUS } from "@/lib/constants";
import { canManageRehearsal } from "@/lib/perms";
import { fmtDate, fmtDurationRange, relativeDay, todayIn } from "@/lib/format";
import { Avatar, Badge, Card, CardHeader, EmptyState } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import {
  addRehearsalSong,
  cycleRehearsalSongStatus,
  deleteRehearsalSong,
  inviteToRehearsal,
  setRehearsalAttendance,
  toggleChecklistItem,
} from "@/actions/rehearsals";

export const metadata = { title: "Rehearsal" };

const STATUS_STYLE: Record<string, string> = {
  NOT_STARTED: "border-slate-200 bg-slate-50 text-slate-500",
  LEARNING: "border-amber-200 bg-amber-50 text-amber-700",
  REHEARSED: "border-sky-200 bg-sky-50 text-sky-700",
  READY: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export default async function RehearsalPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const user = await requireUser();
  const rehearsal = await prisma.rehearsal.findFirst({
    where: { id: params.id, organizationId: user.organizationId },
    include: {
      service: true,
      songs: true,
      members: { include: { person: true } },
    },
  });
  if (!rehearsal) notFound();

  const today = todayIn(user.organization.timezone);
  const manage = await canManageRehearsal(user, rehearsal.teamId);
  const [songLibrary, people] = await Promise.all([
    prisma.song.findMany({ where: { organizationId: user.organizationId }, orderBy: { title: "asc" } }),
    prisma.person.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
  ]);

  const checklist = JSON.parse(rehearsal.checklist || "[]") as { key: string; label: string; done: boolean }[];
  const memberIds = new Set(rehearsal.members.map((m) => personKey(m.personId)));
  const myMembership = user.personId ? rehearsal.members.find((m) => m.personId === user.personId) : null;

  return (
    <div className="space-y-6">
      <Link href="/rehearsals" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink/50 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> All rehearsals
      </Link>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-600">
              {relativeDay(rehearsal.date, user.organization.timezone)} · {fmtDate(rehearsal.date)}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">{rehearsal.title}</h1>
            <p className="mt-1 text-sm text-ink/55">
              {fmtDurationRange(rehearsal.startTime, rehearsal.endTime)}{rehearsal.location ? ` · ${rehearsal.location}` : ""}
            </p>
            {rehearsal.service && (
              <Link href={`/services/${rehearsal.serviceId}`} className="mt-3 inline-block">
                <Badge className="border-brand-200 bg-brand-50 text-brand-700">for {rehearsal.service.title}</Badge>
              </Link>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {rehearsal.date >= today && user.personId && (
              <>
                {(["YES", "NO"] as const).map((v) => (
                  <form key={v} action={setRehearsalAttendance}>
                    <input type="hidden" name="rehearsalId" value={rehearsal.id} />
                    <input type="hidden" name="attending" value={v} />
                    <button
                      className={`btn btn-sm ${myMembership?.attending === v ? "bg-brand-700 text-white" : "border border-line bg-white text-ink/70 hover:bg-brand-50"}`}
                    >
                      {v === "YES" ? "I'm coming" : "Can't make it"}
                    </button>
                  </form>
                ))}
              </>
            )}
            {manage && (
              <Modal
                title="Invite people"
                trigger={<button className="btn-secondary btn-sm"><UserPlus className="h-4 w-4" /> Invite</button>}
              >
                <form action={inviteToRehearsal} className="space-y-4">
                  <input type="hidden" name="rehearsalId" value={rehearsal.id} />
                  <div>
                    <label className="label" htmlFor="inv-person">Person</label>
                    <select id="inv-person" name="personId" required className="input">
                      {people.filter((p) => !memberIds.has(personKey(p.id))).map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <button className="btn-primary w-full">Send invitation</button>
                </form>
              </Modal>
            )}
          </div>
        </div>
        {rehearsal.objectives && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-gold-200 bg-gold-50/70 px-4 py-3">
            <Target className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" />
            <p className="text-sm leading-relaxed text-ink/75">{rehearsal.objectives}</p>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Songs"
              subtitle="Tap the status chip to advance: Not started → Learning → Rehearsed → Ready"
              icon={<Music4 className="h-4 w-4" />}
              action={
                manage ? (
                  <Modal
                    title="Add song to rehearsal"
                    trigger={<button className="btn-primary btn-sm"><Plus className="h-3.5 w-3.5" /> Add song</button>}
                  >
                    <form action={addRehearsalSong} className="space-y-4">
                      <input type="hidden" name="rehearsalId" value={rehearsal.id} />
                      <div>
                        <label className="label" htmlFor="rs-song">From library</label>
                        <select id="rs-song" name="songId" className="input">
                          <option value="">— custom title —</option>
                          {songLibrary.map((s) => (
                            <option key={s.id} value={s.id}>{s.title}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label" htmlFor="rs-title">Or custom title</label>
                        <input id="rs-title" name="title" className="input" placeholder="e.g. New song teach" />
                      </div>
                      <button className="btn-primary w-full">Add to rehearsal</button>
                    </form>
                  </Modal>
                ) : undefined
              }
            />
            {rehearsal.songs.length === 0 ? (
              <EmptyState title="No songs added" hint="Add the setlist so the team knows what to practice." />
            ) : (
              <ul className="divide-y divide-line/70">
                {rehearsal.songs.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{s.title}</p>
                      {s.notes && <p className="text-xs text-ink/50">{s.notes}</p>}
                    </div>
                    {manage ? (
                      <div className="flex items-center gap-1.5">
                        <form action={cycleRehearsalSongStatus}>
                          <input type="hidden" name="rehearsalSongId" value={s.id} />
                          <input type="hidden" name="rehearsalId" value={rehearsal.id} />
                          <button className={`chip ${STATUS_STYLE[s.status]}`}>
                            {REHEARSAL_SONG_STATUS.find((r) => r.id === s.status)?.label || s.status}
                          </button>
                        </form>
                        <form action={deleteRehearsalSong}>
                          <input type="hidden" name="rehearsalSongId" value={s.id} />
                          <input type="hidden" name="rehearsalId" value={rehearsal.id} />
                          <button className="rounded-lg p-1.5 text-ink/25 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove song">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      </div>
                    ) : (
                      <span className={`chip ${STATUS_STYLE[s.status]}`}>
                        {REHEARSAL_SONG_STATUS.find((r) => r.id === s.status)?.label || s.status}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Rehearsal checklist" subtitle={manage ? "Tap items to check them off" : undefined} icon={<ListChecks className="h-4 w-4" />} />
            <ul className="divide-y divide-line/70">
              {checklist.map((c) => (
                <li key={c.key} className="flex items-center gap-3 px-5 py-3">
                  {manage ? (
                    <form action={toggleChecklistItem}>
                      <input type="hidden" name="rehearsalId" value={rehearsal.id} />
                      <input type="hidden" name="key" value={c.key} />
                      <button
                        aria-pressed={c.done}
                        className={`flex h-6 w-6 items-center justify-center rounded-md border-2 transition ${
                          c.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-line bg-white hover:border-brand-400"
                        }`}
                        aria-label={`${c.done ? "Uncheck" : "Check"} ${c.label}`}
                      >
                        {c.done && <CheckCircle2 className="h-4 w-4" />}
                      </button>
                    </form>
                  ) : (
                    <span className={`flex h-6 w-6 items-center justify-center rounded-md border-2 ${c.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-line"}`}>
                      {c.done && <CheckCircle2 className="h-4 w-4" />}
                    </span>
                  )}
                  <span className={`text-sm font-medium ${c.done ? "text-ink/40 line-through" : "text-ink"}`}>{c.label}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Participants" subtitle={`${rehearsal.members.filter((m) => m.attending === "YES").length} confirmed`} icon={<UserPlus className="h-4 w-4" />} />
            {rehearsal.members.length === 0 ? (
              <EmptyState title="No participants yet" hint="Invite the band and singers." />
            ) : (
              <ul className="divide-y divide-line/70">
                {rehearsal.members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={m.person.name} size={32} />
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{m.person.name}</p>
                    <Badge
                      className={
                        m.attending === "YES"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : m.attending === "NO"
                            ? "border-rose-200 bg-rose-50 text-rose-600"
                            : "border-line bg-paper text-ink/50"
                      }
                    >
                      {m.attending === "YES" ? "coming" : m.attending === "NO" ? "not coming" : "?"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {rehearsal.notes && (
            <Card>
              <CardHeader title="Notes" />
              <p className="whitespace-pre-wrap px-5 py-4 text-sm leading-relaxed text-ink/75">{rehearsal.notes}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function personKey(id: string) {
  return id;
}
