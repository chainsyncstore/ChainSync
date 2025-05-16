import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Info } from "lucide-react";

interface BatchAuditLog {
  id: number;
  batchId: number;
  userId: number;
  action: string;
  details: any;
  quantityBefore?: number;
  quantityAfter?: number;
  createdAt: string;
  user?: {
    id: number;
    username: string;
    name?: string;
  };
}

interface BatchAuditLogProps {
  batchId: number;
}

export function BatchAuditLog({ batchId }: BatchAuditLogProps) {
  const { data: logs, isLoading, error } = useQuery<BatchAuditLog[]>({
    queryKey: [`/api/inventory/batches/${batchId}/audit-logs`],
    enabled: !!batchId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4 min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive p-4 text-center">
        Error loading audit logs: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="text-muted-foreground p-4 text-center">
        No audit logs found for this batch.
      </div>
    );
  }

  const getActionBadge = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create':
        return <Badge className="bg-green-500 hover:bg-green-600">Created</Badge>;
      case 'update':
        return <Badge className="bg-blue-500 hover:bg-blue-600">Updated</Badge>;
      case 'delete':
        return <Badge className="bg-red-500 hover:bg-red-600">Deleted</Badge>;
      case 'adjust':
        return <Badge className="bg-amber-500 hover:bg-amber-600">Adjusted</Badge>;
      default:
        return <Badge>{action}</Badge>;
    }
  };

  const formatChanges = (details: any) => {
    if (details.changes && Array.isArray(details.changes)) {
      return details.changes.map((change: any, index: number) => (
        <div key={index} className="text-sm mb-1">
          <span className="font-medium">{change.field}:</span>{' '}
          <span className="line-through text-muted-foreground">{formatValue(change.oldValue)}</span>{' '}
          <span className="text-primary">→</span>{' '}
          <span>{formatValue(change.newValue)}</span>
        </div>
      ));
    }
    
    return (
      <div className="text-sm">
        {details.batchNumber && <div><span className="font-medium">Batch:</span> {details.batchNumber}</div>}
        {details.productName && <div><span className="font-medium">Product:</span> {details.productName}</div>}
        {details.wasForceDeleted !== undefined && (
          <div className="text-amber-500">
            {details.wasForceDeleted ? 'Force deleted' : 'Normal deletion'}
            {details.quantityLost > 0 && ` (lost ${details.quantityLost} units)`}
          </div>
        )}
      </div>
    );
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return 'None';
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    if (typeof value === 'object' && value instanceof Date) return format(new Date(value), 'PPP');
    return String(value);
  };

  return (
    <ScrollArea className="h-[400px]">
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
              <TableCell className="whitespace-nowrap">
                {format(new Date(log.createdAt), 'PPp')}
              </TableCell>
              <TableCell>{getActionBadge(log.action)}</TableCell>
              <TableCell>{log.user?.name || log.user?.username || `User #${log.userId}`}</TableCell>
              <TableCell>{formatChanges(log.details)}</TableCell>
              <TableCell>
                {log.quantityBefore !== undefined && log.quantityAfter !== undefined && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center">
                          <span className={`${log.quantityAfter > log.quantityBefore ? 'text-green-500' : 
                                           log.quantityAfter < log.quantityBefore ? 'text-red-500' : ''}`}>
                            {log.quantityBefore} → {log.quantityAfter}
                          </span>
                          {log.quantityBefore !== log.quantityAfter && (
                            <Info className="h-4 w-4 ml-1 text-muted-foreground" />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {log.quantityAfter > log.quantityBefore
                            ? `Added ${log.quantityAfter - log.quantityBefore} units`
                            : log.quantityAfter < log.quantityBefore
                            ? `Removed ${log.quantityBefore - log.quantityAfter} units`
                            : 'No quantity change'}
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