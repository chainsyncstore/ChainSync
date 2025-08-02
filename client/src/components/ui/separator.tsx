import * as React from &apos;react&apos;;
import * as SeparatorPrimitive from &apos;@radix-ui/react-separator&apos;;

import { cn } from &apos;@/lib/utils&apos;;

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(
  (
    { className, orientation = &apos;horizontal&apos;, decorative = true, ...props },
    ref
  ) => (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        &apos;shrink-0 bg-border&apos;,
        orientation === &apos;horizontal&apos; ? &apos;h-[1px] w-full&apos; : &apos;h-full w-[1px]&apos;,
        className
      )}
      {...props}
    />
  )
);
Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };
