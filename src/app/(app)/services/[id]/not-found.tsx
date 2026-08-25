import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-md p-10 text-center">
      <p className="text-5xl">🕊️</p>
      <h1 className="mt-4 text-xl font-extrabold text-ink">Not found</h1>
      <p className="mt-2 text-sm text-ink/55">
        This page doesn't exist in your workspace, or you don't have access to it.
      </p>
      <Link href="/dashboard" className="btn-primary mt-6 inline-flex">Back to dashboard</Link>
    </div>
  );
}
