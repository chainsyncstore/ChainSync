import React, { useState, useRef } from &apos;react&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import { useMutation, useQuery } from &apos;@tanstack/react-query&apos;;
import { apiRequest, queryClient } from &apos;@/lib/queryClient&apos;;
import { useToast } from &apos;@/hooks/use-toast&apos;;
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from &apos;@/components/ui/card&apos;;
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from &apos;@/components/ui/tabs&apos;;
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from &apos;@/components/ui/table&apos;;
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from &apos;@/components/ui/alert-dialog&apos;;
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from &apos;@/components/ui/select&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { Label } from &apos;@/components/ui/label&apos;;
import { Checkbox } from &apos;@/components/ui/checkbox&apos;;
import { Progress } from &apos;@/components/ui/progress&apos;;
import { Badge } from &apos;@/components/ui/badge&apos;;
import { Alert, AlertDescription, AlertTitle } from &apos;@/components/ui/alert&apos;;
import {
  Upload,
  FileUp,
  Download,
  FileX,
  CheckCircle,
  AlertTriangle,
  X,
  AlertCircle,
  Store
} from &apos;lucide-react&apos;;

interface ValidationError {
  _row: number;
  _field: string;
  _value: string;
  _message: string;
}

interface ImportSummary {
  _totalRows: number;
  _processedRows: number;
  _skippedRows: number;
  _newCategories: string[];
  _errors: ValidationError[];
}

interface ProductData {
  _name: string;
  _sku: string;
  _categoryId: number;
  _price: string;
  _stock: number;
  expiryDate?: Date | null;
  description?: string;
  barcode?: string;
  imageUrl?: string;
  supplier?: string;
  costPrice?: string;
}

interface ImportResult {
  _success: boolean;
  _importedCount: number;
  _failedProducts: Array<{_product: ProductData; _error: string}>;
}

export default function ProductImport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isFileValid, setIsFileValid] = useState<boolean | null>(null);
  const [validationSummary, setValidationSummary] = useState<ImportSummary | null>(null);
  const [validProducts, setValidProducts] = useState<ProductData[]>([]);
  const [currentTab, setCurrentTab] = useState(&apos;upload&apos;);
  const [selectedStoreId, setSelectedStoreId] = useState<string>(&apos;&apos;);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [createCategoriesAutomatically, setCreateCategoriesAutomatically] = useState(true);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Fetch stores the user can access
  const storesQuery = useQuery({
    _queryKey: [&apos;/api/stores&apos;]
  });

  // Upload and validate file
  const validateMutation = useMutation({
    _mutationFn: async(_formData: FormData) => {
      return await apiRequest(&apos;POST&apos;, &apos;/api/products/import/validate&apos;, formData);
    },
    _onSuccess: (data) => {
      if (data.summary) {
        setValidationSummary(data.summary);
        setValidProducts(data.validProducts || []);
        setIsFileValid(true);
        setCurrentTab(&apos;validate&apos;);

        if (data.summary.errors.length > 0) {
          toast({
            _title: &apos;Validation completed with issues&apos;,
            _description: `Found ${data.summary.errors.length} issue(s) in the imported data.`,
            _variant: &apos;default&apos;
          });
        } else {
          toast({
            _title: &apos;Validation successful&apos;,
            _description: `All ${data.summary.processedRows} rows are valid and ready to import.`,
            _variant: &apos;default&apos;
          });
        }
      } else {
        setIsFileValid(false);
        toast({
          _title: &apos;Validation failed&apos;,
          _description: data.message || &apos;Unable to validate the file.&apos;,
          _variant: &apos;destructive&apos;
        });
      }
    },
    _onError: (_error: any) => {
      setIsFileValid(false);
      toast({
        _title: &apos;Validation error&apos;,
        _description: error.message || &apos;An error occurred during validation.&apos;,
        _variant: &apos;destructive&apos;
      });
    }
  });

  // Import validated products
  const importMutation = useMutation({
    _mutationFn: async(data: { _products: ProductData[]; _storeId: number; _createCategories: boolean })
   = > {
      return await apiRequest(&apos;POST&apos;, &apos;/api/products/import/process&apos;, data);
    },
    _onSuccess: (data) => {
      setImportResult(data);
      setCurrentTab(&apos;results&apos;);

      // Invalidate relevant queries
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/products&apos;] });
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/categories&apos;] });
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/inventory&apos;] });

      if (data.success) {
        toast({
          _title: &apos;Import completed&apos;,
          _description: `Successfully imported ${data.importedCount} product(s).`,
          _variant: &apos;default&apos;
        });
      } else {
        toast({
          _title: &apos;Import completed with issues&apos;,
          _description: `Successfully imported ${data.importedCount} product(s), but ${data.failedProducts.length} failed.`,
          _variant: &apos;destructive&apos;
        });
      }
    },
    _onError: (_error: any) => {
      toast({
        _title: &apos;Import failed&apos;,
        _description: error.message || &apos;An error occurred during the import process.&apos;,
        _variant: &apos;destructive&apos;
      });
    }
  });

  // Download error report
  const downloadErrorReportMutation = useMutation({
    _mutationFn: async(_errors: ValidationError[]) => {
      const response = await apiRequest(&apos;POST&apos;, &apos;/api/products/import/error-report&apos;, { errors });
      return response.blob();
    },
    _onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement(&apos;a&apos;);
      a.href = url;
      a.download = `import-errors-${new Date().toISOString().split(&apos;T&apos;)[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast({
        _title: &apos;Error report downloaded&apos;,
        _description: &apos;The error report has been downloaded.&apos;,
        _variant: &apos;default&apos;
      });
    },
    _onError: (_error: any) => {
      toast({
        _title: &apos;Download failed&apos;,
        _description: error.message || &apos;An error occurred while generating the error report.&apos;,
        _variant: &apos;destructive&apos;
      });
    }
  });

  // Handle file selection
  const handleFileChange = (_e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];

      // Basic validation - check if it&apos;s a CSV file
      if (selectedFile.type !== &apos;text/csv&apos; && !selectedFile.name.endsWith(&apos;.csv&apos;)) {
        toast({
          _title: &apos;Invalid file format&apos;,
          _description: &apos;Please upload a CSV file.&apos;,
          _variant: &apos;destructive&apos;
        });
        setFile(null);
        setIsFileValid(false);
        return;
      }

      setFile(selectedFile);
      setIsFileValid(null); // Reset validation status
      setValidationSummary(null);
      setValidProducts([]);
    }
  };

  // Handle drag and drop
  const handleDragOver = (_e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (_e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];

      // Basic validation - check if it&apos;s a CSV file
      if (droppedFile.type !== &apos;text/csv&apos; && !droppedFile.name.endsWith(&apos;.csv&apos;)) {
        toast({
          _title: &apos;Invalid file format&apos;,
          _description: &apos;Please upload a CSV file.&apos;,
          _variant: &apos;destructive&apos;
        });
        return;
      }

      setFile(droppedFile);
      setIsFileValid(null); // Reset validation status
      setValidationSummary(null);
      setValidProducts([]);
    }
  };

  // Handle file upload and validation
  const handleValidateFile = () => {
    if (!file) {
      toast({
        _title: &apos;No file selected&apos;,
        _description: &apos;Please select a CSV file to upload.&apos;,
        _variant: &apos;destructive&apos;
      });
      return;
    }

    const formData = new FormData();
    formData.append(&apos;file&apos;, file);

    validateMutation.mutate(formData);
  };

  // Handle import confirmation
  const handleImportConfirm = () => {
    if (!selectedStoreId) {
      toast({
        _title: &apos;Store selection required&apos;,
        _description: &apos;Please select a store to import the products into.&apos;,
        _variant: &apos;destructive&apos;
      });
      return;
    }

    setImportConfirmOpen(true);
  };

  // Handle product import
  const handleImport = () => {
    setImportConfirmOpen(false);

    if (validProducts.length === 0) {
      toast({
        _title: &apos;No valid products&apos;,
        _description: &apos;There are no valid products to import.&apos;,
        _variant: &apos;destructive&apos;
      });
      return;
    }

    if (!selectedStoreId) {
      toast({
        _title: &apos;Store selection required&apos;,
        _description: &apos;Please select a store to import the products into.&apos;,
        _variant: &apos;destructive&apos;
      });
      return;
    }

    importMutation.mutate({
      _products: validProducts,
      _storeId: parseInt(selectedStoreId),
      _createCategories: createCategoriesAutomatically
    });
  };

  // Handle error report download
  const handleDownloadErrorReport = () => {
    if (validationSummary && validationSummary.errors.length > 0) {
      downloadErrorReportMutation.mutate(validationSummary.errors);
    }
  };

  // Handle file reset
  const handleReset = () => {
    setFile(null);
    setIsFileValid(null);
    setValidationSummary(null);
    setValidProducts([]);
    setCurrentTab(&apos;upload&apos;);
    setSelectedStoreId(&apos;&apos;);
    setImportResult(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = &apos;&apos;;
    }
  };

  // Calculate validation success rate as percentage
  const getValidationSuccessRate = () => {
    if (!validationSummary) return 0;

    const { totalRows, skippedRows } = validationSummary;
    if (totalRows === 0) return 0;

    return Math.round(((totalRows - skippedRows) / totalRows) * 100);
  };

  return (
    <div className=&quot;space-y-6&quot;>
      <div className=&quot;flex flex-col _md:flex-row justify-between items-start _md:items-center gap-4&quot;>
        <div>
          <h1 className=&quot;text-2xl font-bold&quot;>Product Import</h1>
          <p className=&quot;text-muted-foreground&quot;>
            Import products from CSV files with validation
          </p>
        </div>

        <div className=&quot;flex items-center gap-2&quot;>
          <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
            <SelectTrigger className=&quot;w-[200px]&quot;>
              <SelectValue placeholder=&quot;Select Store&quot; />
            </SelectTrigger>
            <SelectContent>
              {storesQuery.isLoading ? (
                <div className=&quot;flex justify-center p-2&quot;>
                  <div className=&quot;animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full&quot; />
                </div>
              ) : (
                Array.isArray(storesQuery.data) && storesQuery.data.map((_store: any) => (
                  <SelectItem key={store.id} value={store.id.toString()}>
                    {store.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={setCurrentTab} className=&quot;w-full&quot;>
        <TabsList className=&quot;grid w-full grid-cols-3&quot;>
          <TabsTrigger value=&quot;upload&quot; disabled={validateMutation.isPending}>
            1. Upload File
          </TabsTrigger>
          <TabsTrigger
            value=&quot;validate&quot;
            disabled={!isFileValid || validateMutation.isPending}
          >
            2. Validate Data
          </TabsTrigger>
          <TabsTrigger
            value=&quot;results&quot;
            disabled={!importResult || importMutation.isPending}
          >
            3. Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value=&quot;upload&quot;>
          <Card>
            <CardHeader>
              <CardTitle>Upload CSV File</CardTitle>
              <CardDescription>
                Upload a CSV file containing product data. The file should include columns for name, SKU, category, price, and stock level.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center
                  ${file ? &apos;border-primary bg-primary/5&apos; : &apos;border-muted-foreground/25&apos;}
                `}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <div className=&quot;flex flex-col items-center justify-center space-y-4&quot;>
                  <div className=&quot;rounded-full bg-primary/10 p-4&quot;>
                    <Upload className=&quot;h-8 w-8 text-primary&quot; />
                  </div>

                  <div className=&quot;space-y-2&quot;>
                    <h3 className=&quot;font-medium&quot;>Drag & drop your CSV file here</h3>
                    <p className=&quot;text-sm text-muted-foreground&quot;>
                      or click the button below to browse
                    </p>
                  </div>

                  {file ? (
                    <div className=&quot;flex items-center justify-center gap-2 bg-muted px-3 py-2 rounded-md&quot;>
                      <FileUp className=&quot;h-4 w-4 text-primary&quot; />
                      <span className=&quot;text-sm&quot;>{file.name}</span>
                      <Button
                        variant=&quot;ghost&quot;
                        size=&quot;icon&quot;
                        className=&quot;h-6 w-6 rounded-full&quot;
                        onClick={() => setFile(null)}
                      >
                        <X className=&quot;h-3 w-3&quot; />
                      </Button>
                    </div>
                  ) : (
                    <div className=&quot;flex gap-2&quot;>
                      <Button
                        variant=&quot;outline&quot;
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Select CSV File
                      </Button>
                      <Button
                        variant=&quot;outline&quot;
                        onClick={() => window.open(&apos;/assets/templates/product-import-template.csv&apos;)}
                      >
                        Download Template
                      </Button>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type=&quot;file&quot;
                    accept=&quot;.csv&quot;
                    className=&quot;hidden&quot;
                    onChange={handleFileChange}
                  />
                </div>
              </div>

              <div className=&quot;mt-6 space-y-4&quot;>
                <h3 className=&quot;font-medium&quot;>Required Fields</h3>
                <div className=&quot;grid grid-cols-1 _md:grid-cols-3 gap-4&quot;>
                  <div className=&quot;border rounded-md p-3&quot;>
                    <p className=&quot;font-medium&quot;>Product Name</p>
                    <p className=&quot;text-sm text-muted-foreground&quot;>Name of the product</p>
                  </div>
                  <div className=&quot;border rounded-md p-3&quot;>
                    <p className=&quot;font-medium&quot;>SKU</p>
                    <p className=&quot;text-sm text-muted-foreground&quot;>Unique product identifier</p>
                  </div>
                  <div className=&quot;border rounded-md p-3&quot;>
                    <p className=&quot;font-medium&quot;>Category</p>
                    <p className=&quot;text-sm text-muted-foreground&quot;>Product category name</p>
                  </div>
                  <div className=&quot;border rounded-md p-3&quot;>
                    <p className=&quot;font-medium&quot;>Price</p>
                    <p className=&quot;text-sm text-muted-foreground&quot;>Selling price</p>
                  </div>
                  <div className=&quot;border rounded-md p-3&quot;>
                    <p className=&quot;font-medium&quot;>Stock</p>
                    <p className=&quot;text-sm text-muted-foreground&quot;>Initial stock quantity</p>
                  </div>
                </div>

                <h3 className=&quot;font-medium mt-4&quot;>Optional Fields</h3>
                <div className=&quot;grid grid-cols-1 _md:grid-cols-3 gap-4&quot;>
                  <div className=&quot;border rounded-md p-3&quot;>
                    <p className=&quot;font-medium&quot;>Expiry Date</p>
                    <p className=&quot;text-sm text-muted-foreground&quot;>Product expiration date
  (YYYY-MM-DD)</p>
                  </div>
                  <div className=&quot;border rounded-md p-3&quot;>
                    <p className=&quot;font-medium&quot;>Description</p>
                    <p className=&quot;text-sm text-muted-foreground&quot;>Product description</p>
                  </div>
                  <div className=&quot;border rounded-md p-3&quot;>
                    <p className=&quot;font-medium&quot;>Barcode</p>
                    <p className=&quot;text-sm text-muted-foreground&quot;>Product barcode</p>
                  </div>
                  <div className=&quot;border rounded-md p-3&quot;>
                    <p className=&quot;font-medium&quot;>Image URL</p>
                    <p className=&quot;text-sm text-muted-foreground&quot;>URL to product image</p>
                  </div>
                  <div className=&quot;border rounded-md p-3&quot;>
                    <p className=&quot;font-medium&quot;>Supplier</p>
                    <p className=&quot;text-sm text-muted-foreground&quot;>Product supplier name</p>
                  </div>
                  <div className=&quot;border rounded-md p-3&quot;>
                    <p className=&quot;font-medium&quot;>Cost Price</p>
                    <p className=&quot;text-sm text-muted-foreground&quot;>Product cost price</p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className=&quot;flex justify-between&quot;>
              <Button variant=&quot;outline&quot; onClick={handleReset} disabled={validateMutation.isPending}>
                Reset
              </Button>
              <Button
                onClick={handleValidateFile}
                disabled={!file || validateMutation.isPending}
              >
                {validateMutation.isPending ? (
                  <>
                    <div className=&quot;mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent&quot; />
                    Validating...
                  </>
                ) : (
                  <>Validate File</>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value=&quot;validate&quot;>
          <Card>
            <CardHeader>
              <CardTitle>Validation Results</CardTitle>
              <CardDescription>
                Review validation results before importing products.
              </CardDescription>
            </CardHeader>
            <CardContent className=&quot;space-y-4&quot;>
              {validationSummary && (
                <>
                  <div className=&quot;grid grid-cols-1 _md:grid-cols-4 gap-4&quot;>
                    <div className=&quot;border rounded-md p-4&quot;>
                      <p className=&quot;text-sm text-muted-foreground&quot;>Total Rows</p>
                      <p className=&quot;text-2xl font-semibold&quot;>{validationSummary.totalRows}</p>
                    </div>
                    <div className=&quot;border rounded-md p-4&quot;>
                      <p className=&quot;text-sm text-muted-foreground&quot;>Valid Rows</p>
                      <p className=&quot;text-2xl font-semibold text-primary&quot;>
                        {validationSummary.processedRows}
                      </p>
                    </div>
                    <div className=&quot;border rounded-md p-4&quot;>
                      <p className=&quot;text-sm text-muted-foreground&quot;>Skipped Rows</p>
                      <p className=&quot;text-2xl font-semibold text-destructive&quot;>
                        {validationSummary.skippedRows}
                      </p>
                    </div>
                    <div className=&quot;border rounded-md p-4&quot;>
                      <p className=&quot;text-sm text-muted-foreground&quot;>New Categories</p>
                      <p className=&quot;text-2xl font-semibold text-amber-500&quot;>
                        {validationSummary.newCategories.length}
                      </p>
                    </div>
                  </div>

                  <div className=&quot;space-y-2&quot;>
                    <div className=&quot;flex justify-between items-center&quot;>
                      <h3 className=&quot;font-medium&quot;>Validation Success Rate</h3>
                      <span className=&quot;font-semibold&quot;>{getValidationSuccessRate()}%</span>
                    </div>
                    <Progress value={getValidationSuccessRate()} className=&quot;h-2&quot; />
                  </div>

                  {/* New Categories */}
                  {validationSummary.newCategories.length > 0 && (
                    <div className=&quot;space-y-2&quot;>
                      <div className=&quot;flex items-center justify-between&quot;>
                        <h3 className=&quot;font-medium&quot;>New Categories</h3>
                        <div className=&quot;flex items-center space-x-2&quot;>
                          <Checkbox
                            id=&quot;auto-create-categories&quot;
                            checked={createCategoriesAutomatically}
                            onCheckedChange={(checked) =>
                              setCreateCategoriesAutomatically(!!checked)
                            }
                          />
                          <label
                            htmlFor=&quot;auto-create-categories&quot;
                            className=&quot;text-sm cursor-pointer&quot;
                          >
                            Create automatically
                          </label>
                        </div>
                      </div>
                      <div className=&quot;flex flex-wrap gap-2&quot;>
                        {validationSummary.newCategories.map((category, index) => (
                          <Badge key={index} variant=&quot;outline&quot;>
                            {category}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Validation Errors */}
                  {validationSummary.errors.length > 0 && (
                    <div className=&quot;space-y-2&quot;>
                      <div className=&quot;flex items-center justify-between&quot;>
                        <h3 className=&quot;font-medium&quot;>Validation Errors</h3>
                        <Button
                          variant=&quot;outline&quot;
                          size=&quot;sm&quot;
                          onClick={handleDownloadErrorReport}
                          disabled={downloadErrorReportMutation.isPending}
                        >
                          <Download className=&quot;mr-2 h-4 w-4&quot; />
                          Export Errors
                        </Button>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Row</TableHead>
                            <TableHead>Field</TableHead>
                            <TableHead>Value</TableHead>
                            <TableHead>Error</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {validationSummary.errors.slice(0, 10).map((error, index) => (
                            <TableRow key={index}>
                              <TableCell>{error.row}</TableCell>
                              <TableCell>{error.field}</TableCell>
                              <TableCell>
                                <code className=&quot;px-1 py-0.5 bg-muted rounded text-xs&quot;>
                                  {error.value || &apos;(empty)&apos;}
                                </code>
                              </TableCell>
                              <TableCell>{error.message}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        {validationSummary.errors.length > 10 && (
                          <TableCaption>
                            Showing 10 of {validationSummary.errors.length} errors.
                            Download the error report for a complete list.
                          </TableCaption>
                        )}
                      </Table>
                    </div>
                  )}

                  {/* Preview Valid Products */}
                  {validProducts.length > 0 && (
                    <div className=&quot;space-y-2&quot;>
                      <h3 className=&quot;font-medium&quot;>Product Preview</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Stock</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {validProducts.slice(0, 5).map((product, index) => (
                            <TableRow key={index}>
                              <TableCell>{product.name}</TableCell>
                              <TableCell>{product.sku}</TableCell>
                              <TableCell>{validationSummary.newCategories.find(
                                (_, i) => product.categoryId === i + 1
                              ) || `Category _ID: ${product.categoryId}`}</TableCell>
                              <TableCell>{product.price}</TableCell>
                              <TableCell>{product.stock}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        {validProducts.length > 5 && (
                          <TableCaption>
                            Showing 5 of {validProducts.length} valid products.
                          </TableCaption>
                        )}
                      </Table>
                    </div>
                  )}

                  {/* Store Selection Warning */}
                  {!selectedStoreId && (
                    <Alert>
                      <AlertCircle className=&quot;h-4 w-4&quot; />
                      <AlertTitle>Store Selection Required</AlertTitle>
                      <AlertDescription>
                        Please select a store from the dropdown above before importing products.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </CardContent>
            <CardFooter className=&quot;flex justify-between&quot;>
              <Button
                variant=&quot;outline&quot;
                onClick={() => setCurrentTab(&apos;upload&apos;)}
                disabled={importMutation.isPending}
              >
                Back
              </Button>
              <div className=&quot;flex gap-2&quot;>
                <Button
                  variant=&quot;outline&quot;
                  onClick={handleReset}
                  disabled={importMutation.isPending}
                >
                  Start Over
                </Button>
                <Button
                  onClick={handleImportConfirm}
                  disabled={
                    validProducts.length === 0 ||
                    !selectedStoreId ||
                    importMutation.isPending
                  }
                >
                  {importMutation.isPending ? (
                    <>
                      <div className=&quot;mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent&quot; />
                      Importing...
                    </>
                  ) : (
                    <>Import Products</>
                  )}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value=&quot;results&quot;>
          <Card>
            <CardHeader>
              <CardTitle>Import Results</CardTitle>
              <CardDescription>
                Summary of the product import process.
              </CardDescription>
            </CardHeader>
            <CardContent className=&quot;space-y-4&quot;>
              {importResult && (
                <>
                  <div className=&quot;flex items-center justify-center p-6&quot;>
                    {importResult.success && importResult.failedProducts.length === 0 ? (
                      <div className=&quot;flex flex-col items-center text-center&quot;>
                        <div className=&quot;rounded-full bg-green-100 p-3 mb-4&quot;>
                          <CheckCircle className=&quot;h-10 w-10 text-green-600&quot; />
                        </div>
                        <h3 className=&quot;text-xl font-semibold&quot;>Import Completed Successfully</h3>
                        <p className=&quot;text-muted-foreground mt-1&quot;>
                          All {importResult.importedCount} products were imported successfully.
                        </p>
                      </div>
                    ) : importResult.success && importResult.failedProducts.length > 0 ? (
                      <div className=&quot;flex flex-col items-center text-center&quot;>
                        <div className=&quot;rounded-full bg-amber-100 p-3 mb-4&quot;>
                          <AlertTriangle className=&quot;h-10 w-10 text-amber-600&quot; />
                        </div>
                        <h3 className=&quot;text-xl font-semibold&quot;>Import Completed with Warnings</h3>
                        <p className=&quot;text-muted-foreground mt-1&quot;>
                          {importResult.importedCount} products were imported successfully,
                          but {importResult.failedProducts.length} products failed.
                        </p>
                      </div>
                    ) : (
                      <div className=&quot;flex flex-col items-center text-center&quot;>
                        <div className=&quot;rounded-full bg-red-100 p-3 mb-4&quot;>
                          <FileX className=&quot;h-10 w-10 text-red-600&quot; />
                        </div>
                        <h3 className=&quot;text-xl font-semibold&quot;>Import Failed</h3>
                        <p className=&quot;text-muted-foreground mt-1&quot;>
                          {importResult.importedCount > 0
                            ? `Only ${importResult.importedCount} products were imported successfully.`
                            : &apos;No products were imported.&apos;}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className=&quot;grid grid-cols-1 _md:grid-cols-3 gap-4&quot;>
                    <div className=&quot;border rounded-md p-4&quot;>
                      <p className=&quot;text-sm text-muted-foreground&quot;>Imported Successfully</p>
                      <p className=&quot;text-2xl font-semibold text-green-600&quot;>
                        {importResult.importedCount}
                      </p>
                    </div>
                    <div className=&quot;border rounded-md p-4&quot;>
                      <p className=&quot;text-sm text-muted-foreground&quot;>Failed Products</p>
                      <p className=&quot;text-2xl font-semibold text-red-600&quot;>
                        {importResult.failedProducts.length}
                      </p>
                    </div>
                    <div className=&quot;border rounded-md p-4&quot;>
                      <p className=&quot;text-sm text-muted-foreground&quot;>Target Store</p>
                      <div className=&quot;flex items-center text-xl font-semibold&quot;>
                        <Store className=&quot;h-4 w-4 mr-2 text-primary&quot; />
                        {Array.isArray(storesQuery.data) && storesQuery.data.find((_store: any) =>
                          store.id.toString() === selectedStoreId
                        )?.name || `Store _ID: ${selectedStoreId}`}
                      </div>
                    </div>
                  </div>

                  {/* Failed Products */}
                  {importResult.failedProducts.length > 0 && (
                    <div className=&quot;space-y-2&quot;>
                      <h3 className=&quot;font-medium&quot;>Failed Products</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Error</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importResult.failedProducts.slice(0, 10).map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>{item.product.name}</TableCell>
                              <TableCell>{item.product.sku}</TableCell>
                              <TableCell className=&quot;text-red-600&quot;>{item.error}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        {importResult.failedProducts.length > 10 && (
                          <TableCaption>
                            Showing 10 of {importResult.failedProducts.length} failed products.
                          </TableCaption>
                        )}
                      </Table>
                    </div>
                  )}
                </>
              )}
            </CardContent>
            <CardFooter className=&quot;flex justify-between&quot;>
              <Button
                variant=&quot;outline&quot;
                onClick={() => setCurrentTab(&apos;validate&apos;)}
              >
                Back
              </Button>
              <Button onClick={handleReset}>
                Start New Import
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Import Confirmation Dialog */}
      <AlertDialog open={importConfirmOpen} onOpenChange={setImportConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Product Import</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to import {validProducts.length} products into{&apos; &apos;}
              <span className=&quot;font-medium&quot;>
                {Array.isArray(storesQuery.data) && storesQuery.data.find((_store: any) =>
                  store.id.toString() === selectedStoreId
                )?.name || `Store _ID: ${selectedStoreId}`}
              </span>.

              {validationSummary && validationSummary.newCategories.length > 0 && (
                <>
                  <br /><br />
                  This will create {validationSummary.newCategories.length} new categories.
                </>
              )}

              <br /><br />
              Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleImport}>
              Confirm Import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
