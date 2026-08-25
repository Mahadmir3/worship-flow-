import Link from "next/link";
import { FileAudio, FileText, FileVideo, FolderOpen, Image, Link2, Pencil, Trash2, Upload } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MEDIA_FOLDERS } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { addMediaLink, deleteMedia, moveMedia, renameMedia, uploadMedia } from "@/actions/media";

export const metadata = { title: "Media library" };

const TYPE_ICON: Record<string, React.ReactNode> = {
  AUDIO: <FileAudio className="h-5 w-5" />,
  VIDEO: <FileVideo className="h-5 w-5" />,
  PDF: <FileText className="h-5 w-5" />,
  IMAGE: <Image className="h-5 w-5" />,
  LINK: <Link2 className="h-5 w-5" />,
  FILE: <FileText className="h-5 w-5" />,
};

export default async function MediaPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{ folder?: string }> }) {
  const searchParams = await searchParamsPromise;
  const user = await requireUser();
  const folder = MEDIA_FOLDERS.some((f) => f.id === searchParams.folder)
    ? searchParams.folder!
    : "songs";

  const files = await prisma.mediaFile.findMany({
    where: { organizationId: user.organizationId, folder },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Media library</h1>
          <p className="mt-1 text-sm text-ink/50">{files.length} files in {MEDIA_FOLDERS.find((f) => f.id === folder)?.label}</p>
        </div>
        <div className="flex gap-2">
          <Modal
            title="Upload a file"
            subtitle="Stored via the pluggable storage provider (local disk in demo)."
            trigger={<button className="btn-primary"><Upload className="h-4 w-4" /> Upload</button>}
          >
            <form action={uploadMedia} className="space-y-4" encType="multipart/form-data">
              <div>
                <label className="label" htmlFor="up-file">File</label>
                <input id="up-file" name="file" type="file" required className="input py-2" />
              </div>
              <div>
                <label className="label" htmlFor="up-folder">Folder</label>
                <select id="up-folder" name="folder" className="input" defaultValue={folder}>
                  {MEDIA_FOLDERS.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>
              <button className="btn-primary w-full">Upload file</button>
            </form>
          </Modal>
          <Modal
            title="Add a link"
            trigger={<button className="btn-secondary"><Link2 className="h-4 w-4" /> Add link</button>}
          >
            <form action={addMediaLink} className="space-y-4">
              <input type="hidden" name="folder" value={folder} />
              <div>
                <label className="label" htmlFor="ln-name">Name</label>
                <input id="ln-name" name="name" required className="input" placeholder="e.g. Sermon slides (Google Slides)" />
              </div>
              <div>
                <label className="label" htmlFor="ln-url">URL</label>
                <input id="ln-url" name="url" required type="url" className="input" placeholder="https://…" />
              </div>
              <div>
                <label className="label" htmlFor="ln-type">Type</label>
                <select id="ln-type" name="type" className="input">
                  <option value="LINK">Link</option>
                  <option value="AUDIO">Audio</option>
                  <option value="VIDEO">Video</option>
                  <option value="PDF">PDF</option>
                  <option value="IMAGE">Image</option>
                </select>
              </div>
              <button className="btn-primary w-full">Add to library</button>
            </form>
          </Modal>
        </div>
      </div>

      {/* Folder tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Media folders">
        {MEDIA_FOLDERS.map((f) => (
          <Link
            key={f.id}
            href={`/media?folder=${f.id}`}
            role="tab"
            aria-selected={folder === f.id}
            className={`chip whitespace-nowrap px-4 py-2 ${folder === f.id ? "border-brand-700 bg-brand-700 text-white" : "border-line bg-white text-ink/65 hover:border-brand-300"}`}
          >
            <FolderOpen className="mr-1 inline h-3.5 w-3.5" /> {f.label}
          </Link>
        ))}
      </div>

      {files.length === 0 ? (
        <div className="card">
          <EmptyState icon={<FolderOpen className="h-6 w-6" />} title="This folder is empty" hint="Upload files or link external resources like YouTube videos and Google Slides." />
        </div>
      ) : (
        <div className="card divide-y divide-line/70 overflow-hidden">
          {files.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                {TYPE_ICON[f.type] || TYPE_ICON.FILE}
              </span>
              <div className="min-w-0 flex-1">
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="block truncate font-semibold text-ink hover:text-brand-700">
                  {f.name}
                </a>
                <p className="truncate text-xs text-ink/45">
                  {f.type.toLowerCase()} · {f.sizeKb ? `${f.sizeKb} KB` : "external"} · {fmtDate(f.createdAt.toISOString().slice(0, 10), { year: undefined })}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Modal
                  title="Rename"
                  trigger={
                    <button className="rounded-lg p-2 text-ink/35 hover:bg-brand-50 hover:text-ink" aria-label={`Rename ${f.name}`}>
                      <Pencil className="h-4 w-4" />
                    </button>
                  }
                >
                  <form action={renameMedia} className="space-y-4">
                    <input type="hidden" name="mediaId" value={f.id} />
                    <div>
                      <label className="label" htmlFor="rn-name">New name</label>
                      <input id="rn-name" name="name" defaultValue={f.name} className="input" required />
                    </div>
                    <button className="btn-primary w-full">Rename</button>
                  </form>
                </Modal>
                <Modal
                  title="Move to folder"
                  trigger={
                    <button className="rounded-lg p-2 text-ink/35 hover:bg-brand-50 hover:text-ink" aria-label={`Move ${f.name}`}>
                      <FolderOpen className="h-4 w-4" />
                    </button>
                  }
                >
                  <form action={moveMedia} className="space-y-4">
                    <input type="hidden" name="mediaId" value={f.id} />
                    <div>
                      <label className="label" htmlFor="mv-folder">Folder</label>
                      <select id="mv-folder" name="folder" className="input" defaultValue={f.folder}>
                        {MEDIA_FOLDERS.map((fd) => (
                          <option key={fd.id} value={fd.id}>{fd.label}</option>
                        ))}
                      </select>
                    </div>
                    <button className="btn-primary w-full">Move file</button>
                  </form>
                </Modal>
                <form action={deleteMedia}>
                  <input type="hidden" name="mediaId" value={f.id} />
                  <button className="rounded-lg p-2 text-ink/35 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete ${f.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
