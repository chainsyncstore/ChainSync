import * as React from &apos;react&apos;;
import { Slot } from &apos;@radix-ui/react-slot&apos;;
import { ChevronRight, MoreHorizontal } from &apos;lucide-react&apos;;

import { cn } from &apos;@/lib/utils&apos;;

const Breadcrumb = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<&apos;nav&apos;> & {
    separator?: React.ReactNode
  }
>(({ ...props }, ref) => <nav ref={ref} aria-label=&quot;breadcrumb&quot; {...props} />);
Breadcrumb.displayName = &apos;Breadcrumb&apos;;

const BreadcrumbList = React.forwardRef<
  HTMLOListElement,
  React.ComponentPropsWithoutRef<&apos;ol&apos;>
>(({ className, ...props }, ref) => (
  <ol
    ref={ref}
    className={cn(
      &apos;flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground _sm:gap-2.5&apos;,
      className
    )}
    {...props}
  />
));
BreadcrumbList.displayName = &apos;BreadcrumbList&apos;;

const BreadcrumbItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentPropsWithoutRef<&apos;li&apos;>
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn(&apos;inline-flex items-center gap-1.5&apos;, className)}
    {...props}
  />
));
BreadcrumbItem.displayName = &apos;BreadcrumbItem&apos;;

const BreadcrumbLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<&apos;a&apos;> & {
    asChild?: boolean
  }
>(({ asChild, className, ...props }, ref) => {
  const Comp = asChild ? _Slot : &apos;a&apos;;

  return (
    <Comp
      ref={ref}
      className={cn(&apos;transition-colors _hover:text-foreground&apos;, className)}
      {...props}
    />
  );
});
BreadcrumbLink.displayName = &apos;BreadcrumbLink&apos;;

const BreadcrumbPage = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<&apos;span&apos;>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    role=&quot;link&quot;
    aria-disabled=&quot;true&quot;
    aria-current=&quot;page&quot;
    className={cn(&apos;font-normal text-foreground&apos;, className)}
    {...props}
  />
));
BreadcrumbPage.displayName = &apos;BreadcrumbPage&apos;;

const BreadcrumbSeparator = ({
  children,
  className,
  ...props
}: React.ComponentProps<&apos;li&apos;>) => (
  <li
    role=&quot;presentation&quot;
    aria-hidden=&quot;true&quot;
    className={cn(&apos;[&>svg]:w-3.5 [&>svg]:h-3.5&apos;, className)}
    {...props}
  >
    {children ?? <ChevronRight />}
  </li>
);
BreadcrumbSeparator.displayName = &apos;BreadcrumbSeparator&apos;;

const BreadcrumbEllipsis = ({
  className,
  ...props
}: React.ComponentProps<&apos;span&apos;>) => (
  <span
    role=&quot;presentation&quot;
    aria-hidden=&quot;true&quot;
    className={cn(&apos;flex h-9 w-9 items-center justify-center&apos;, className)}
    {...props}
  >
    <MoreHorizontal className=&quot;h-4 w-4&quot; />
    <span className=&quot;sr-only&quot;>More</span>
  </span>
);
BreadcrumbEllipsis.displayName = &apos;BreadcrumbElipssis&apos;;

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis
};
