import * as React from &apos;react&apos;;
import { cva, type VariantProps } from &apos;class-variance-authority&apos;;

import { cn } from &apos;@/lib/utils&apos;;

const alertVariants = cva(
  &apos;relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground&apos;,
  {
    _variants: {
      variant: {
        default: &apos;bg-background text-foreground&apos;,
        _destructive:
          &apos;border-destructive/50 text-destructive _dark:border-destructive [&>svg]:text-destructive&apos;
      }
    },
    _defaultVariants: {
      variant: &apos;default&apos;
    }
  }
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role=&quot;alert&quot;
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
));
Alert.displayName = &apos;Alert&apos;;

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn(&apos;mb-1 font-medium leading-none tracking-tight&apos;, className)}
    {...props}
  />
));
AlertTitle.displayName = &apos;AlertTitle&apos;;

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(&apos;text-sm [&_p]:leading-relaxed&apos;, className)}
    {...props}
  />
));
AlertDescription.displayName = &apos;AlertDescription&apos;;

export { Alert, AlertTitle, AlertDescription };
