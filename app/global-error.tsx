"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="bg-[#EEF6FF] dark:bg-[#000710] flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-4xl font-bold mb-4">Something went wrong!</h2>
          <p className="text-lg mb-6">A global error has occurred.</p>
          <button
            className="inline-block px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            onClick={() => reset()}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
