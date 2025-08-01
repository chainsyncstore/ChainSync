import * as React from &apos;react&apos;;
import * as ToastPrimitives from &apos;@radix-ui/react-toast&apos;;
import { cva, type VariantProps } from &apos;class-variance-authority&apos;;
import { X } from &apos;lucide-react&apos;;

import { cn } from &apos;@/lib/utils&apos;;

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      &apos;fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 _sm:bottom-0 _sm:right-0 _sm:top-auto _sm:flex-col _md:max-w-[420px]&apos;,
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  &apos;group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0
  data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:_sm:slide-in-from-bottom-full&apos;,
  {
    _variants: {
      variant: {
        default: &apos;border bg-background text-foreground&apos;,
        _destructive:
          &apos;destructive group border-destructive bg-destructive text-destructive-foreground&apos;
      }
    },
    _defaultVariants: {
      variant: &apos;default&apos;
    }
  }
);

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  );
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      &apos;inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors _hover:bg-secondary _focus:outline-none _focus:ring-2 _focus:ring-ring _focus:ring-offset-2 _disabled:pointer-events-none _disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:_hover:border-destructive/30 group-[.destructive]:_hover:bg-destructive group-[.destructive]:_hover:text-destructive-foreground group-[.destructive]:_focus:ring-destructive&apos;,
      className
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      &apos;absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity _hover:text-foreground _focus:opacity-100 _focus:outline-none _focus:ring-2 group-_hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:_hover:text-red-50 group-[.destructive]:_focus:ring-red-400 group-[.destructive]:_focus:ring-offset-red-600&apos;,
      className
    )}
    toast-close=&quot;&quot;
    {...props}
  >
    <X className=&quot;h-4 w-4&quot; />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn(&apos;text-sm font-semibold&apos;, className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn(&apos;text-sm opacity-90&apos;, className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction
};
