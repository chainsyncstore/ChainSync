import React from &apos;react&apos;;
import { useQuery } from &apos;@tanstack/react-query&apos;;
import { format } from &apos;date-fns&apos;;
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from &apos;@/components/ui/table&apos;;
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from &apos;@/components/ui/tooltip&apos;;
import { Badge } from &apos;@/components/ui/badge&apos;;
import { ScrollArea } from &apos;@/components/ui/scroll-area&apos;;
import { Loader2, Info } from &apos;lucide-react&apos;;

interface BatchAuditLog {
  _id: number;
  _batchId: number;
  _userId: number;
  _action: string;
  _details: any;
  quantityBefore?: number;
  quantityAfter?: number;
  _createdAt: string;
  user?: {
    _id: number;
    _username: string;
    name?: string;
  };
}

interface BatchAuditLogProps {
  _batchId: number;
}

export function BatchAuditLog({ batchId }: BatchAuditLogProps) {
  const { _data: logs, isLoading, error } = useQuery<BatchAuditLog[]>({
    _queryKey: [`/api/inventory/batches/${batchId}/audit-logs`],
    _enabled: !!batchId
  });

  if (isLoading) {
    return (
      <div className=&quot;flex items-center justify-center p-4 min-h-[200px]&quot;>
        <Loader2 className=&quot;h-8 w-8 animate-spin text-primary&quot; />
      </div>
    );
  }

  if (error) {
    return (
      <div className=&quot;text-destructive p-4 text-center&quot;>
        Error loading audit _logs: {error instanceof Error ? error.message : &apos;Unknown error&apos;}
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className=&quot;text-muted-foreground p-4 text-center&quot;>
        No audit logs found for this batch.
      </div>
    );
  }

  const getActionBadge = (_action: string) => {
    switch (action.toLowerCase()) {
      case &apos;create&apos;:
        return <Badge className=&quot;bg-green-500 _hover:bg-green-600&quot;>Created</Badge>;
      case &apos;update&apos;:
        return <Badge className=&quot;bg-blue-500 _hover:bg-blue-600&quot;>Updated</Badge>;
      case &apos;delete&apos;:
        return <Badge className=&quot;bg-red-500 _hover:bg-red-600&quot;>Deleted</Badge>;
      case &apos;adjust&apos;:
        return <Badge className=&quot;bg-amber-500 _hover:bg-amber-600&quot;>Adjusted</Badge>;
      _default:
        return <Badge>{action}</Badge>;
    }
  };

  const formatChanges = (_details: any) => {
    if (details.changes && Array.isArray(details.changes)) {
      return details.changes.map((_change: any, _index: number) => (
        <div key={index} className=&quot;text-sm mb-1&quot;>
          <span className=&quot;font-medium&quot;>{change.field}:</span>{&apos; &apos;}
          <span className=&quot;line-through text-muted-foreground&quot;>{formatValue(change.oldValue)}</span>{&apos; &apos;}
          <span className=&quot;text-primary&quot;>→</span>{&apos; &apos;}
          <span>{formatValue(change.newValue)}</span>
        </div>
      ));
    }

    return (
      <div className=&quot;text-sm&quot;>
        {details.batchNumber && <div><span className=&quot;font-medium&quot;>Batch:</span> {details.batchNumber}</div>}
        {details.productName && <div><span className=&quot;font-medium&quot;>Product:</span> {details.productName}</div>}
        {details.wasForceDeleted !== undefined && (
          <div className=&quot;text-amber-500&quot;>
            {details.wasForceDeleted ? &apos;Force deleted&apos; : &apos;Normal deletion&apos;}
            {details.quantityLost > 0 && ` (lost ${details.quantityLost} units)`}
          </div>
        )}
      </div>
    );
  };

  const formatValue = (_value: any) => {
    if (value === null || value === undefined) return &apos;None&apos;;
    if (value === true) return &apos;Yes&apos;;
    if (value === false) return &apos;No&apos;;
    if (typeof value === &apos;object&apos; && value instanceof Date) return format(new Date(value), &apos;PPP&apos;);
    return String(value);
  };

  return (
    <ScrollArea className=&quot;h-[400px]&quot;>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date & Time</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Changes</TableHead>
            <TableHead>Quantity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell className=&quot;whitespace-nowrap&quot;>
                {format(new Date(log.createdAt), &apos;PPp&apos;)}
              </TableCell>
              <TableCell>{getActionBadge(log.action)}</TableCell>
              <TableCell>{log.user?.name || log.user?.username || `User #${log.userId}`}</TableCell>
              <TableCell>{formatChanges(log.details)}</TableCell>
              <TableCell>
                {log.quantityBefore !== undefined && log.quantityAfter !== undefined && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className=&quot;flex items-center&quot;>
                          <span className={`${log.quantityAfter > log.quantityBefore ? &apos;text-green-500&apos; :
                                           log.quantityAfter < log.quantityBefore ? &apos;text-red-500&apos; : &apos;&apos;}`}>
                            {log.quantityBefore} → {log.quantityAfter}
                          </span>
                          {log.quantityBefore !== log.quantityAfter && (
                            <Info className=&quot;h-4 w-4 ml-1 text-muted-foreground&quot; />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {log.quantityAfter > log.quantityBefore
                            ? `Added ${log.quantityAfter - log.quantityBefore} units`
                            : log.quantityAfter < log.quantityBefore
                            ? `Removed ${log.quantityBefore - log.quantityAfter} units`
                            : &apos;No quantity change&apos;}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
