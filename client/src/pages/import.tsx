import React, { useState } from 'react';
import { Link } from 'wouter';
import { useAuth } from '@/providers/auth-provider';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, FileUp, FileWarning, FileCheck, FileX, Download, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface ColumnMapping {
  source: string;
  target: string;
  confidence: number;
  required: boolean;
}

interface MappedField {
  sourceColumn: string;
  targetColumn: string;
}

interface ImportError {
  row: number;
  field: string;
  value: string;
  reason: string;
}

interface MissingField {
  row: number;
  field: string;
  isRequired: boolean;
}

interface Store {
  id: number;
  name: string;
  address: string;
  isActive: boolean;
}

interface ImportResult {
  success: boolean;
  totalRows: number;
  importedRows: number;
  errors: ImportError[];
  mappedData: any[];
  missingFields: MissingField[];
  lastUpdated?: Date;
}

export default function ImportPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [dataType, setDataType] = useState<'loyalty' | 'inventory'>('loyalty');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMapping, setIsMapping] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  
  const [originalData, setOriginalData] = useState<any[]>([]);
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [suggestedMappings, setSuggestedMappings] = useState<ColumnMapping[]>([]);
  const [finalMappings, setFinalMappings] = useState<Record<string, string>>({});
  
  const [validationResult, setValidationResult] = useState<ImportResult | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [currentStep, setCurrentStep] = useState<'upload' | 'mapping' | 'validation' | 'import' | 'complete'>('upload');
  const [selectedStore, setSelectedStore] = useState<string>('');
  
  // Fetch available stores
  const { data: stores, isLoading: isLoadingStores } = useQuery<Store[]>({
    queryKey: ['/api/stores'],
    enabled: user?.role === 'admin' || currentStep === 'import', // Only fetch for admins or when needed
  });
  
  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };
  
  // Handle file upload and analysis
  const handleFileUpload = async () => {
    if (!file) {
      toast({
        title: 'No file selected',
        description: 'Please select a file to upload',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('dataType', dataType);
    
    try {
      const response = await apiRequest('POST', '/api/import/analyze', formData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze file');
      }
      
      const data = await response.json();
      setOriginalData(data.data);
      setSampleData(data.sampleData);
      setSuggestedMappings(data.columnSuggestions);
      
      // Initialize mappings from suggestions with high confidence
      const initialMappings: Record<string, string> = {};
      data.columnSuggestions.forEach((mapping: ColumnMapping) => {
        if (mapping.confidence > 0.7) {
          initialMappings[mapping.source] = mapping.target;
        }
      });
      setFinalMappings(initialMappings);
      
      setCurrentStep('mapping');
      
      toast({
        title: 'File analyzed successfully',
        description: `Found ${data.data.length} rows of data`,
      });
    } catch (error: any) {
      console.error('Error analyzing file:', error);
      toast({
        title: 'Error analyzing file',
        description: error.message || 'Failed to analyze file',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle mapping change
  const handleMappingChange = (sourceColumn: string, targetColumn: string) => {
    setFinalMappings({
      ...finalMappings,
      [sourceColumn]: targetColumn,
    });
  };
  
  // Handle mapping completion and validation
  const handleValidateData = async () => {
    setIsValidating(true);
    
    try {
      const response = await apiRequest('POST', '/api/import/validate', {
        data: originalData,
        mapping: finalMappings,
        dataType,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to validate data');
      }
      
      const result = await response.json();
      setValidationResult(result);
      setCurrentStep('validation');
      
      toast({
        title: 'Data validated',
        description: `${result.importedRows} of ${result.totalRows} rows are valid`,
        variant: result.success ? 'default' : 'destructive',
      });
    } catch (error: any) {
      console.error('Error validating data:', error);
      toast({
        title: 'Error validating data',
        description: error.message || 'Failed to validate data',
        variant: 'destructive',
      });
    } finally {
      setIsValidating(false);
    }
  };
  
  // Handle final import
  const handleImportData = async () => {
    if (!selectedStore) {
      toast({
        title: 'Store selection required',
        description: 'Please select a store for this import',
        variant: 'destructive',
      });
      return;
    }
    
    setIsImporting(true);
    
    try {
      const response = await apiRequest('POST', '/api/import/process', {
        data: validationResult?.mappedData,
        dataType,
        storeId: selectedStore,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to import data');
      }
      
      const result = await response.json();
      setImportResult(result);
      setCurrentStep('complete');
      
      // Invalidate queries based on data type
      if (dataType === 'loyalty') {
        queryClient.invalidateQueries({ queryKey: ['/api/loyalty/members'] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/products'] });
        queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      }
      
      toast({
        title: 'Import completed',
        description: `Successfully imported ${result.importedRows} of ${result.totalRows} rows`,
      });
    } catch (error: any) {
      console.error('Error importing data:', error);
      toast({
        title: 'Error importing data',
        description: error.message || 'Failed to import data',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };
  
  // Handle error report download
  const handleDownloadErrorReport = async () => {
    if (!validationResult) return;
    
    try {
      const requestBody = { validationResult, dataType };
      const response = await fetch('/api/import/error-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/csv',
          "Cache-Control": "no-cache, no-store",
          "Pragma": "no-cache"
        },
        body: JSON.stringify(requestBody),
        credentials: "include",
        cache: "no-store"
      });
      
      if (!response.ok) {
        const text = (await response.text()) || response.statusText;
        throw new Error(`${response.status}: ${text}`);
      }
      
      // Create a download link and trigger the download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'import-errors.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: 'Error report downloaded',
        description: 'The error report has been downloaded as a CSV file',
      });
    } catch (error: any) {
      console.error('Error downloading error report:', error);
      toast({
        title: 'Error downloading report',
        description: error.message || 'Failed to download error report',
        variant: 'destructive',
      });
    }
  };
  
  // Reset the import process
  const handleReset = () => {
    setFile(null);
    setOriginalData([]);
    setSampleData([]);
    setSuggestedMappings([]);
    setFinalMappings({});
    setValidationResult(null);
    setImportResult(null);
    setCurrentStep('upload');
    setSelectedStore('');
  };
  
  // Get target fields based on data type
  const getTargetFields = () => {
    if (dataType === 'loyalty') {
      return [
        { name: 'fullName', label: 'Full Name', required: true },
        { name: 'email', label: 'Email', required: false },
        { name: 'phone', label: 'Phone', required: false },
        { name: 'loyaltyId', label: 'Loyalty ID', required: true },
        { name: 'points', label: 'Points', required: false },
        { name: 'tier', label: 'Tier', required: false },
        { name: 'enrollmentDate', label: 'Enrollment Date', required: false },
        { name: 'storeId', label: 'Store ID', required: true },
      ];
    } else {
      return [
        { name: 'name', label: 'Product Name', required: true },
        { name: 'description', label: 'Description', required: false },
        { name: 'barcode', label: 'Barcode', required: true },
        { name: 'price', label: 'Price', required: true },
        { name: 'categoryId', label: 'Category', required: true },
        { name: 'isPerishable', label: 'Perishable', required: false },
        { name: 'quantity', label: 'Quantity', required: true },
        { name: 'storeId', label: 'Store ID', required: true },
      ];
    }
  };
  
  // Calculate mapping completion percentage
  const getMappingCompletionPercentage = () => {
    const targetFields = getTargetFields();
    const requiredFields = targetFields.filter(field => field.required);
    
    let mappedCount = 0;
    requiredFields.forEach(field => {
      if (Object.values(finalMappings).includes(field.name)) {
        mappedCount++;
      }
    });
    
    return (mappedCount / requiredFields.length) * 100;
  };
  
  // Get confidence color based on score
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.6) return 'bg-amber-500';
    return 'bg-red-500';
  };
  
  return (
    <AppShell>
      <div className="container py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Data Import</h1>
            <p className="text-muted-foreground">Import customer loyalty and inventory data from CSV or Excel files</p>
          </div>
        </div>
        
        <Tabs value={dataType} onValueChange={(value) => setDataType(value as 'loyalty' | 'inventory')}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="loyalty">Loyalty Data</TabsTrigger>
            <TabsTrigger value="inventory">Inventory Data</TabsTrigger>
          </TabsList>
          
          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  {currentStep === 'upload' && 'Upload File'}
                  {currentStep === 'mapping' && 'Map Columns'}
                  {currentStep === 'validation' && 'Validate Data'}
                  {currentStep === 'import' && 'Import Data'}
                  {currentStep === 'complete' && 'Import Complete'}
                </CardTitle>
                <CardDescription>
                  {currentStep === 'upload' && 'Upload a CSV or Excel file containing your data'}
                  {currentStep === 'mapping' && 'Map your file columns to ChainSync fields'}
                  {currentStep === 'validation' && 'Review validation results before import'}
                  {currentStep === 'import' && 'Select destination store and complete import'}
                  {currentStep === 'complete' && 'Your data has been successfully imported'}
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                {/* Step indicators */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center flex-1">
                    <div className={`rounded-full w-8 h-8 flex items-center justify-center ${currentStep === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>1</div>
                    <div className={`h-1 flex-1 mx-2 ${currentStep === 'upload' ? 'bg-primary/50' : 'bg-muted'}`}></div>
                  </div>
                  <div className="flex items-center flex-1">
                    <div className={`rounded-full w-8 h-8 flex items-center justify-center ${currentStep === 'mapping' ? 'bg-primary text-primary-foreground' : currentStep === 'upload' ? 'bg-muted text-muted-foreground' : 'bg-muted text-muted-foreground'}`}>2</div>
                    <div className={`h-1 flex-1 mx-2 ${currentStep === 'mapping' ? 'bg-primary/50' : 'bg-muted'}`}></div>
                  </div>
                  <div className="flex items-center flex-1">
                    <div className={`rounded-full w-8 h-8 flex items-center justify-center ${currentStep === 'validation' ? 'bg-primary text-primary-foreground' : currentStep === 'upload' || currentStep === 'mapping' ? 'bg-muted text-muted-foreground' : 'bg-muted text-muted-foreground'}`}>3</div>
                    <div className={`h-1 flex-1 mx-2 ${currentStep === 'validation' ? 'bg-primary/50' : 'bg-muted'}`}></div>
                  </div>
                  <div className="flex items-center flex-1">
                    <div className={`rounded-full w-8 h-8 flex items-center justify-center ${currentStep === 'import' ? 'bg-primary text-primary-foreground' : currentStep === 'complete' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>4</div>
                  </div>
                </div>
                
                {/* File Upload Step */}
                {currentStep === 'upload' && (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed rounded-lg p-8 text-center">
                      <FileUp className="mx-auto h-12 w-12 text-muted-foreground" />
                      <h3 className="mt-2 text-lg font-semibold">Upload your data file</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {dataType === 'loyalty' ? 'Upload customer loyalty data' : 'Upload inventory data'} in CSV or Excel format
                      </p>
                      <div className="mt-4">
                        <Input
                          type="file"
                          accept=".csv,.xlsx,.xls"
                          onChange={handleFileChange}
                          className="max-w-sm mx-auto"
                        />
                      </div>
                      {file && (
                        <div className="mt-2 text-sm">
                          Selected file: <span className="font-medium">{file.name}</span> ({(file.size / 1024).toFixed(2)} KB)
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Mapping Step */}
                {currentStep === 'mapping' && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">Column Mapping</h3>
                      <div className="flex items-center gap-2">
                        <div className="text-sm">Mapping Progress:</div>
                        <Progress value={getMappingCompletionPercentage()} className="w-32 h-2" />
                        <span className="text-sm">{Math.round(getMappingCompletionPercentage())}%</span>
                      </div>
                    </div>
                    
                    {suggestedMappings.length > 0 && (
                      <div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Source Column</TableHead>
                              <TableHead>Target Field</TableHead>
                              <TableHead className="w-32">Confidence</TableHead>
                              <TableHead className="w-24">Required</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {suggestedMappings.map((mapping) => (
                              <TableRow key={mapping.source}>
                                <TableCell className="font-medium">{mapping.source}</TableCell>
                                <TableCell>
                                  <Select
                                    value={finalMappings[mapping.source] || ''}
                                    onValueChange={(value) => handleMappingChange(mapping.source, value)}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Select a field" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="">Don't Import</SelectItem>
                                      {getTargetFields().map((field) => (
                                        <SelectItem key={field.name} value={field.name}>
                                          {field.label} {field.required && '*'}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${getConfidenceColor(mapping.confidence)}`}></div>
                                    <span>{Math.round(mapping.confidence * 100)}%</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {mapping.required ? (
                                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Required</Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Optional</Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                    
                    {sampleData.length > 0 && (
                      <div className="mt-8">
                        <h3 className="text-lg font-semibold mb-2">Sample Data Preview</h3>
                        <div className="border rounded-md overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>#</TableHead>
                                {Object.keys(sampleData[0]).map((key) => (
                                  <TableHead key={key}>{key}</TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sampleData.map((row, index) => (
                                <TableRow key={index}>
                                  <TableCell>{index + 1}</TableCell>
                                  {Object.values(row).map((value: any, valueIndex) => (
                                    <TableCell key={valueIndex}>
                                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Validation Step */}
                {currentStep === 'validation' && validationResult && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="bg-muted rounded-md p-4 flex-1">
                        <div className="text-sm text-muted-foreground">Total Rows</div>
                        <div className="text-2xl font-bold">{validationResult.totalRows}</div>
                      </div>
                      <div className="bg-muted rounded-md p-4 flex-1">
                        <div className="text-sm text-muted-foreground">Valid Rows</div>
                        <div className="text-2xl font-bold">{validationResult.importedRows}</div>
                      </div>
                      <div className="bg-muted rounded-md p-4 flex-1">
                        <div className="text-sm text-muted-foreground">Errors</div>
                        <div className="text-2xl font-bold">{validationResult.errors.length}</div>
                      </div>
                      <div className="bg-muted rounded-md p-4 flex-1">
                        <div className="text-sm text-muted-foreground">Missing Fields</div>
                        <div className="text-2xl font-bold">{validationResult.missingFields.length}</div>
                      </div>
                    </div>
                    
                    {validationResult.success ? (
                      <Alert className="bg-green-50 border-green-200">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <AlertTitle className="text-green-800">Validation Successful</AlertTitle>
                        <AlertDescription className="text-green-700">
                          All data is valid and ready to import.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Alert className="bg-amber-50 border-amber-200">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertTitle className="text-amber-800">Validation Issues Found</AlertTitle>
                        <AlertDescription className="text-amber-700">
                          Some rows have errors or missing fields. You can proceed with importing the valid rows or go back to fix the issues.
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {validationResult.errors.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Validation Errors</h3>
                        <div className="border rounded-md overflow-x-auto">
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
                              {validationResult.errors.slice(0, 10).map((error, index) => (
                                <TableRow key={index}>
                                  <TableCell>{error.row}</TableCell>
                                  <TableCell>{error.field}</TableCell>
                                  <TableCell>{error.value}</TableCell>
                                  <TableCell>{error.reason}</TableCell>
                                </TableRow>
                              ))}
                              {validationResult.errors.length > 10 && (
                                <TableRow>
                                  <TableCell colSpan={4} className="text-center">
                                    And {validationResult.errors.length - 10} more errors...
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                        <div className="mt-2 text-right">
                          <Button variant="outline" size="sm" onClick={handleDownloadErrorReport}>
                            <Download className="h-4 w-4 mr-2" />
                            Download Full Error Report
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {validationResult.missingFields.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Missing Fields</h3>
                        <div className="border rounded-md overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Row</TableHead>
                                <TableHead>Field</TableHead>
                                <TableHead>Required</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {validationResult.missingFields.slice(0, 10).map((field, index) => (
                                <TableRow key={index}>
                                  <TableCell>{field.row}</TableCell>
                                  <TableCell>{field.field}</TableCell>
                                  <TableCell>
                                    {field.isRequired ? (
                                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Required</Badge>
                                    ) : (
                                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Optional</Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                              {validationResult.missingFields.length > 10 && (
                                <TableRow>
                                  <TableCell colSpan={3} className="text-center">
                                    And {validationResult.missingFields.length - 10} more missing fields...
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Import Step */}
                {currentStep === 'import' && (
                  <div className="space-y-6">
                    <Alert className="bg-blue-50 border-blue-200">
                      <AlertTitle className="text-blue-800">Select Import Destination</AlertTitle>
                      <AlertDescription className="text-blue-700">
                        Choose the store where you want to import this data.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium">Destination Store</label>
                        {isLoadingStores ? (
                          <Skeleton className="h-10 w-full rounded-md" />
                        ) : (
                          <Select value={selectedStore} onValueChange={setSelectedStore}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a store" />
                            </SelectTrigger>
                            <SelectContent>
                              {stores && stores.length > 0 ? (
                                stores.map(store => (
                                  <SelectItem key={store.id} value={String(store.id)}>
                                    {store.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="" disabled>No stores available</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium">Import Summary</label>
                        <div className="p-3 border rounded-md mt-2">
                          <div className="flex justify-between mb-1">
                            <span className="text-muted-foreground">Data Type:</span>
                            <span>{dataType === 'loyalty' ? 'Customer Loyalty' : 'Inventory'}</span>
                          </div>
                          <div className="flex justify-between mb-1">
                            <span className="text-muted-foreground">Total Rows:</span>
                            <span>{validationResult?.totalRows || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Valid Rows:</span>
                            <span>{validationResult?.importedRows || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Complete Step */}
                {currentStep === 'complete' && importResult && (
                  <div className="space-y-6 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold">Import Completed Successfully</h2>
                    <p className="text-muted-foreground">
                      Successfully imported {importResult.importedRows} of {importResult.totalRows} rows.
                    </p>
                    
                    <div className="bg-muted p-4 rounded-md max-w-md mx-auto">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-left">
                          <div className="text-sm text-muted-foreground">Data Type</div>
                          <div className="font-medium">{dataType === 'loyalty' ? 'Customer Loyalty' : 'Inventory'}</div>
                        </div>
                        <div className="text-left">
                          <div className="text-sm text-muted-foreground">Store</div>
                          <div className="font-medium">
                            {stores?.find(store => store.id === parseInt(selectedStore))?.name || `Store #${selectedStore}`}
                          </div>
                        </div>
                        <div className="text-left">
                          <div className="text-sm text-muted-foreground">Total Rows</div>
                          <div className="font-medium">{importResult.totalRows}</div>
                        </div>
                        <div className="text-left">
                          <div className="text-sm text-muted-foreground">Imported Rows</div>
                          <div className="font-medium">{importResult.importedRows}</div>
                        </div>
                        {importResult.lastUpdated && (
                        <div className="text-left col-span-2">
                          <div className="text-sm text-muted-foreground">Last Updated</div>
                          <div className="font-medium">
                            {new Date(importResult.lastUpdated).toLocaleString()}
                          </div>
                        </div>
                        )}
                      </div>
                    </div>
                    
                    {importResult.errors && importResult.errors.length > 0 && (
                      <Alert className="bg-amber-50 border-amber-200">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertTitle className="text-amber-800">Some Rows Were Not Imported</AlertTitle>
                        <AlertDescription className="text-amber-700">
                          {importResult.errors.length} rows could not be imported due to errors.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
              
              <CardFooter className="flex justify-between">
                {currentStep !== 'upload' && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (currentStep === 'mapping') setCurrentStep('upload');
                      if (currentStep === 'validation') setCurrentStep('mapping');
                      if (currentStep === 'import') setCurrentStep('validation');
                      if (currentStep === 'complete') handleReset();
                    }}
                  >
                    {currentStep === 'complete' ? 'Start New Import' : 'Back'}
                  </Button>
                )}
                
                {currentStep === 'upload' && (
                  <Button
                    disabled={!file || isLoading}
                    onClick={handleFileUpload}
                    className="ml-auto"
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Analyze File
                  </Button>
                )}
                
                {currentStep === 'mapping' && (
                  <Button
                    disabled={isValidating || getMappingCompletionPercentage() < 100}
                    onClick={handleValidateData}
                  >
                    {isValidating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Validate Data
                  </Button>
                )}
                
                {currentStep === 'validation' && (
                  <Button
                    disabled={!validationResult || validationResult.importedRows === 0}
                    onClick={() => setCurrentStep('import')}
                  >
                    Continue to Import
                  </Button>
                )}
                
                {currentStep === 'import' && (
                  <Button
                    disabled={!selectedStore || isImporting}
                    onClick={handleImportData}
                  >
                    {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Import Data
                  </Button>
                )}
                
                {currentStep === 'complete' && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (dataType === 'loyalty') {
                          window.location.href = '/loyalty';
                        } else {
                          window.location.href = '/inventory';
                        }
                      }}
                    >
                      {dataType === 'loyalty' ? 'View Loyalty Members' : 'View Inventory'}
                    </Button>
                    <Button onClick={handleReset}>Start New Import</Button>
                  </div>
                )}
              </CardFooter>
            </Card>
          </div>
        </Tabs>
      </div>
    </AppShell>
  );
}
