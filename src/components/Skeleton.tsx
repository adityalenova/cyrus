/* ══ Skeleton.tsx — reusable skeleton loaders ═══════════════════════ */

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: "sm" | "md" | "lg" | "xl" | "full" | "2xl";
}

export function Skeleton({ className = "", width, height, rounded = "md" }: SkeletonProps) {
  const roundedClass = { sm: "rounded-sm", md: "rounded-md", lg: "rounded-lg", xl: "rounded-xl", full: "rounded-full", "2xl": "rounded-2xl" };
  return (
    <div
      className={`animate-pulse bg-line/60 ${roundedClass[rounded]} ${className}`}
      style={{ width, height }}
      role="status"
      aria-label="Loading..."
    />
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="bg-card rounded-2xl border border-line p-5 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10" rounded="full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-6 w-16" rounded="full" />
        <Skeleton className="h-6 w-20" rounded="full" />
        <Skeleton className="h-6 w-14" rounded="full" />
      </div>
    </div>
  );
}

export function HackathonListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-card rounded-xl border border-line">
          <Skeleton className="w-12 h-12" rounded="lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-8 w-24" rounded="lg" />
        </div>
      ))}
    </div>
  );
}

export function OrgProfileSkeleton() {
  return (
    <div className="bg-card rounded-2xl border border-line p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="w-16 h-16" rounded="2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <div className="grid grid-cols-3 gap-4 pt-2">
        <Skeleton className="h-20" rounded="xl" />
        <Skeleton className="h-20" rounded="xl" />
        <Skeleton className="h-20" rounded="xl" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 8, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-card rounded-2xl border border-line overflow-hidden">
      <div className="flex gap-4 px-5 py-3 border-b border-line">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-5 py-3 border-b border-line/50">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-3 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
