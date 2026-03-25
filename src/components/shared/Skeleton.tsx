import { cn } from '@/lib/utils';

/**
 * Minimal shimmer placeholder for async content.
 * Use `variant="fullscreen"` for main view suspense fallbacks,
 * `variant="inline"` for smaller content areas.
 */
export function Skeleton({ variant = 'fullscreen' }: { variant?: 'fullscreen' | 'inline' }) {
  if (variant === 'inline') {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="h-4 w-32 rounded-full bg-white/[0.03] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col h-full w-full bg-bg">
      {/* Title bar space */}
      <div className="h-12 shrink-0" />

      {/* Shimmer content area */}
      <div className="flex-1 px-16 pt-12">
        <div className="max-w-[1400px] mx-auto flex flex-col gap-8">
          {/* Headline placeholder */}
          <div className="flex flex-col gap-3">
            <div className="h-10 w-80 rounded-lg bg-white/[0.03] animate-pulse" />
            <div className="h-4 w-48 rounded-full bg-white/[0.02] animate-pulse" />
          </div>

          {/* Content block placeholders */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 mt-8">
            <div className="lg:col-span-7 flex flex-col gap-6">
              <div className={cn('h-24 rounded-2xl bg-white/[0.02] animate-pulse')} />
              <div className={cn('h-24 rounded-2xl bg-white/[0.02] animate-pulse')} style={{ animationDelay: '150ms' }} />
              <div className={cn('h-24 rounded-2xl bg-white/[0.02] animate-pulse')} style={{ animationDelay: '300ms' }} />
            </div>
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className={cn('h-40 rounded-2xl bg-white/[0.02] animate-pulse')} style={{ animationDelay: '100ms' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
