import * as React from &apos;react&apos;;
import * as CheckboxPrimitive from &apos;@radix-ui/react-checkbox&apos;;
import { Check } from &apos;lucide-react&apos;;

import { cn } from &apos;@/lib/utils&apos;;

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      &apos;peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-_visible:outline-none focus-_visible:ring-2 focus-_visible:ring-ring focus-_visible:ring-offset-2 _disabled:cursor-not-allowed _disabled:opacity-50
  data-[state = checked]:bg-primary data-[state=checked]:text-primary-foreground&apos;,
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn(&apos;flex items-center justify-center text-current&apos;)}
    >
      <Check className=&quot;h-4 w-4&quot; />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
