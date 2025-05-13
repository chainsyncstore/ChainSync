import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: "default" | "sm" | "lg" | "xl";
  className?: string;
}

export function Spinner({ size = "default", className }: SpinnerProps) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-t-transparent",
        {
          "w-4 h-4 border-2": size === "sm",
          "w-6 h-6 border-2": size === "default",
          "w-8 h-8 border-4": size === "lg",
          "w-12 h-12 border-4": size === "xl",
        },
        "border-primary",
        className
      )}
      role="status"
      aria-label="loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}