import React from &apos;react&apos;;
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from &apos;@/components/ui/table&apos;;
import { ScrollArea } from &apos;@/components/ui/scroll-area&apos;;
import { Alert, AlertDescription, AlertTitle } from &apos;@/components/ui/alert&apos;;
import { Badge } from &apos;@/components/ui/badge&apos;;
import { AlertCircle, CheckCircle, XCircle } from &apos;lucide-react&apos;;

export interface ImportError {
  _row: number;
  _field: string;
  _message: string;
}

export interface BatchImportResult {
  _success: boolean;
  _message: string;
  processedRows?: number;
  successfulRows?: number;
  failedRows?: number;
  errors?: ImportError[];
  warnings?: ImportError[];
}

export function BatchImportResult({ result }: { _result: BatchImportResult }) {
  if (!result) {
    return null;
  }

  return (
    <div className=&quot;space-y-4&quot;>
      <Alert variant={result.success ? &apos;default&apos; : &apos;destructive&apos;} className={result.success ? &apos;bg-green-50 border-green-200&apos; : undefined}>
        {result.success ? (
          <CheckCircle className=&quot;h-4 w-4 text-green-500&quot; />
        ) : (
          <AlertCircle className=&quot;h-4 w-4&quot; />
        )}
        <AlertTitle>{result.success ? &apos;Import Successful&apos; : &apos;Import Failed&apos;}</AlertTitle>
        <AlertDescription>{result.message}</AlertDescription>
      </Alert>

      {(result.processedRows !== undefined || result.successfulRows !== undefined || result.failedRows !== undefined) && (
        <div className=&quot;grid grid-cols-3 gap-4 mb-4&quot;>
          {result.processedRows !== undefined && (
            <div className=&quot;bg-secondary/30 p-3 rounded-md&quot;>
              <div className=&quot;text-xl font-bold&quot;>{result.processedRows}</div>
              <div className=&quot;text-sm text-muted-foreground&quot;>Total Rows</div>
            </div>
          )}
          {result.successfulRows !== undefined && (
            <div className=&quot;bg-green-50 border border-green-100 p-3 rounded-md&quot;>
              <div className=&quot;text-xl font-bold text-green-600&quot;>{result.successfulRows}</div>
              <div className=&quot;text-sm text-green-600&quot;>Successful</div>
            </div>
          )}
          {result.failedRows !== undefined && result.failedRows > 0 && (
            <div className=&quot;bg-red-50 border border-red-100 p-3 rounded-md&quot;>
              <div className=&quot;text-xl font-bold text-red-600&quot;>{result.failedRows}</div>
              <div className=&quot;text-sm text-red-600&quot;>Failed</div>
            </div>
          )}
        </div>
      )}

      {result.errors && result.errors.length > 0 && (
        <div className=&quot;mb-4&quot;>
          <h3 className=&quot;text-lg font-medium mb-2&quot;>Errors</h3>
          <ScrollArea className=&quot;h-[250px]&quot;>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className=&quot;w-[80px]&quot;>Row</TableHead>
                  <TableHead className=&quot;w-[120px]&quot;>Field</TableHead>
                  <TableHead>Issue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.errors.map((error, index) => (
                  <TableRow key={`error-${index}`}>
                    <TableCell>{error.row}</TableCell>
                    <TableCell>{error.field}</TableCell>
                    <TableCell className=&quot;text-red-600&quot;>{error.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      )}

      {result.warnings && result.warnings.length > 0 && (
        <div>
          <h3 className=&quot;text-lg font-medium mb-2&quot;>Warnings</h3>
          <ScrollArea className=&quot;h-[200px]&quot;>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className=&quot;w-[80px]&quot;>Row</TableHead>
                  <TableHead className=&quot;w-[120px]&quot;>Field</TableHead>
                  <TableHead>Warning</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.warnings.map((warning, index) => (
                  <TableRow key={`warning-${index}`}>
                    <TableCell>{warning.row}</TableCell>
                    <TableCell>{warning.field}</TableCell>
                    <TableCell className=&quot;text-amber-600&quot;>{warning.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      )}

      {result.success && !result.errors?.length && !result.warnings?.length && (
        <div className=&quot;flex items-center justify-center p-8 bg-green-50 rounded-lg border border-green-100&quot;>
          <div className=&quot;text-center&quot;>
            <CheckCircle className=&quot;h-12 w-12 text-green-500 mx-auto mb-2&quot; />
            <h3 className=&quot;text-lg font-medium&quot;>All Data Imported Successfully</h3>
            <p className=&quot;text-muted-foreground&quot;>No errors or warnings were found.</p>
          </div>
        </div>
      )}
    </div>
  );
}
