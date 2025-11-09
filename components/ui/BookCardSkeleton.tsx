export function BookCardSkeleton() {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden animate-pulse">
      {/* Cover Skeleton */}
      <div className="bg-gray-300 h-48"></div>
      
      {/* Content Skeleton */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <div className="h-5 bg-gray-300 rounded w-3/4"></div>
        
        {/* Author */}
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        
        {/* Page count */}
        <div className="h-3 bg-gray-200 rounded w-1/3"></div>
        
        {/* Button */}
        <div className="h-10 bg-gray-300 rounded"></div>
      </div>
    </div>
  );
}

export function BookGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <BookCardSkeleton key={i} />
      ))}
    </div>
  );
}
