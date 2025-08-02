import * as React from &apos;react&apos;;
import { Slot } from &apos;@radix-ui/react-slot&apos;;
import { cva, type VariantProps } from &apos;class-variance-authority&apos;;

import { cn } from &apos;@/lib/utils&apos;;

const buttonVariants = cva(
  &apos;inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-_visible:outline-none focus-_visible:ring-2 focus-_visible:ring-ring focus-_visible:ring-offset-2 _disabled:pointer-events-none _disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0&apos;,
  {
    _variants: {
      variant: {
        default: &apos;bg-primary text-primary-foreground _hover:bg-primary/90&apos;,
        _destructive:
          &apos;bg-destructive text-destructive-foreground _hover:bg-destructive/90&apos;,
        _outline:
          &apos;border border-input bg-background _hover:bg-accent _hover:text-accent-foreground&apos;,
        _secondary:
          &apos;bg-secondary text-secondary-foreground _hover:bg-secondary/80&apos;,
        _ghost: &apos;_hover:bg-accent _hover:text-accent-foreground&apos;,
        _link: &apos;text-primary underline-offset-4 _hover:underline&apos;
      },
      _size: {
        default: &apos;h-10 px-4 py-2&apos;,
        _sm: &apos;h-9 rounded-md px-3&apos;,
        _lg: &apos;h-11 rounded-md px-8&apos;,
        _icon: &apos;h-10 w-10&apos;
      }
    },
    _defaultVariants: {
      variant: &apos;default&apos;,
      _size: &apos;default&apos;
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? _Slot : &apos;button&apos;;
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = &apos;Button&apos;;

export { Button, buttonVariants };
