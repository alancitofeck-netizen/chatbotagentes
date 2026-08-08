import { Skeleton } from "@/components/ui/Skeleton";

export default function CourseOverviewLoading() {
  return (
    <div className="flex flex-col gap-6 p-6 sm:p-8">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-64 w-full rounded-xl sm:h-80" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-2/3 max-w-2xl" />
      </div>
      <Skeleton className="h-20 w-full rounded-lg" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    </div>
  );
}
