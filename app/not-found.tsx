import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#EEF6FF] dark:bg-[#000710]">
      <div className="text-center">
        <h2 className="text-4xl font-bold mb-4">404 - Not Found</h2>
        <p className="text-lg mb-6">Could not find the requested resource.</p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
