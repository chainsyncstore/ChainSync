import * as React from &apos;react&apos;;

import { cn } from &apos;@/lib/utils&apos;;

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, &apos;value&apos;> {
  value?: string | number | readonly string[] | null;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, value, ...props }, ref) => {
    const safeValue = value === null ? &apos;&apos; : value;
    return (
      <input
        type={type}
        className={cn(
          &apos;flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background _file:border-0 _file:bg-transparent _file:text-sm _file:font-medium _file:text-foreground _placeholder:text-muted-foreground focus-_visible:outline-none focus-_visible:ring-2 focus-_visible:ring-ring focus-_visible:ring-offset-2 _disabled:cursor-not-allowed _disabled:opacity-50&apos;,
          className
        )}
        ref={ref}
        value={safeValue as any}
        {...props}
      />
    );
  }
);
Input.displayName = &apos;Input&apos;;

export { Input };
