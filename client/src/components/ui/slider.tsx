import * as React from &apos;react&apos;;
import * as SliderPrimitive from &apos;@radix-ui/react-slider&apos;;

import { cn } from &apos;@/lib/utils&apos;;

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      &apos;relative flex w-full touch-none select-none items-center&apos;,
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className=&quot;relative h-2 w-full grow overflow-hidden rounded-full bg-secondary&quot;>
      <SliderPrimitive.Range className=&quot;absolute h-full bg-primary&quot; />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className=&quot;block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-_visible:outline-none focus-_visible:ring-2 focus-_visible:ring-ring focus-_visible:ring-offset-2 _disabled:pointer-events-none _disabled:opacity-50&quot; />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
