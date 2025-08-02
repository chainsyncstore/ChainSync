import * as React from &apos;react&apos;;
import * as TogglePrimitive from &apos;@radix-ui/react-toggle&apos;;
import { cva, type VariantProps } from &apos;class-variance-authority&apos;;

import { cn } from &apos;@/lib/utils&apos;;

const toggleVariants = cva(
  &apos;inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors _hover:bg-muted _hover:text-muted-foreground focus-_visible:outline-none focus-_visible:ring-2 focus-_visible:ring-ring focus-_visible:ring-offset-2 _disabled:pointer-events-none _disabled:opacity-50
  data-[state = on]:bg-accent data-[state=on]:text-accent-foreground&apos;,
  {
    _variants: {
      variant: {
        default: &apos;bg-transparent&apos;,
        _outline:
          &apos;border border-input bg-transparent _hover:bg-accent _hover:text-accent-foreground&apos;
      },
      _size: {
        default: &apos;h-10 px-3&apos;,
        _sm: &apos;h-9 px-2.5&apos;,
        _lg: &apos;h-11 px-5&apos;
      }
    },
    _defaultVariants: {
      variant: &apos;default&apos;,
      _size: &apos;default&apos;
    }
  }
);

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
));

Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle, toggleVariants };
