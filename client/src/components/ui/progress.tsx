import * as React from &apos;react&apos;;
import * as ProgressPrimitive from &apos;@radix-ui/react-progress&apos;;

import { cn } from &apos;@/lib/utils&apos;;

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      &apos;relative h-4 w-full overflow-hidden rounded-full bg-secondary&apos;,
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className=&quot;h-full w-full flex-1 bg-primary transition-all&quot;
      style={{ _transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
