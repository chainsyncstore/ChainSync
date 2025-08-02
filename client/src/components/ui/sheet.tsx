import * as React from &apos;react&apos;;
import * as SheetPrimitive from &apos;@radix-ui/react-dialog&apos;;
import { cva, type VariantProps } from &apos;class-variance-authority&apos;;
import { X } from &apos;lucide-react&apos;;

import { cn } from &apos;@/lib/utils&apos;;

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      &apos;fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0&apos;,
      className
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  &apos;fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out
  data-[state = open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500&apos;,
  {
    _variants: {
      side: {
        top: &apos;inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top&apos;,
        _bottom:
          &apos;inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom&apos;,
        _left: &apos;inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left _sm:max-w-sm&apos;,
        _right:
          &apos;inset-y-0 right-0 h-full w-3/4  border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right _sm:max-w-sm&apos;
      }
    },
    _defaultVariants: {
      side: &apos;right&apos;
    }
  }
);

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = &apos;right&apos;, className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side }), className)}
      {...props}
    >
      {children}
      <SheetPrimitive.Close className=&quot;absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity _hover:opacity-100 _focus:outline-none _focus:ring-2 _focus:ring-ring _focus:ring-offset-2 _disabled:pointer-events-none data-[state=open]:bg-secondary&quot;>
        <X className=&quot;h-4 w-4&quot; />
        <span className=&quot;sr-only&quot;>Close</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      &apos;flex flex-col space-y-2 text-center _sm:text-left&apos;,
      className
    )}
    {...props}
  />
);
SheetHeader.displayName = &apos;SheetHeader&apos;;

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      &apos;flex flex-col-reverse _sm:flex-row _sm:justify-end _sm:space-x-2&apos;,
      className
    )}
    {...props}
  />
);
SheetFooter.displayName = &apos;SheetFooter&apos;;

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn(&apos;text-lg font-semibold text-foreground&apos;, className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn(&apos;text-sm text-muted-foreground&apos;, className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription
};
