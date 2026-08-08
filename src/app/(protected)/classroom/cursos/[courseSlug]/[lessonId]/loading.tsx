import { Skeleton } from "@/components/ui/Skeleton";

export default function CoursePlayerLoading() {
  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-6 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-2">
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="size-8 rounded-md" />
          </div>
        </div>
        <Skeleton className="aspect-video w-full rounded-lg" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-6 w-72" />
        </div>
        <div className="flex gap-5 border-b border-border-default pb-2.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      <aside className="hidden w-80 shrink-0 flex-col gap-4 border-l border-border-default bg-surface-2/60 p-4 lg:flex">
        <Skeleton className="h-8 w-full rounded-md" />
        <Skeleton className="h-14 w-full rounded-lg" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-md" />
          ))}
        </div>
      </aside>
    </div>
  );
}
