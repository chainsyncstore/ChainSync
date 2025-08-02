import * as React from &apos;react&apos;;
import * as RadioGroupPrimitive from &apos;@radix-ui/react-radio-group&apos;;
import { Circle } from &apos;lucide-react&apos;;

import { cn } from &apos;@/lib/utils&apos;;

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn(&apos;grid gap-2&apos;, className)}
      {...props}
      ref={ref}
    />
  );
});
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        &apos;aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background _focus:outline-none focus-_visible:ring-2 focus-_visible:ring-ring focus-_visible:ring-offset-2 _disabled:cursor-not-allowed _disabled:opacity-50&apos;,
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className=&quot;flex items-center justify-center&quot;>
        <Circle className=&quot;h-2.5 w-2.5 fill-current text-current&quot; />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
});
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem };
