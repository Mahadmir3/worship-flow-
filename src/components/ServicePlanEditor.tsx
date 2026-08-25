"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  Music2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { ITEM_TYPES } from "@/lib/constants";
import { addMinutes, fmtTime } from "@/lib/format";
import { KEYS } from "@/lib/music";
import {
  addServiceItem,
  deleteServiceItem,
  duplicateServiceItem,
  moveServiceItem,
  reorderServiceItems,
  updateServiceItem,
} from "@/actions/services";
import { Modal } from "@/components/ui/Modal";

export type PlanItem = {
  id: string;
  title: string;
  type: string;
  durationSec: number;
  personName: string | null;
  personId: string | null;
  songId: string | null;
  songTitle: string | null;
  key: string | null;
  notes: string | null;
};

export type PlanPerson = { id: string; name: string };
export type PlanSong = { id: string; title: string; defaultKey: string | null };

export function ServicePlanEditor({
  serviceId,
  startTime,
  items,
  people,
  songs,
  editable,
}: {
  serviceId: string;
  startTime: string;
  items: PlanItem[];
  people: PlanPerson[];
  songs: PlanSong[];
  editable: boolean;
}) {
  const [order, setOrder] = useState(items);
  const [expanded, setExpanded] = useState<string | null>(items[0]?.id ?? null);
  const [, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } })
  );

  const computed = useMemo(() => {
    let t = startTime;
    return order.map((it) => {
      const start = t;
      t = addMinutes(t, Math.round(it.durationSec / 60));
      return { ...it, startTime: start, endTime: t };
    });
  }, [order, startTime]);

  const totalMin = Math.round(order.reduce((n, i) => n + i.durationSec, 0) / 60);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = order.findIndex((i) => i.id === active.id);
    const newIdx = order.findIndex((i) => i.id === over.id);
    const next = arrayMove(order, oldIdx, newIdx);
    setOrder(next);
    startTransition(() => {
      reorderServiceItems(serviceId, next.map((i) => i.id));
    });
  }

  return (
    <div className="space-y-4">
      {/* Visual timeline header */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-sm font-bold text-ink">
              {fmtTime(startTime)} – {computed.length ? fmtTime(computed[computed.length - 1].endTime) : fmtTime(startTime)}
            </p>
            <p className="text-xs text-ink/50">{order.length} items · {totalMin} minutes total</p>
          </div>
          {editable && (
            <Modal
              title="Add service item"
              trigger={
                <button className="btn-primary btn-sm">
                  <Plus className="h-4 w-4" /> Add item
                </button>
              }
            >
              <AddItemForm serviceId={serviceId} people={people} songs={songs} />
            </Modal>
          )}
        </div>
        <div className="flex h-3 w-full" aria-hidden>
          {computed.map((it) => {
            const color = ITEM_TYPES[it.type]?.color || "#94A3B8";
            return (
              <div
                key={it.id}
                style={{ background: color, flexGrow: Math.max(it.durationSec, 60) }}
                className="h-full first:rounded-l-full last:rounded-r-full"
                title={`${it.title} (${Math.round(it.durationSec / 60)} min)`}
              />
            );
          })}
        </div>
      </div>

      {/* Sortable list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ol className="space-y-2.5">
            {computed.map((it, idx) => (
              <SortableRow
                key={it.id}
                item={it}
                idx={idx}
                count={order.length}
                expanded={expanded === it.id}
                onToggle={() => setExpanded(expanded === it.id ? null : it.id)}
                editable={editable}
                serviceId={serviceId}
                people={people}
                songs={songs}
                onLocalDelete={() => setOrder((o) => o.filter((x) => x.id !== it.id))}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      {order.length === 0 && (
        <div className="card px-6 py-12 text-center">
          <p className="font-semibold text-ink">The plan is empty</p>
          <p className="mt-1 text-sm text-ink/50">Add your first item — welcome, prayer, song, sermon…</p>
        </div>
      )}
    </div>
  );
}

function SortableRow({
  item,
  idx,
  count,
  expanded,
  onToggle,
  editable,
  serviceId,
  people,
  songs,
  onLocalDelete,
}: {
  item: PlanItem & { startTime: string; endTime: string };
  idx: number;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  editable: boolean;
  serviceId: string;
  people: PlanPerson[];
  songs: PlanSong[];
  onLocalDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !editable,
  });
  const typeMeta = ITEM_TYPES[item.type] || ITEM_TYPES.OTHER;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`card overflow-hidden ${isDragging ? "opacity-60 shadow-pop" : ""}`}
    >
      <div className="flex items-stretch">
        {/* time rail */}
        <div className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center border-r border-line bg-paper/70 px-1 py-3 text-center">
          <span className="text-[11px] font-extrabold text-ink/70">{fmtTime(item.startTime).replace(" ", "")}</span>
          <span className="mt-0.5 text-[10px] text-ink/40">{Math.round(item.durationSec / 60)}m</span>
        </div>
        {/* color bar */}
        <span className="w-1.5 shrink-0" style={{ background: typeMeta.color }} aria-hidden />
        {/* body */}
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left" aria-expanded={expanded}>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink">
              {item.type === "SONG" && <Music2 className="mr-1.5 inline h-4 w-4 text-brand-500" />}
              {item.title}
              {item.key && <span className="ml-2 chip border-brand-200 bg-brand-50 text-brand-700">Key {item.key}</span>}
            </p>
            <p className="mt-0.5 truncate text-xs text-ink/50">
              {typeMeta.label}
              {item.personName ? ` · ${item.personName}` : ""}
              {item.notes && !expanded ? " · has notes" : ""}
            </p>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 shrink-0 text-ink/30" /> : <ChevronDown className="h-4 w-4 shrink-0 text-ink/30" />}
        </button>
        {/* controls */}
        {editable && (
          <div className="flex items-center gap-0.5 pr-2">
            <span
              {...attributes}
              {...listeners}
              className="cursor-grab touch-none rounded-lg p-2 text-ink/30 hover:bg-brand-50 hover:text-ink/60"
              aria-label={`Reorder ${item.title}`}
              role="button"
              tabIndex={0}
            >
              <GripVertical className="h-4 w-4" />
            </span>
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-line/70 bg-paper/40 px-5 py-4">
          {item.notes ? (
            <p className="mb-3 rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink/75">{item.notes}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {item.songId && (
              <a href={`/songs/${item.songId}`} className="btn-secondary btn-sm">
                <Music2 className="h-3.5 w-3.5" /> Open song & chart
              </a>
            )}
            {editable && (
              <>
                <Modal
                  title={`Edit “${item.title}”`}
                  trigger={
                    <button className="btn-secondary btn-sm">
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                  }
                >
                  <EditItemForm serviceId={serviceId} item={item} people={people} />
                </Modal>
                <form action={duplicateServiceItem}>
                  <input type="hidden" name="serviceId" value={serviceId} />
                  <input type="hidden" name="itemId" value={item.id} />
                  <button className="btn-secondary btn-sm">
                    <Copy className="h-3.5 w-3.5" /> Duplicate
                  </button>
                </form>
                <div className="flex items-center gap-0.5">
                  <form action={moveServiceItem}>
                    <input type="hidden" name="serviceId" value={serviceId} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="dir" value="up" />
                    <button className="btn-ghost btn-sm" disabled={idx === 0} aria-label="Move up">
                      <ChevronUp className="h-4 w-4" />
                    </button>
                  </form>
                  <form action={moveServiceItem}>
                    <input type="hidden" name="serviceId" value={serviceId} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="dir" value="down" />
                    <button className="btn-ghost btn-sm" disabled={idx === count - 1} aria-label="Move down">
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </form>
                </div>
                <form
                  action={async (fd) => {
                    onLocalDelete();
                    await deleteServiceItem(fd);
                  }}
                >
                  <input type="hidden" name="serviceId" value={serviceId} />
                  <input type="hidden" name="itemId" value={item.id} />
                  <button className="btn-danger btn-sm">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function typeOptions() {
  return Object.entries(ITEM_TYPES).map(([id, meta]) => (
    <option key={id} value={id}>
      {meta.label}
    </option>
  ));
}

export function AddItemForm({
  serviceId,
  people,
  songs,
}: {
  serviceId: string;
  people: PlanPerson[];
  songs: PlanSong[];
}) {
  return (
    <form action={addServiceItem} className="space-y-4">
      <input type="hidden" name="serviceId" value={serviceId} />
      <div>
        <label className="label" htmlFor="add-title">Title</label>
        <input id="add-title" name="title" className="input" placeholder="e.g. Offering" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="add-type">Type</label>
          <select id="add-type" name="type" className="input">
            {typeOptions()}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="add-min">Duration (min)</label>
          <input id="add-min" name="minutes" type="number" min={1} max={90} defaultValue={5} className="input" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="add-person">Person responsible</label>
          <select id="add-person" name="personId" className="input">
            <option value="">—</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="add-key">Key (for songs)</label>
          <select id="add-key" name="key" className="input">
            <option value="">—</option>
            {KEYS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="add-song">Link a song (optional)</label>
        <select id="add-song" name="songId" className="input">
          <option value="">— none —</option>
          {songs.map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="add-notes">Notes</label>
        <textarea id="add-notes" name="notes" rows={2} className="input" placeholder="Cues, transitions, props…" />
      </div>
      <button type="submit" className="btn-primary w-full">Add to plan</button>
    </form>
  );
}

function EditItemForm({
  serviceId,
  item,
  people,
}: {
  serviceId: string;
  item: PlanItem & { startTime: string };
  people: PlanPerson[];
}) {
  return (
    <form action={updateServiceItem} className="space-y-4">
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="itemId" value={item.id} />
      <div>
        <label className="label" htmlFor="edit-title">Title</label>
        <input id="edit-title" name="title" defaultValue={item.title} className="input" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="edit-type">Type</label>
          <select id="edit-type" name="type" defaultValue={item.type} className="input">
            {typeOptions()}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="edit-min">Duration (min)</label>
          <input id="edit-min" name="minutes" type="number" min={1} max={90} defaultValue={Math.round(item.durationSec / 60)} className="input" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="edit-person">Person responsible</label>
          <select id="edit-person" name="personId" defaultValue={item.personId || ""} className="input">
            <option value="">—</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="edit-key">Key</label>
          <select id="edit-key" name="key" defaultValue={item.key || ""} className="input">
            <option value="">—</option>
            {KEYS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="edit-notes">Notes</label>
        <textarea id="edit-notes" name="notes" rows={3} defaultValue={item.notes || ""} className="input" />
      </div>
      <button type="submit" className="btn-primary w-full">Save changes</button>
    </form>
  );
}
