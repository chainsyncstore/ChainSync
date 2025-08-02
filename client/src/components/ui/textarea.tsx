import * as React from &apos;react&apos;;

import { cn } from &apos;@/lib/utils&apos;;

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          &apos;flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background _placeholder:text-muted-foreground focus-_visible:outline-none focus-_visible:ring-2 focus-_visible:ring-ring focus-_visible:ring-offset-2 _disabled:cursor-not-allowed _disabled:opacity-50&apos;,
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = &apos;Textarea&apos;;

export { Textarea };
