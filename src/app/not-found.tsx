import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="card max-w-md p-10 text-center">
        <p className="text-5xl">🕊️</p>
        <h1 className="mt-4 text-xl font-extrabold text-ink">Page not found</h1>
        <p className="mt-2 text-sm text-ink/55">The page you're looking for doesn't exist.</p>
        <Link href="/dashboard" className="btn-primary mt-6 inline-flex">Back to dashboard</Link>
      </div>
    </div>
  );
}
