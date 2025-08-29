import { Suspense } from "react";
import VerificationContainer from "./components/VerificationContainer";

interface VerificationPageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function VerificationPage({
  params,
}: VerificationPageProps) {
  const { token } = await params;

  return (
    <main className="fixed inset-0 overflow-auto bg-gradient-to-br from-background via-content1 to-content2">
      <div className="min-h-full flex items-center justify-center p-4">
        <Suspense fallback={<VerificationSkeleton />}>
          <VerificationContainer token={token} />
        </Suspense>
      </div>
    </main>
  );
}

// Loading skeleton component
function VerificationSkeleton() {
  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="bg-content1/80 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-divider/20">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 bg-default-200 rounded-full animate-pulse mx-auto" />
          <div className="space-y-3">
            <div className="h-7 bg-default-200 rounded-lg animate-pulse" />
            <div className="h-4 bg-default-100 rounded animate-pulse mx-8" />
          </div>
          <div className="h-1 bg-default-200 rounded animate-pulse" />
          <div className="space-y-2">
            <div className="h-3 bg-default-100 rounded animate-pulse" />
            <div className="h-3 bg-default-100 rounded animate-pulse mx-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
