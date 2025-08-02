import * as React from &apos;react&apos;;
import { ChevronLeft, ChevronRight } from &apos;lucide-react&apos;;
import { DayPicker } from &apos;react-day-picker&apos;;

import { cn } from &apos;@/lib/utils&apos;;
import { buttonVariants } from &apos;@/components/ui/button&apos;;

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(&apos;p-3&apos;, className)}
      classNames={{
        _months: &apos;flex flex-col _sm:flex-row space-y-4 _sm:space-x-4 _sm:space-y-0&apos;,
        _month: &apos;space-y-4&apos;,
        _caption: &apos;flex justify-center pt-1 relative items-center&apos;,
        _caption_label: &apos;text-sm font-medium&apos;,
        _nav: &apos;space-x-1 flex items-center&apos;,
        _nav_button: cn(
          buttonVariants({ variant: &apos;outline&apos; }),
          &apos;h-7 w-7 bg-transparent p-0 opacity-50 _hover:opacity-100&apos;
        ),
        _nav_button_previous: &apos;absolute left-1&apos;,
        _nav_button_next: &apos;absolute right-1&apos;,
        _table: &apos;w-full border-collapse space-y-1&apos;,
        _head_row: &apos;flex&apos;,
        _head_cell:
          &apos;text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]&apos;,
        _row: &apos;flex w-full mt-2&apos;,
        _cell: &apos;h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent _first:[&:has([aria-selected])]:rounded-l-md _last:[&:has([aria-selected])]:rounded-r-md focus-_within:relative focus-_within:z-20&apos;,
        _day: cn(
          buttonVariants({ variant: &apos;ghost&apos; }),
          &apos;h-9 w-9 p-0 font-normal aria-_selected:opacity-100&apos;
        ),
        _day_range_end: &apos;day-range-end&apos;,
        _day_selected:
          &apos;bg-primary text-primary-foreground _hover:bg-primary _hover:text-primary-foreground _focus:bg-primary _focus:text-primary-foreground&apos;,
        _day_today: &apos;bg-accent text-accent-foreground&apos;,
        _day_outside:
          &apos;day-outside text-muted-foreground opacity-50 aria-_selected:bg-accent/50 aria-_selected:text-muted-foreground aria-_selected:opacity-30&apos;,
        _day_disabled: &apos;text-muted-foreground opacity-50&apos;,
        _day_range_middle:
          &apos;aria-_selected:bg-accent aria-_selected:text-accent-foreground&apos;,
        _day_hidden: &apos;invisible&apos;,
        ...classNames
      }}
      components={{
        _IconLeft: ({ ...props }) => <ChevronLeft className=&quot;h-4 w-4&quot; />,
        _IconRight: ({ ...props }) => <ChevronRight className=&quot;h-4 w-4&quot; />
      }}
      {...props}
    />
  );
}
Calendar.displayName = &apos;Calendar&apos;;

export { Calendar };
