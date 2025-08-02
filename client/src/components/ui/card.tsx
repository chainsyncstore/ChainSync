import * as React from &apos;react&apos;;

import { cn } from &apos;@/lib/utils&apos;;

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      &apos;rounded-lg border bg-card text-card-foreground shadow-sm&apos;,
      className
    )}
    {...props}
  />
));
Card.displayName = &apos;Card&apos;;

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(&apos;flex flex-col space-y-1.5 p-6&apos;, className)}
    {...props}
  />
));
CardHeader.displayName = &apos;CardHeader&apos;;

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      &apos;text-2xl font-semibold leading-none tracking-tight&apos;,
      className
    )}
    {...props}
  />
));
CardTitle.displayName = &apos;CardTitle&apos;;

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(&apos;text-sm text-muted-foreground&apos;, className)}
    {...props}
  />
));
CardDescription.displayName = &apos;CardDescription&apos;;

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn(&apos;p-6 pt-0&apos;, className)} {...props} />
));
CardContent.displayName = &apos;CardContent&apos;;

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(&apos;flex items-center p-6 pt-0&apos;, className)}
    {...props}
  />
));
CardFooter.displayName = &apos;CardFooter&apos;;

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
