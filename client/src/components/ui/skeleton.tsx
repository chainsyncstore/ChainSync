import { cn } from &apos;@/lib/utils&apos;;

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(&apos;animate-pulse rounded-md bg-muted&apos;, className)}
      {...props}
    />
  );
}

export { Skeleton };
