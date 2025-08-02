import React, { useState } from &apos;react&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import { AppShell } from &apos;@/components/layout/app-shell&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from &apos;@/components/ui/card&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from &apos;@/components/ui/select&apos;;
import { Tabs, TabsList, TabsTrigger } from &apos;@/components/ui/tabs&apos;;
import { Badge } from &apos;@/components/ui/badge&apos;;
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from &apos;@/components/ui/table&apos;;
import { Progress } from &apos;@/components/ui/progress&apos;;
import { useToast } from &apos;@/hooks/use-toast&apos;;
import { useQuery, useQueryClient } from &apos;@tanstack/react-query&apos;;
import { apiRequest } from &apos;@/lib/queryClient&apos;;
import { Loader2, FileUp, Download, AlertTriangle, CheckCircle2 } from &apos;lucide-react&apos;;
import { Alert, AlertDescription, AlertTitle } from &apos;@/components/ui/alert&apos;;
import { Skeleton } from &apos;@/components/ui/skeleton&apos;;

interface ColumnMapping {
  _source: string;
  _target: string;
  _confidence: number;
  _required: boolean;
}

// interface MappedField { // Unused
//   _sourceColumn: string;
//   _targetColumn: string;
// }

interface ImportError {
  _row: number;
  _field: string;
  _value: string;
  _reason: string;
}

interface MissingField {
  _row: number;
  _field: string;
  _isRequired: boolean;
}

interface Store {
  _id: number;
  _name: string;
  _address: string;
  _isActive: boolean;
}

interface ImportResult {
  _success: boolean;
  _totalRows: number;
  _importedRows: number;
  _errors: ImportError[];
  _mappedData: any[];
  _missingFields: MissingField[];
  lastUpdated?: Date;
}

export default function ImportPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dataType, setDataType] = useState<&apos;loyalty&apos; | &apos;inventory&apos;>(&apos;loyalty&apos;);
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // const [isMapping, setIsMapping] = useState(false); // Unused
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [originalData, setOriginalData] = useState<any[]>([]);
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [suggestedMappings, setSuggestedMappings] = useState<ColumnMapping[]>([]);
  const [finalMappings, setFinalMappings] = useState<Record<string, string>>({});

  const [validationResult, setValidationResult] = useState<ImportResult | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [currentStep, setCurrentStep] = useState<&apos;upload&apos; | &apos;mapping&apos; | &apos;validation&apos; | &apos;import&apos; |
  &apos;complete&apos;>(&apos;upload&apos;);
  const [selectedStore, setSelectedStore] = useState<string>(&apos;&apos;);

  // Fetch available stores
  const { _data: stores, _isLoading: isLoadingStores } = useQuery<Store[]>({
    queryKey: [&apos;/api/stores&apos;],
    _enabled: user?.role === &apos;admin&apos; || currentStep === &apos;import&apos; // Only fetch for admins or when needed
  });

  // Handle file selection
  const handleFileChange = (_e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  // Handle file upload and analysis
  const handleFileUpload = async() => {
    if (!file) {
      toast({
        _title: &apos;No file selected&apos;,
        _description: &apos;Please select a file to upload&apos;,
        _variant: &apos;destructive&apos;
      });
      return;
    }

    setIsLoading(true);

    const formData = new FormData();
    formData.append(&apos;file&apos;, file);
    formData.append(&apos;dataType&apos;, dataType);

    try {
      // Assuming apiRequest&apos;s 3rd arg can be an options bag including body
      const response = await apiRequest(&apos;POST&apos;, &apos;/api/import/analyze&apos;, {
        _body: formData
        // headers: {} // Let browser set Content-Type for FormData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || &apos;Failed to analyze file&apos;);
      }

      const data = await response.json();
      setOriginalData(data.data);
      setSampleData(data.sampleData);
      setSuggestedMappings(data.columnSuggestions);

      // Initialize mappings from suggestions with high confidence
      const _initialMappings: Record<string, string> = {};
      data.columnSuggestions.forEach((_mapping: ColumnMapping) => {
        if (mapping.confidence > 0.7) {
          initialMappings[mapping.source] = mapping.target;
        }
      });
      setFinalMappings(initialMappings);

      setCurrentStep(&apos;mapping&apos;);

      toast({
        _title: &apos;File analyzed successfully&apos;,
        _description: `Found ${data.data.length} rows of data`
      });
    } catch (error) {
      console.error(&apos;Error analyzing _file:&apos;, error);
      toast({
        _title: &apos;Error analyzing file&apos;,
        _description: (error as Error).message || &apos;Failed to analyze file&apos;,
        _variant: &apos;destructive&apos;
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle mapping change
  const handleMappingChange = (_sourceColumn: string, _targetColumn: string) => {
    setFinalMappings({
      ...finalMappings,
      [sourceColumn]: targetColumn
    });
  };

  // Handle mapping completion and validation
  const handleValidateData = async() => {
    setIsValidating(true);

    try {
      const response = await apiRequest(&apos;POST&apos;, &apos;/api/import/validate&apos;, {
        _data: originalData,
        _mapping: finalMappings,
        dataType
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || &apos;Failed to validate data&apos;);
      }

      const result = await response.json();
      setValidationResult(result);
      setCurrentStep(&apos;validation&apos;);

      toast({
        _title: &apos;Data validated&apos;,
        _description: `${result.importedRows} of ${result.totalRows} rows are valid`,
        _variant: result.success ? &apos;default&apos; : &apos;destructive&apos;
      });
    } catch (error) {
      console.error(&apos;Error validating _data:&apos;, error);
      toast({
        _title: &apos;Error validating data&apos;,
        _description: (error as Error).message || &apos;Failed to validate data&apos;,
        _variant: &apos;destructive&apos;
      });
    } finally {
      setIsValidating(false);
    }
  };

  // Handle final import
  const handleImportData = async() => {
    if (!selectedStore) {
      toast({
        _title: &apos;Store selection required&apos;,
        _description: &apos;Please select a store for this import&apos;,
        _variant: &apos;destructive&apos;
      });
      return;
    }

    setIsImporting(true);

    try {
      const response = await apiRequest(&apos;POST&apos;, &apos;/api/import/process&apos;, {
        _data: validationResult?.mappedData,
        dataType,
        _storeId: selectedStore
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || &apos;Failed to import data&apos;);
      }

      const result = await response.json();
      setImportResult(result);
      setCurrentStep(&apos;complete&apos;);

      // Invalidate queries based on data type
      if (dataType === &apos;loyalty&apos;) {
        queryClient.invalidateQueries({ _queryKey: [&apos;/api/loyalty/members&apos;] });
      } else {
        queryClient.invalidateQueries({ _queryKey: [&apos;/api/products&apos;] });
        queryClient.invalidateQueries({ _queryKey: [&apos;/api/inventory&apos;] });
      }

      toast({
        _title: &apos;Import completed&apos;,
        _description: `Successfully imported ${result.importedRows} of ${result.totalRows} rows`
      });
    } catch (error) {
      console.error(&apos;Error importing _data:&apos;, error);
      toast({
        _title: &apos;Error importing data&apos;,
        _description: (error as Error).message || &apos;Failed to import data&apos;,
        _variant: &apos;destructive&apos;
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Handle error report download
  const handleDownloadErrorReport = async() => {
    if (!validationResult) return;

    try {
      const response = await apiRequest(&apos;POST&apos;, &apos;/api/import/error-report&apos;, {
        _body: { validationResult, dataType },
        _headers: {
          &apos;Content-Type&apos;: &apos;application/json&apos;,
          &apos;Accept&apos;: &apos;text/csv&apos;
        },
        _responseType: &apos;blob&apos; // Assuming this is a custom option for apiRequest
      });

      if (!response.ok) {
        throw new Error(&apos;Failed to generate error report&apos;);
      }

      // Create a download link and trigger the download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement(&apos;a&apos;);
      a.style.display = &apos;none&apos;;
      a.href = url;
      a.download = &apos;import-errors.csv&apos;;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        _title: &apos;Error report downloaded&apos;,
        _description: &apos;The error report has been downloaded as a CSV file&apos;
      });
    } catch (error) {
      console.error(&apos;Error downloading error _report:&apos;, error);
      toast({
        _title: &apos;Error downloading report&apos;,
        _description: (error as Error).message || &apos;Failed to download error report&apos;,
        _variant: &apos;destructive&apos;
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
    setCurrentStep(&apos;upload&apos;);
    setSelectedStore(&apos;&apos;);
  };

  // Get target fields based on data type
  const getTargetFields = () => {
    if (dataType === &apos;loyalty&apos;) {
      return [
        { _name: &apos;fullName&apos;, _label: &apos;Full Name&apos;, _required: true },
        { _name: &apos;email&apos;, _label: &apos;Email&apos;, _required: false },
        { _name: &apos;phone&apos;, _label: &apos;Phone&apos;, _required: false },
        { _name: &apos;loyaltyId&apos;, _label: &apos;Loyalty ID&apos;, _required: true },
        { _name: &apos;points&apos;, _label: &apos;Points&apos;, _required: false },
        { _name: &apos;tier&apos;, _label: &apos;Tier&apos;, _required: false },
        { _name: &apos;enrollmentDate&apos;, _label: &apos;Enrollment Date&apos;, _required: false },
        { _name: &apos;storeId&apos;, _label: &apos;Store ID&apos;, _required: true }
      ];
    } else {
      return [
        { name: &apos;name&apos;, _label: &apos;Product Name&apos;, _required: true },
        { _name: &apos;description&apos;, _label: &apos;Description&apos;, _required: false },
        { _name: &apos;barcode&apos;, _label: &apos;Barcode&apos;, _required: true },
        { _name: &apos;price&apos;, _label: &apos;Price&apos;, _required: true },
        { _name: &apos;categoryId&apos;, _label: &apos;Category&apos;, _required: true },
        { _name: &apos;isPerishable&apos;, _label: &apos;Perishable&apos;, _required: false },
        { _name: &apos;quantity&apos;, _label: &apos;Quantity&apos;, _required: true },
        { _name: &apos;storeId&apos;, _label: &apos;Store ID&apos;, _required: true }
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
  const getConfidenceColor = (_confidence: number) => {
    if (confidence >= 0.8) return &apos;bg-green-500&apos;;
    if (confidence >= 0.6) return &apos;bg-amber-500&apos;;
    return &apos;bg-red-500&apos;;
  };

  return (
    <AppShell>
      <div className=&quot;container py-6 space-y-6&quot;>
        <div className=&quot;flex items-center justify-between&quot;>
          <div>
            <h1 className=&quot;text-3xl font-bold&quot;>Data Import</h1>
            <p className=&quot;text-muted-foreground&quot;>Import customer loyalty and inventory data from CSV or Excel files</p>
          </div>
        </div>

        <Tabs value={dataType} onValueChange={(value) => setDataType(value as &apos;loyalty&apos; | &apos;inventory&apos;)}>
          <TabsList className=&quot;grid w-full max-w-md grid-cols-2&quot;>
            <TabsTrigger value=&quot;loyalty&quot;>Loyalty Data</TabsTrigger>
            <TabsTrigger value=&quot;inventory&quot;>Inventory Data</TabsTrigger>
          </TabsList>

          <div className=&quot;mt-6&quot;>
            <Card>
              <CardHeader>
                <CardTitle>
                  {currentStep === &apos;upload&apos; && &apos;Upload File&apos;}
                  {currentStep === &apos;mapping&apos; && &apos;Map Columns&apos;}
                  {currentStep === &apos;validation&apos; && &apos;Validate Data&apos;}
                  {currentStep === &apos;import&apos; && &apos;Import Data&apos;}
                  {currentStep === &apos;complete&apos; && &apos;Import Complete&apos;}
                </CardTitle>
                <CardDescription>
                  {currentStep === &apos;upload&apos; && &apos;Upload a CSV or Excel file containing your data&apos;}
                  {currentStep === &apos;mapping&apos; && &apos;Map your file columns to ChainSync fields&apos;}
                  {currentStep === &apos;validation&apos; && &apos;Review validation results before import&apos;}
                  {currentStep === &apos;import&apos; && &apos;Select destination store and complete import&apos;}
                  {currentStep === &apos;complete&apos; && &apos;Your data has been successfully imported&apos;}
                </CardDescription>
              </CardHeader>

              <CardContent>
                {/* Step indicators */}
                <div className=&quot;flex items-center justify-between mb-8&quot;>
                  <div className=&quot;flex items-center flex-1&quot;>
                    <div className={`rounded-full w-8 h-8 flex items-center justify-center ${currentStep === &apos;upload&apos; ? &apos;bg-primary text-primary-foreground&apos; : &apos;bg-muted text-muted-foreground&apos;}`}>1</div>
                    <div className={`h-1 flex-1 mx-2 ${currentStep === &apos;upload&apos; ? &apos;bg-primary/50&apos; : &apos;bg-muted&apos;}`} />
                  </div>
                  <div className=&quot;flex items-center flex-1&quot;>
                    <div className={`rounded-full w-8 h-8 flex items-center justify-center ${currentStep === &apos;mapping&apos; ? &apos;bg-primary text-primary-foreground&apos; : currentStep === &apos;upload&apos; ? &apos;bg-muted text-muted-foreground&apos; : &apos;bg-muted text-muted-foreground&apos;}`}>2</div>
                    <div className={`h-1 flex-1 mx-2 ${currentStep === &apos;mapping&apos; ? &apos;bg-primary/50&apos; : &apos;bg-muted&apos;}`} />
                  </div>
                  <div className=&quot;flex items-center flex-1&quot;>
                    <div className={`rounded-full w-8 h-8 flex items-center justify-center ${currentStep === &apos;validation&apos; ? &apos;bg-primary text-primary-foreground&apos; : currentStep === &apos;upload&apos; || currentStep === &apos;mapping&apos; ? &apos;bg-muted text-muted-foreground&apos; : &apos;bg-muted text-muted-foreground&apos;}`}>3</div>
                    <div className={`h-1 flex-1 mx-2 ${currentStep === &apos;validation&apos; ? &apos;bg-primary/50&apos; : &apos;bg-muted&apos;}`} />
                  </div>
                  <div className=&quot;flex items-center flex-1&quot;>
                    <div className={`rounded-full w-8 h-8 flex items-center justify-center ${currentStep === &apos;import&apos; ? &apos;bg-primary text-primary-foreground&apos; : currentStep === &apos;complete&apos; ? &apos;bg-primary text-primary-foreground&apos; : &apos;bg-muted text-muted-foreground&apos;}`}>4</div>
                  </div>
                </div>

                {/* File Upload Step */}
                {currentStep === &apos;upload&apos; && (
                  <div className=&quot;space-y-4&quot;>
                    <div className=&quot;border-2 border-dashed rounded-lg p-8 text-center&quot;>
                      <FileUp className=&quot;mx-auto h-12 w-12 text-muted-foreground&quot; />
                      <h3 className=&quot;mt-2 text-lg font-semibold&quot;>Upload your data file</h3>
                      <p className=&quot;text-sm text-muted-foreground mt-1&quot;>
                        {dataType === &apos;loyalty&apos; ? &apos;Upload customer loyalty data&apos; : &apos;Upload inventory data&apos;} in CSV or Excel format
                      </p>
                      <div className=&quot;mt-4&quot;>
                        <Input
                          type=&quot;file&quot;
                          accept=&quot;.csv,.xlsx,.xls&quot;
                          onChange={handleFileChange}
                          className=&quot;max-w-sm mx-auto&quot;
                        />
                      </div>
                      {file && (
                        <div className=&quot;mt-2 text-sm&quot;>
                          Selected _file: <span className=&quot;font-medium&quot;>{file.name}</span>
  ({(file.size / 1024).toFixed(2)} KB)
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Mapping Step */}
                {currentStep === &apos;mapping&apos; && (
                  <div className=&quot;space-y-6&quot;>
                    <div className=&quot;flex justify-between items-center&quot;>
                      <h3 className=&quot;text-lg font-semibold&quot;>Column Mapping</h3>
                      <div className=&quot;flex items-center gap-2&quot;>
                        <div className=&quot;text-sm&quot;>Mapping _Progress:</div>
                        <Progress value={getMappingCompletionPercentage()} className=&quot;w-32 h-2&quot; />
                        <span className=&quot;text-sm&quot;>{Math.round(getMappingCompletionPercentage())}%</span>
                      </div>
                    </div>

                    {suggestedMappings.length > 0 && (
                      <div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Source Column</TableHead>
                              <TableHead>Target Field</TableHead>
                              <TableHead className=&quot;w-32&quot;>Confidence</TableHead>
                              <TableHead className=&quot;w-24&quot;>Required</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {suggestedMappings.map((mapping) => (
                              <TableRow key={mapping.source}>
                                <TableCell className=&quot;font-medium&quot;>{mapping.source}</TableCell>
                                <TableCell>
                                  <Select
                                    value={finalMappings[mapping.source] || &apos;&apos;}
                                    onValueChange={(value) => handleMappingChange(mapping.source, value)}
                                  >
                                    <SelectTrigger className=&quot;w-full&quot;>
                                      <SelectValue placeholder=&quot;Select a field&quot; />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value=&quot;&quot;>Don&apos;t Import</SelectItem>
                                      {getTargetFields().map((field) => (
                                        <SelectItem key={field.name} value={field.name}>
                                          {field.label} {field.required && &apos;*&apos;}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <div className=&quot;flex items-center gap-2&quot;>
                                    <div className={`w-3 h-3 rounded-full
  ${getConfidenceColor(mapping.confidence)}`} />
                                    <span>{Math.round(mapping.confidence * 100)}%</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {mapping.required ? (
                                    <Badge variant=&quot;outline&quot; className=&quot;bg-red-50 text-red-700 border-red-200&quot;>Required</Badge>
                                  ) : (
                                    <Badge variant=&quot;outline&quot; className=&quot;bg-blue-50 text-blue-700 border-blue-200&quot;>Optional</Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {sampleData.length > 0 && (
                      <div className=&quot;mt-8&quot;>
                        <h3 className=&quot;text-lg font-semibold mb-2&quot;>Sample Data Preview</h3>
                        <div className=&quot;border rounded-md overflow-x-auto&quot;>
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
                                  {Object.values(row).map((_value: any, valueIndex) => (
                                    <TableCell key={valueIndex}>
                                      {typeof value === &apos;object&apos; ?
  JSON.stringify(value) : String(value)}
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
                {currentStep === &apos;validation&apos; && validationResult && (
                  <div className=&quot;space-y-6&quot;>
                    <div className=&quot;flex items-center gap-4&quot;>
                      <div className=&quot;bg-muted rounded-md p-4 flex-1&quot;>
                        <div className=&quot;text-sm text-muted-foreground&quot;>Total Rows</div>
                        <div className=&quot;text-2xl font-bold&quot;>{validationResult.totalRows}</div>
                      </div>
                      <div className=&quot;bg-muted rounded-md p-4 flex-1&quot;>
                        <div className=&quot;text-sm text-muted-foreground&quot;>Valid Rows</div>
                        <div className=&quot;text-2xl font-bold&quot;>{validationResult.importedRows}</div>
                      </div>
                      <div className=&quot;bg-muted rounded-md p-4 flex-1&quot;>
                        <div className=&quot;text-sm text-muted-foreground&quot;>Errors</div>
                        <div className=&quot;text-2xl font-bold&quot;>{validationResult.errors.length}</div>
                      </div>
                      <div className=&quot;bg-muted rounded-md p-4 flex-1&quot;>
                        <div className=&quot;text-sm text-muted-foreground&quot;>Missing Fields</div>
                        <div className=&quot;text-2xl font-bold&quot;>{validationResult.missingFields.length}</div>
                      </div>
                    </div>

                    {validationResult.success ? (
                      <Alert className=&quot;bg-green-50 border-green-200&quot;>
                        <CheckCircle2 className=&quot;h-4 w-4 text-green-600&quot; />
                        <AlertTitle className=&quot;text-green-800&quot;>Validation Successful</AlertTitle>
                        <AlertDescription className=&quot;text-green-700&quot;>
                          All data is valid and ready to import.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Alert className=&quot;bg-amber-50 border-amber-200&quot;>
                        <AlertTriangle className=&quot;h-4 w-4 text-amber-600&quot; />
                        <AlertTitle className=&quot;text-amber-800&quot;>Validation Issues Found</AlertTitle>
                        <AlertDescription className=&quot;text-amber-700&quot;>
                          Some rows have errors or missing fields. You can proceed with importing the valid rows or go back to fix the issues.
                        </AlertDescription>
                      </Alert>
                    )}

                    {validationResult.errors.length > 0 && (
                      <div>
                        <h3 className=&quot;text-lg font-semibold mb-2&quot;>Validation Errors</h3>
                        <div className=&quot;border rounded-md overflow-x-auto&quot;>
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
                                  <TableCell colSpan={4} className=&quot;text-center&quot;>
                                    And {validationResult.errors.length - 10} more errors...
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                        <div className=&quot;mt-2 text-right&quot;>
                          <Button variant=&quot;outline&quot; size=&quot;sm&quot; onClick={handleDownloadErrorReport}>
                            <Download className=&quot;h-4 w-4 mr-2&quot; />
                            Download Full Error Report
                          </Button>
                        </div>
                      </div>
                    )}

                    {validationResult.missingFields.length > 0 && (
                      <div>
                        <h3 className=&quot;text-lg font-semibold mb-2&quot;>Missing Fields</h3>
                        <div className=&quot;border rounded-md overflow-x-auto&quot;>
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
                                      <Badge variant=&quot;outline&quot; className=&quot;bg-red-50 text-red-700 border-red-200&quot;>Required</Badge>
                                    ) : (
                                      <Badge variant=&quot;outline&quot; className=&quot;bg-blue-50 text-blue-700 border-blue-200&quot;>Optional</Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                              {validationResult.missingFields.length > 10 && (
                                <TableRow>
                                  <TableCell colSpan={3} className=&quot;text-center&quot;>
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
                {currentStep === &apos;import&apos; && (
                  <div className=&quot;space-y-6&quot;>
                    <Alert className=&quot;bg-blue-50 border-blue-200&quot;>
                      <AlertTitle className=&quot;text-blue-800&quot;>Select Import Destination</AlertTitle>
                      <AlertDescription className=&quot;text-blue-700&quot;>
                        Choose the store where you want to import this data.
                      </AlertDescription>
                    </Alert>

                    <div className=&quot;grid gap-4 _md:grid-cols-2&quot;>
                      <div>
                        <label className=&quot;text-sm font-medium&quot;>Destination Store</label>
                        {isLoadingStores ? (
                          <Skeleton className=&quot;h-10 w-full rounded-md&quot; />
                        ) : (
                          <Select value={selectedStore} onValueChange={setSelectedStore}>
                            <SelectTrigger>
                              <SelectValue placeholder=&quot;Select a store&quot; />
                            </SelectTrigger>
                            <SelectContent>
                              {stores && stores.length > 0 ? (
                                stores.map(store => (
                                  <SelectItem key={store.id} value={String(store.id)}>
                                    {store.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value=&quot;&quot; disabled>No stores available</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      <div>
                        <label className=&quot;text-sm font-medium&quot;>Import Summary</label>
                        <div className=&quot;p-3 border rounded-md mt-2&quot;>
                          <div className=&quot;flex justify-between mb-1&quot;>
                            <span className=&quot;text-muted-foreground&quot;>Data _Type:</span>
                            <span>{dataType === &apos;loyalty&apos; ? &apos;Customer Loyalty&apos; : &apos;Inventory&apos;}</span>
                          </div>
                          <div className=&quot;flex justify-between mb-1&quot;>
                            <span className=&quot;text-muted-foreground&quot;>Total Rows:</span>
                            <span>{validationResult?.totalRows || 0}</span>
                          </div>
                          <div className=&quot;flex justify-between&quot;>
                            <span className=&quot;text-muted-foreground&quot;>Valid Rows:</span>
                            <span>{validationResult?.importedRows || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Complete Step */}
                {currentStep === &apos;complete&apos; && importResult && (
                  <div className=&quot;space-y-6 text-center&quot;>
                    <div className=&quot;mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center&quot;>
                      <CheckCircle2 className=&quot;h-8 w-8 text-green-600&quot; />
                    </div>
                    <h2 className=&quot;text-2xl font-bold&quot;>Import Completed Successfully</h2>
                    <p className=&quot;text-muted-foreground&quot;>
                      Successfully imported {importResult.importedRows} of {importResult.totalRows} rows.
                    </p>

                    <div className=&quot;bg-muted p-4 rounded-md max-w-md mx-auto&quot;>
                      <div className=&quot;grid grid-cols-2 gap-4&quot;>
                        <div className=&quot;text-left&quot;>
                          <div className=&quot;text-sm text-muted-foreground&quot;>Data Type</div>
                          <div className=&quot;font-medium&quot;>{dataType === &apos;loyalty&apos; ? &apos;Customer Loyalty&apos; : &apos;Inventory&apos;}</div>
                        </div>
                        <div className=&quot;text-left&quot;>
                          <div className=&quot;text-sm text-muted-foreground&quot;>Store</div>
                          <div className=&quot;font-medium&quot;>
                            {stores?.find(store => store.id === parseInt(selectedStore))?.name || `Store #${selectedStore}`}
                          </div>
                        </div>
                        <div className=&quot;text-left&quot;>
                          <div className=&quot;text-sm text-muted-foreground&quot;>Total Rows</div>
                          <div className=&quot;font-medium&quot;>{importResult.totalRows}</div>
                        </div>
                        <div className=&quot;text-left&quot;>
                          <div className=&quot;text-sm text-muted-foreground&quot;>Imported Rows</div>
                          <div className=&quot;font-medium&quot;>{importResult.importedRows}</div>
                        </div>
                        {importResult.lastUpdated && (
                        <div className=&quot;text-left col-span-2&quot;>
                          <div className=&quot;text-sm text-muted-foreground&quot;>Last Updated</div>
                          <div className=&quot;font-medium&quot;>
                            {new Date(importResult.lastUpdated).toLocaleString()}
                          </div>
                        </div>
                        )}
                      </div>
                    </div>

                    {importResult.errors && importResult.errors.length > 0 && (
                      <Alert className=&quot;bg-amber-50 border-amber-200&quot;>
                        <AlertTriangle className=&quot;h-4 w-4 text-amber-600&quot; />
                        <AlertTitle className=&quot;text-amber-800&quot;>Some Rows Were Not Imported</AlertTitle>
                        <AlertDescription className=&quot;text-amber-700&quot;>
                          {importResult.errors.length} rows could not be imported due to errors.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>

              <CardFooter className=&quot;flex justify-between&quot;>
                {currentStep !== &apos;upload&apos; && (
                  <Button
                    variant=&quot;outline&quot;
                    onClick={() => {
                      if (currentStep === &apos;mapping&apos;) setCurrentStep(&apos;upload&apos;);
                      if (currentStep === &apos;validation&apos;) setCurrentStep(&apos;mapping&apos;);
                      if (currentStep === &apos;import&apos;) setCurrentStep(&apos;validation&apos;);
                      if (currentStep === &apos;complete&apos;) handleReset();
                    }}
                  >
                    {currentStep === &apos;complete&apos; ? &apos;Start New Import&apos; : &apos;Back&apos;}
                  </Button>
                )}

                {currentStep === &apos;upload&apos; && (
                  <Button
                    disabled={!file || isLoading}
                    onClick={handleFileUpload}
                    className=&quot;ml-auto&quot;
                  >
                    {isLoading && <Loader2 className=&quot;mr-2 h-4 w-4 animate-spin&quot; />}
                    Analyze File
                  </Button>
                )}

                {currentStep === &apos;mapping&apos; && (
                  <Button
                    disabled={isValidating || getMappingCompletionPercentage() < 100}
                    onClick={handleValidateData}
                  >
                    {isValidating && <Loader2 className=&quot;mr-2 h-4 w-4 animate-spin&quot; />}
                    Validate Data
                  </Button>
                )}

                {currentStep === &apos;validation&apos; && (
                  <Button
                    disabled={!validationResult || validationResult.importedRows === 0}
                    onClick={() => setCurrentStep(&apos;import&apos;)}
                  >
                    Continue to Import
                  </Button>
                )}

                {currentStep === &apos;import&apos; && (
                  <Button
                    disabled={!selectedStore || isImporting}
                    onClick={handleImportData}
                  >
                    {isImporting && <Loader2 className=&quot;mr-2 h-4 w-4 animate-spin&quot; />}
                    Import Data
                  </Button>
                )}

                {currentStep === &apos;complete&apos; && (
                  <div className=&quot;flex gap-2&quot;>
                    <Button
                      variant=&quot;outline&quot;
                      onClick={() => {
                        if (dataType === &apos;loyalty&apos;) {
                          window.location.href = &apos;/loyalty&apos;;
                        } else {
                          window.location.href = &apos;/inventory&apos;;
                        }
                      }}
                    >
                      {dataType === &apos;loyalty&apos; ? &apos;View Loyalty Members&apos; : &apos;View Inventory&apos;}
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
