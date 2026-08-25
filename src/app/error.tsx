"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="card max-w-md p-10 text-center">
        <p className="text-5xl">🎼</p>
        <h1 className="mt-4 text-xl font-extrabold text-ink">Something went off-key</h1>
        <p className="mt-2 text-sm text-ink/55">
          An unexpected error occurred. Try again — your data is safe.
        </p>
        <button onClick={reset} className="btn-primary mt-6">Try again</button>
      </div>
    </div>
  );
}
