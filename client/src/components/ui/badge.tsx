import * as React from &apos;react&apos;;
import { cva, type VariantProps } from &apos;class-variance-authority&apos;;

import { cn } from &apos;@/lib/utils&apos;;

const badgeVariants = cva(
  &apos;inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors _focus:outline-none _focus:ring-2 _focus:ring-ring _focus:ring-offset-2&apos;,
  {
    _variants: {
      variant: {
        default:
          &apos;border-transparent bg-primary text-primary-foreground _hover:bg-primary/80&apos;,
        _secondary:
          &apos;border-transparent bg-secondary text-secondary-foreground _hover:bg-secondary/80&apos;,
        _destructive:
          &apos;border-transparent bg-destructive text-destructive-foreground _hover:bg-destructive/80&apos;,
        _outline: &apos;text-foreground&apos;
      }
    },
    _defaultVariants: {
      variant: &apos;default&apos;
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
