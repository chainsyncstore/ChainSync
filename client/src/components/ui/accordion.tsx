import * as React from &apos;react&apos;;
import * as AccordionPrimitive from &apos;@radix-ui/react-accordion&apos;;
import { ChevronDown } from &apos;lucide-react&apos;;

import { cn } from &apos;@/lib/utils&apos;;

const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn(&apos;border-b&apos;, className)}
    {...props}
  />
));
AccordionItem.displayName = &apos;AccordionItem&apos;;

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className=&quot;flex&quot;>
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        &apos;flex flex-1 items-center justify-between py-4 font-medium transition-all _hover:underline
  [&[data-state = open]>svg]:rotate-180&apos;,
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className=&quot;h-4 w-4 shrink-0 transition-transform duration-200&quot; />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className=&quot;overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down&quot;
    {...props}
  >
    <div className={cn(&apos;pb-4 pt-0&apos;, className)}>{children}</div>
  </AccordionPrimitive.Content>
));

AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
