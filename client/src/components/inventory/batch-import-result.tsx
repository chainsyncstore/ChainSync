import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, XCircle } from "lucide-react";

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

export interface BatchImportResult {
  success: boolean;
  message: string;
  processedRows?: number;
  successfulRows?: number;
  failedRows?: number;
  errors?: ImportError[];
  warnings?: ImportError[];
}

export function BatchImportResult({ result }: { result: BatchImportResult }) {
  if (!result) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Alert variant={result.success ? "default" : "destructive"} className={result.success ? "bg-green-50 border-green-200" : undefined}>
        {result.success ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <AlertCircle className="h-4 w-4" />
        )}
        <AlertTitle>{result.success ? "Import Successful" : "Import Failed"}</AlertTitle>
        <AlertDescription>{result.message}</AlertDescription>
      </Alert>

      {(result.processedRows !== undefined || result.successfulRows !== undefined || result.failedRows !== undefined) && (
        <div className="grid grid-cols-3 gap-4 mb-4">
          {result.processedRows !== undefined && (
            <div className="bg-secondary/30 p-3 rounded-md">
              <div className="text-xl font-bold">{result.processedRows}</div>
              <div className="text-sm text-muted-foreground">Total Rows</div>
            </div>
          )}
          {result.successfulRows !== undefined && (
            <div className="bg-green-50 border border-green-100 p-3 rounded-md">
              <div className="text-xl font-bold text-green-600">{result.successfulRows}</div>
              <div className="text-sm text-green-600">Successful</div>
            </div>
          )}
          {result.failedRows !== undefined && result.failedRows > 0 && (
            <div className="bg-red-50 border border-red-100 p-3 rounded-md">
              <div className="text-xl font-bold text-red-600">{result.failedRows}</div>
              <div className="text-sm text-red-600">Failed</div>
            </div>
          )}
        </div>
      )}

      {result.errors && result.errors.length > 0 && (
        <div className="mb-4">
          <h3 className="text-lg font-medium mb-2">Errors</h3>
          <ScrollArea className="h-[250px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Row</TableHead>
                  <TableHead className="w-[120px]">Field</TableHead>
                  <TableHead>Issue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.errors.map((error, index) => (
                  <TableRow key={`error-${index}`}>
                    <TableCell>{error.row}</TableCell>
                    <TableCell>{error.field}</TableCell>
                    <TableCell className="text-red-600">{error.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      )}

      {result.warnings && result.warnings.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-2">Warnings</h3>
          <ScrollArea className="h-[200px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Row</TableHead>
                  <TableHead className="w-[120px]">Field</TableHead>
                  <TableHead>Warning</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.warnings.map((warning, index) => (
                  <TableRow key={`warning-${index}`}>
                    <TableCell>{warning.row}</TableCell>
                    <TableCell>{warning.field}</TableCell>
                    <TableCell className="text-amber-600">{warning.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      )}

      {result.success && !result.errors?.length && !result.warnings?.length && (
        <div className="flex items-center justify-center p-8 bg-green-50 rounded-lg border border-green-100">
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <h3 className="text-lg font-medium">All Data Imported Successfully</h3>
            <p className="text-muted-foreground">No errors or warnings were found.</p>
          </div>
        </div>
      )}
    </div>
  );
}