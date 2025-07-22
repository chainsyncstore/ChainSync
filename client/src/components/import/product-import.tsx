import React, { useState, useRef } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
} from 'lucide-react';

interface ValidationError {
  row: number;
  field: string;
  value: string;
  message: string;
}

interface ImportSummary {
  totalRows: number;
  processedRows: number;
  skippedRows: number;
  newCategories: string[];
  errors: ValidationError[];
}

interface ProductData {
  name: string;
  sku: string;
  categoryId: number;
  price: string;
  stock: number;
  expiryDate?: Date | null;
  description?: string;
  barcode?: string;
  imageUrl?: string;
  supplier?: string;
  costPrice?: string;
}

interface ImportResult {
  success: boolean;
  importedCount: number;
  failedProducts: Array<{product: ProductData; error: string}>;
}

export default function ProductImport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [isFileValid, setIsFileValid] = useState<boolean | null>(null);
  const [validationSummary, setValidationSummary] = useState<ImportSummary | null>(null);
  const [validProducts, setValidProducts] = useState<ProductData[]>([]);
  const [currentTab, setCurrentTab] = useState('upload');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [createCategoriesAutomatically, setCreateCategoriesAutomatically] = useState(true);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  
  // Fetch stores the user can access
  const storesQuery = useQuery({
    queryKey: ['/api/stores'],
  });
  
  // Upload and validate file
  const validateMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequest('POST', '/api/products/import/validate', formData);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.summary) {
        setValidationSummary(data.summary);
        setValidProducts(data.validProducts || []);
        setIsFileValid(true);
        setCurrentTab('validate');
        
        if (data.summary.errors.length > 0) {
          toast({
            title: 'Validation completed with issues',
            description: `Found ${data.summary.errors.length} issue(s) in the imported data.`,
            variant: 'default',
          });
        } else {
          toast({
            title: 'Validation successful',
            description: `All ${data.summary.processedRows} rows are valid and ready to import.`,
            variant: 'default',
          });
        }
      } else {
        setIsFileValid(false);
        toast({
          title: 'Validation failed',
          description: data.message || 'Unable to validate the file.',
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      setIsFileValid(false);
      toast({
        title: 'Validation error',
        description: error.message || 'An error occurred during validation.',
        variant: 'destructive',
      });
    },
  });
  
  // Import validated products
  const importMutation = useMutation({
    mutationFn: async (data: { products: ProductData[]; storeId: number; createCategories: boolean }) => {
      const response = await apiRequest('POST', '/api/products/import/process', data);
      return response.json();
    },
    onSuccess: (data) => {
      setImportResult(data);
      setCurrentTab('results');
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      
      if (data.success) {
        toast({
          title: 'Import completed',
          description: `Successfully imported ${data.importedCount} product(s).`,
          variant: 'default',
        });
      } else {
        toast({
          title: 'Import completed with issues',
          description: `Successfully imported ${data.importedCount} product(s), but ${data.failedProducts.length} failed.`,
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Import failed',
        description: error.message || 'An error occurred during the import process.',
        variant: 'destructive',
      });
    },
  });
  
  // Download error report
  const downloadErrorReportMutation = useMutation({
    mutationFn: async (errors: ValidationError[]) => {
      const response = await apiRequest('POST', '/api/products/import/error-report', { errors });
      return response.blob();
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `import-errors-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      toast({
        title: 'Error report downloaded',
        description: 'The error report has been downloaded.',
        variant: 'default',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Download failed',
        description: error.message || 'An error occurred while generating the error report.',
        variant: 'destructive',
      });
    },
  });
  
  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      
      // Basic validation - check if it's a CSV file
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        toast({
          title: 'Invalid file format',
          description: 'Please upload a CSV file.',
          variant: 'destructive',
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
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      
      // Basic validation - check if it's a CSV file
      if (droppedFile.type !== 'text/csv' && !droppedFile.name.endsWith('.csv')) {
        toast({
          title: 'Invalid file format',
          description: 'Please upload a CSV file.',
          variant: 'destructive',
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
        title: 'No file selected',
        description: 'Please select a CSV file to upload.',
        variant: 'destructive',
      });
      return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    validateMutation.mutate(formData);
  };
  
  // Handle import confirmation
  const handleImportConfirm = () => {
    if (!selectedStoreId) {
      toast({
        title: 'Store selection required',
        description: 'Please select a store to import the products into.',
        variant: 'destructive',
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
        title: 'No valid products',
        description: 'There are no valid products to import.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!selectedStoreId) {
      toast({
        title: 'Store selection required',
        description: 'Please select a store to import the products into.',
        variant: 'destructive',
      });
      return;
    }
    
    importMutation.mutate({
      products: validProducts,
      storeId: parseInt(selectedStoreId),
      createCategories: createCategoriesAutomatically
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
    setCurrentTab('upload');
    setSelectedStoreId('');
    setImportResult(null);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Product Import</h1>
          <p className="text-muted-foreground">
            Import products from CSV files with validation
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select Store" />
            </SelectTrigger>
            <SelectContent>
              {storesQuery.isLoading ? (
                <div className="flex justify-center p-2">
                  <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : (
                Array.isArray(storesQuery.data) && storesQuery.data.map((store: any) => (
                  <SelectItem key={store.id} value={store.id.toString()}>
                    {store.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload" disabled={validateMutation.isPending}>
            1. Upload File
          </TabsTrigger>
          <TabsTrigger 
            value="validate" 
            disabled={!isFileValid || validateMutation.isPending}
          >
            2. Validate Data
          </TabsTrigger>
          <TabsTrigger 
            value="results" 
            disabled={!importResult || importMutation.isPending}
          >
            3. Results
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="upload">
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
                  ${file ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
                `}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="rounded-full bg-primary/10 p-4">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="font-medium">Drag & drop your CSV file here</h3>
                    <p className="text-sm text-muted-foreground">
                      or click the button below to browse
                    </p>
                  </div>
                  
                  {file ? (
                    <div className="flex items-center justify-center gap-2 bg-muted px-3 py-2 rounded-md">
                      <FileUp className="h-4 w-4 text-primary" />
                      <span className="text-sm">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full"
                        onClick={() => setFile(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Select CSV File
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => window.open('/assets/templates/product-import-template.csv')}
                      >
                        Download Template
                      </Button>
                    </div>
                  )}
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              </div>
              
              <div className="mt-6 space-y-4">
                <h3 className="font-medium">Required Fields</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border rounded-md p-3">
                    <p className="font-medium">Product Name</p>
                    <p className="text-sm text-muted-foreground">Name of the product</p>
                  </div>
                  <div className="border rounded-md p-3">
                    <p className="font-medium">SKU</p>
                    <p className="text-sm text-muted-foreground">Unique product identifier</p>
                  </div>
                  <div className="border rounded-md p-3">
                    <p className="font-medium">Category</p>
                    <p className="text-sm text-muted-foreground">Product category name</p>
                  </div>
                  <div className="border rounded-md p-3">
                    <p className="font-medium">Price</p>
                    <p className="text-sm text-muted-foreground">Selling price</p>
                  </div>
                  <div className="border rounded-md p-3">
                    <p className="font-medium">Stock</p>
                    <p className="text-sm text-muted-foreground">Initial stock quantity</p>
                  </div>
                </div>
                
                <h3 className="font-medium mt-4">Optional Fields</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border rounded-md p-3">
                    <p className="font-medium">Expiry Date</p>
                    <p className="text-sm text-muted-foreground">Product expiration date (YYYY-MM-DD)</p>
                  </div>
                  <div className="border rounded-md p-3">
                    <p className="font-medium">Description</p>
                    <p className="text-sm text-muted-foreground">Product description</p>
                  </div>
                  <div className="border rounded-md p-3">
                    <p className="font-medium">Barcode</p>
                    <p className="text-sm text-muted-foreground">Product barcode</p>
                  </div>
                  <div className="border rounded-md p-3">
                    <p className="font-medium">Image URL</p>
                    <p className="text-sm text-muted-foreground">URL to product image</p>
                  </div>
                  <div className="border rounded-md p-3">
                    <p className="font-medium">Supplier</p>
                    <p className="text-sm text-muted-foreground">Product supplier name</p>
                  </div>
                  <div className="border rounded-md p-3">
                    <p className="font-medium">Cost Price</p>
                    <p className="text-sm text-muted-foreground">Product cost price</p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={handleReset} disabled={validateMutation.isPending}>
                Reset
              </Button>
              <Button 
                onClick={handleValidateFile} 
                disabled={!file || validateMutation.isPending}
              >
                {validateMutation.isPending ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                    Validating...
                  </>
                ) : (
                  <>Validate File</>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="validate">
          <Card>
            <CardHeader>
              <CardTitle>Validation Results</CardTitle>
              <CardDescription>
                Review validation results before importing products.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {validationSummary && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="border rounded-md p-4">
                      <p className="text-sm text-muted-foreground">Total Rows</p>
                      <p className="text-2xl font-semibold">{validationSummary.totalRows}</p>
                    </div>
                    <div className="border rounded-md p-4">
                      <p className="text-sm text-muted-foreground">Valid Rows</p>
                      <p className="text-2xl font-semibold text-primary">
                        {validationSummary.processedRows}
                      </p>
                    </div>
                    <div className="border rounded-md p-4">
                      <p className="text-sm text-muted-foreground">Skipped Rows</p>
                      <p className="text-2xl font-semibold text-destructive">
                        {validationSummary.skippedRows}
                      </p>
                    </div>
                    <div className="border rounded-md p-4">
                      <p className="text-sm text-muted-foreground">New Categories</p>
                      <p className="text-2xl font-semibold text-amber-500">
                        {validationSummary.newCategories.length}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium">Validation Success Rate</h3>
                      <span className="font-semibold">{getValidationSuccessRate()}%</span>
                    </div>
                    <Progress value={getValidationSuccessRate()} className="h-2" />
                  </div>
                  
                  {/* New Categories */}
                  {validationSummary.newCategories.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">New Categories</h3>
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="auto-create-categories"
                            checked={createCategoriesAutomatically}
                            onCheckedChange={(checked) => 
                              setCreateCategoriesAutomatically(!!checked)
                            }
                          />
                          <label 
                            htmlFor="auto-create-categories" 
                            className="text-sm cursor-pointer"
                          >
                            Create automatically
                          </label>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {validationSummary.newCategories.map((category, index) => (
                          <Badge key={index} variant="outline">
                            {category}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Validation Errors */}
                  {validationSummary.errors.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">Validation Errors</h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDownloadErrorReport}
                          disabled={downloadErrorReportMutation.isPending}
                        >
                          <Download className="mr-2 h-4 w-4" />
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
                                <code className="px-1 py-0.5 bg-muted rounded text-xs">
                                  {error.value || '(empty)'}
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
                    <div className="space-y-2">
                      <h3 className="font-medium">Product Preview</h3>
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
                              ) || `Category ID: ${product.categoryId}`}</TableCell>
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
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Store Selection Required</AlertTitle>
                      <AlertDescription>
                        Please select a store from the dropdown above before importing products.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={() => setCurrentTab('upload')}
                disabled={importMutation.isPending}
              >
                Back
              </Button>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
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
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
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
        
        <TabsContent value="results">
          <Card>
            <CardHeader>
              <CardTitle>Import Results</CardTitle>
              <CardDescription>
                Summary of the product import process.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {importResult && (
                <>
                  <div className="flex items-center justify-center p-6">
                    {importResult.success && importResult.failedProducts.length === 0 ? (
                      <div className="flex flex-col items-center text-center">
                        <div className="rounded-full bg-green-100 p-3 mb-4">
                          <CheckCircle className="h-10 w-10 text-green-600" />
                        </div>
                        <h3 className="text-xl font-semibold">Import Completed Successfully</h3>
                        <p className="text-muted-foreground mt-1">
                          All {importResult.importedCount} products were imported successfully.
                        </p>
                      </div>
                    ) : importResult.success && importResult.failedProducts.length > 0 ? (
                      <div className="flex flex-col items-center text-center">
                        <div className="rounded-full bg-amber-100 p-3 mb-4">
                          <AlertTriangle className="h-10 w-10 text-amber-600" />
                        </div>
                        <h3 className="text-xl font-semibold">Import Completed with Warnings</h3>
                        <p className="text-muted-foreground mt-1">
                          {importResult.importedCount} products were imported successfully, 
                          but {importResult.failedProducts.length} products failed.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-center">
                        <div className="rounded-full bg-red-100 p-3 mb-4">
                          <FileX className="h-10 w-10 text-red-600" />
                        </div>
                        <h3 className="text-xl font-semibold">Import Failed</h3>
                        <p className="text-muted-foreground mt-1">
                          {importResult.importedCount > 0 
                            ? `Only ${importResult.importedCount} products were imported successfully.`
                            : 'No products were imported.'}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded-md p-4">
                      <p className="text-sm text-muted-foreground">Imported Successfully</p>
                      <p className="text-2xl font-semibold text-green-600">
                        {importResult.importedCount}
                      </p>
                    </div>
                    <div className="border rounded-md p-4">
                      <p className="text-sm text-muted-foreground">Failed Products</p>
                      <p className="text-2xl font-semibold text-red-600">
                        {importResult.failedProducts.length}
                      </p>
                    </div>
                    <div className="border rounded-md p-4">
                      <p className="text-sm text-muted-foreground">Target Store</p>
                      <div className="flex items-center text-xl font-semibold">
                        <Store className="h-4 w-4 mr-2 text-primary" />
                        {Array.isArray(storesQuery.data) && storesQuery.data.find((store: any) => 
                          store.id.toString() === selectedStoreId
                        )?.name || `Store ID: ${selectedStoreId}`}
                      </div>
                    </div>
                  </div>
                  
                  {/* Failed Products */}
                  {importResult.failedProducts.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-medium">Failed Products</h3>
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
                              <TableCell className="text-red-600">{item.error}</TableCell>
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
            <CardFooter className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={() => setCurrentTab('validate')}
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
              You are about to import {validProducts.length} products into{' '}
              <span className="font-medium">
                {Array.isArray(storesQuery.data) && storesQuery.data.find((store: any) => 
                  store.id.toString() === selectedStoreId
                )?.name || `Store ID: ${selectedStoreId}`}
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