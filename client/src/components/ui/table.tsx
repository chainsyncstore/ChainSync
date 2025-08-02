import * as React from &apos;react&apos;;

import { cn } from &apos;@/lib/utils&apos;;

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className=&quot;relative w-full overflow-auto&quot;>
    <table
      ref={ref}
      className={cn(&apos;w-full caption-bottom text-sm&apos;, className)}
      {...props}
    />
  </div>
));
Table.displayName = &apos;Table&apos;;

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn(&apos;[&_tr]:border-b&apos;, className)} {...props} />
));
TableHeader.displayName = &apos;TableHeader&apos;;

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn(&apos;[&_tr:last-child]:border-0&apos;, className)}
    {...props}
  />
));
TableBody.displayName = &apos;TableBody&apos;;

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      &apos;border-t bg-muted/50 font-medium [&>tr]:_last:border-b-0&apos;,
      className
    )}
    {...props}
  />
));
TableFooter.displayName = &apos;TableFooter&apos;;

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      &apos;border-b transition-colors _hover:bg-muted/50 data-[state=selected]:bg-muted&apos;,
      className
    )}
    {...props}
  />
));
TableRow.displayName = &apos;TableRow&apos;;

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      &apos;h-12 px-4 text-left align-middle font-medium text-muted-foreground
  [&:has([role = checkbox])]:pr-0&apos;,
      className
    )}
    {...props}
  />
));
TableHead.displayName = &apos;TableHead&apos;;

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(&apos;p-4 align-middle [&:has([role=checkbox])]:pr-0&apos;, className)}
    {...props}
  />
));
TableCell.displayName = &apos;TableCell&apos;;

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn(&apos;mt-4 text-sm text-muted-foreground&apos;, className)}
    {...props}
  />
));
TableCaption.displayName = &apos;TableCaption&apos;;

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption
};
