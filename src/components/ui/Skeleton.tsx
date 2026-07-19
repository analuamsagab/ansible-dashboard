export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-700/50 rounded ${className || ''}`} />
  )
}

export function CardSkeleton() {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-8 w-full" />
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}
