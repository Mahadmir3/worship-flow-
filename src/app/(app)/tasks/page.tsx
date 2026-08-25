import Link from "next/link";
import { CheckSquare, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TASK_PRIORITY, TASK_STATUS } from "@/lib/constants";
import { relativeDay, todayIn } from "@/lib/format";
import { Avatar, Badge, Card, CardHeader, EmptyState } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { createTask, deleteTask, moveTask } from "@/actions/tasks";

export const metadata = { title: "Tasks" };

const COLUMNS = [
  { id: "TODO", label: "To do" },
  { id: "IN_PROGRESS", label: "In progress" },
  { id: "DONE", label: "Done" },
] as const;

export default async function TasksPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{ mine?: string }> }) {
  const searchParams = await searchParamsPromise;
  const user = await requireUser();
  const mine = searchParams.mine === "1";
  const today = todayIn(user.organization.timezone);

  const [allTasks, people, services] = await Promise.all([
    prisma.task.findMany({
      where: {
        organizationId: user.organizationId,
        ...(mine && user.personId ? { assigneeId: user.personId } : {}),
      },
      include: { service: true, assignee: true },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    }),
    prisma.person.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
    prisma.service.findMany({ where: { organizationId: user.organizationId, date: { gte: today } }, orderBy: { date: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Tasks</h1>
          <p className="mt-1 text-sm text-ink/50">
            {allTasks.filter((t) => t.status !== "DONE").length} open ·{" "}
            <Link href={mine ? "/tasks" : "/tasks?mine=1"} className="font-bold text-brand-700 hover:underline">
              {mine ? "show all" : "show only mine"}
            </Link>
          </p>
        </div>
        <Modal
          title="Create a task"
          trigger={<button className="btn-primary"><Plus className="h-4 w-4" /> New task</button>}
        >
          <form action={createTask} className="space-y-4">
            <div>
              <label className="label" htmlFor="tk-title">Task</label>
              <input id="tk-title" name="title" required className="input" placeholder="e.g. Test livestream" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="tk-assignee">Assignee</label>
                <select id="tk-assignee" name="assigneeId" className="input">
                  <option value="">—</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="tk-due">Due date</label>
                <input id="tk-due" name="dueDate" type="date" className="input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="tk-service">For service</label>
                <select id="tk-service" name="serviceId" className="input">
                  <option value="">—</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.title} · {s.date}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="tk-priority">Priority</label>
                <select id="tk-priority" name="priority" className="input" defaultValue="MEDIUM">
                  {Object.entries(TASK_PRIORITY).map(([id, p]) => (
                    <option key={id} value={id}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <button className="btn-primary w-full">Create task</button>
          </form>
        </Modal>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const tasks = allTasks.filter((t) => t.status === col.id);
          return (
            <Card key={col.id}>
              <CardHeader
                title={col.label}
                subtitle={`${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
                icon={<CheckSquare className="h-4 w-4" />}
              />
              {tasks.length === 0 ? (
                <EmptyState title="Nothing here" hint="Tasks you move here will show up in this column." />
              ) : (
                <ul className="divide-y divide-line/70">
                  {tasks.map((t) => {
                    const pri = TASK_PRIORITY[t.priority];
                    return (
                      <li key={t.id} className="px-4 py-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-semibold ${col.id === "DONE" ? "text-ink/35 line-through" : "text-ink"}`}>
                            {t.title}
                          </p>
                          <Badge className={pri.className}>{pri.label}</Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink/50">
                          {t.assignee && (
                            <span className="flex items-center gap-1.5">
                              <Avatar name={t.assignee.name} size={18} />
                              {t.assignee.name.split(" ")[0]}
                            </span>
                          )}
                          {t.dueDate && (
                            <span className={t.dueDate < today && col.id !== "DONE" ? "font-bold text-rose-600" : ""}>
                              due {relativeDay(t.dueDate, user.organization.timezone)}
                            </span>
                          )}
                          {t.service && (
                            <Link href={`/services/${t.serviceId}`} className="font-semibold text-brand-700 hover:underline">
                              {t.service.title}
                            </Link>
                          )}
                        </div>
                        <div className="mt-2.5 flex gap-1.5">
                          {COLUMNS.filter((c) => c.id !== col.id).map((c) => (
                            <form key={c.id} action={moveTask}>
                              <input type="hidden" name="taskId" value={t.id} />
                              <input type="hidden" name="status" value={c.id} />
                              <button className="chip border-line bg-white text-ink/60 hover:border-brand-400 hover:text-brand-700">
                                → {c.label}
                              </button>
                            </form>
                          ))}
                          <form action={deleteTask} className="ml-auto">
                            <input type="hidden" name="taskId" value={t.id} />
                            <button className="rounded-lg px-1.5 py-1 text-xs text-ink/30 hover:bg-rose-50 hover:text-rose-600" aria-label="Delete task">
                              ✕
                            </button>
                          </form>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
