import * as React from &apos;react&apos;;
import * as ScrollAreaPrimitive from &apos;@radix-ui/react-scroll-area&apos;;

import { cn } from &apos;@/lib/utils&apos;;

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn(&apos;relative overflow-hidden&apos;, className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport className=&quot;h-full w-full rounded-[inherit]&quot;>
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = &apos;vertical&apos;, ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      &apos;flex touch-none select-none transition-colors&apos;,
      orientation === &apos;vertical&apos; &&
        &apos;h-full w-2.5 border-l border-l-transparent p-[1px]&apos;,
      orientation === &apos;horizontal&apos; &&
        &apos;h-2.5 flex-col border-t border-t-transparent p-[1px]&apos;,
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className=&quot;relative flex-1 rounded-full bg-border&quot; />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };
