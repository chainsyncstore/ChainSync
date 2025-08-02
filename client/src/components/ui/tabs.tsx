import * as React from &apos;react&apos;;
import * as TabsPrimitive from &apos;@radix-ui/react-tabs&apos;;

import { cn } from &apos;@/lib/utils&apos;;

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      &apos;inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground&apos;,
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      &apos;inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-_visible:outline-none focus-_visible:ring-2 focus-_visible:ring-ring focus-_visible:ring-offset-2 _disabled:pointer-events-none _disabled:opacity-50
  data-[state = active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm&apos;,
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      &apos;mt-2 ring-offset-background focus-_visible:outline-none focus-_visible:ring-2 focus-_visible:ring-ring focus-_visible:ring-offset-2&apos;,
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
