import * as React from "react";
import { addDays, format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CalendarDateRangePickerProps {
  date: { from: Date | undefined; to: Date | undefined } | undefined;
  onChange: (date: { from: Date | undefined; to: Date | undefined } | undefined) => void;
  align?: "start" | "center" | "end";
  className?: string;
}

export function CalendarDateRangePicker({
  date,
  onChange,
  className,
  align = "start",
}: CalendarDateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Reset date range
  const handleReset = () => {
    onChange(undefined);
    setIsOpen(false);
  };

  // Add preset date ranges
  const handlePresetsClick = (days: number) => {
    const start = new Date();
    const end = addDays(start, days);
    onChange({ from: start, to: end });
    setIsOpen(false);
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Select date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={align}>
          <div className="space-y-2 p-2">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="text-xs"
                onClick={() => handlePresetsClick(7)}
              >
                Next 7 days
              </Button>
              <Button
                variant="outline"
                className="text-xs"
                onClick={() => handlePresetsClick(30)}
              >
                Next 30 days
              </Button>
              <Button
                variant="outline"
                className="text-xs"
                onClick={() => {
                  const start = new Date();
                  start.setDate(1);
                  const end = new Date();
                  end.setMonth(end.getMonth() + 1);
                  end.setDate(0);
                  onChange({ from: start, to: end });
                  setIsOpen(false);
                }}
              >
                This Month
              </Button>
              <Button
                variant="outline"
                className="text-xs"
                onClick={() => {
                  const date = new Date();
                  const start = new Date(date.getFullYear(), 0, 1);
                  const end = new Date(date.getFullYear(), 11, 31);
                  onChange({ from: start, to: end });
                  setIsOpen(false);
                }}
              >
                This Year
              </Button>
            </div>
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={onChange}
              numberOfMonths={2}
            />
            {date && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  Reset
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}