import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ 
  currentPage, 
  totalPages, 
  onPageChange,
  className
}: PaginationProps) {
  // Don't render if there's only 1 or fewer pages
  if (totalPages <= 1) {
    return null;
  }

  // Function to create page range
  const createPageRange = () => {
    const maxPagesBeforeCurrentPage = 3;
    const maxPagesAfterCurrentPage = 3;

    let startPage = Math.max(1, currentPage - maxPagesBeforeCurrentPage);
    let endPage = Math.min(totalPages, currentPage + maxPagesAfterCurrentPage);

    // Show 3 pages at the beginning, then ellipsis if needed
    if (startPage > 2) {
      startPage = 3;
    }

    // Show 3 pages at the end, then ellipsis if needed
    if (endPage < totalPages - 1) {
      endPage = totalPages - 2;
    }

    const pages = [];

    // Always show first page
    if (startPage > 1) {
      pages.push(1);
    }

    // Add ellipsis after first page if needed
    if (startPage > 3) {
      pages.push(-1); // Use -1 to represent ellipsis
    } else if (startPage === 3) {
      pages.push(2); // Show 2 if it's adjacent
    }

    // Add range of pages
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    // Add ellipsis before last page if needed
    if (endPage < totalPages - 2) {
      pages.push(-2); // Use -2 to represent ellipsis
    } else if (endPage === totalPages - 2) {
      pages.push(totalPages - 1); // Show second-to-last if it's adjacent
    }

    // Always show last page
    if (endPage < totalPages) {
      pages.push(totalPages);
    }

    return pages;
  };

  const pages = createPageRange();

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      {pages.map((page, i) => {
        if (page < 0) {
          // Render ellipsis
          return (
            <Button
              key={`ellipsis-${i}`}
              variant="outline"
              size="icon"
              disabled
              aria-hidden="true"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          );
        }
        
        return (
          <Button
            key={page}
            variant={currentPage === page ? "default" : "outline"}
            onClick={() => onPageChange(page)}
            className={cn(
              "hidden sm:inline-flex",
              { "bg-primary text-primary-foreground": currentPage === page }
            )}
          >
            {page}
          </Button>
        );
      })}
      
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage >= totalPages}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}