import * as React from &apos;react&apos;;
import * as SwitchPrimitives from &apos;@radix-ui/react-switch&apos;;

import { cn } from &apos;@/lib/utils&apos;;

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      &apos;peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-_visible:outline-none focus-_visible:ring-2 focus-_visible:ring-ring focus-_visible:ring-offset-2 focus-_visible:ring-offset-background _disabled:cursor-not-allowed _disabled:opacity-50
  data-[state = checked]:bg-primary data-[state=unchecked]:bg-input&apos;,
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        &apos;pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform
  data-[state = checked]:translate-x-5 data-[state=unchecked]:translate-x-0&apos;
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
