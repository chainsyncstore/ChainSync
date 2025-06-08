import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Info,
  AlertCircle,
  CheckCircle,
  Calendar,
  Package,
  Truck,
  BarChart4,
} from 'lucide-react';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { format, isPast, addDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { BatchDetails } from '@/components/inventory/batch-details';
import { BatchImportResult } from '@/components/inventory/batch-import-result';

// Helper to format dates
const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return 'N/A';
  try {
    return format(new Date(dateString), 'MMM dd, yyyy');
  } catch (e) {
    return 'Invalid date';
  }
};

// Helper to determine expiry status
const getExpiryStatus = (expiryDate: string | null | undefined) => {
  if (!expiryDate) return { status: 'no-expiry', label: 'No Expiry Date' };

  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { status: 'expired', label: 'Expired' };
  } else if (diffDays <= 30) {
    return { status: 'expiring-soon', label: `Expires in ${diffDays} days` };
  } else {
    return { status: 'valid', label: formatDate(expiryDate) };
  }
};

interface ImportError {
  row: number;
  field: string;
  message: string;
}

interface BatchImportResponse {
  message: string;
  success: boolean;
  processedRows?: number;
  successfulRows?: number;
  failedRows?: number;
  errors?: ImportError[];
  warnings?: ImportError[];
}

interface Batch {
  id: number;
  batchNumber: string;
  quantity: number;
  expiryDate: string | null;
  receivedDate: string;
  manufacturingDate: string | null;
  costPerUnit: string | null;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  price: string;
}

interface Store {
  id: number;
  name: string;
}

export default function BatchInventoryPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [productFilter, setProductFilter] = useState('');
  const [batchData, setBatchData] = useState({
    batchNumber: '',
    quantity: 0,
    expiryDate: '',
    manufacturingDate: '',
    costPerUnit: '',
  });

  // Fetch stores
  const { data: stores = [] } = useQuery<Store[]>({
    queryKey: ['/api/stores'],
  });

  // Fetch products
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  // Fetch batches for a product
  const {
    data: batches = [],
    isLoading: batchesLoading,
    refetch: refetchBatches,
  } = useQuery<Batch[]>({
    queryKey: ['/api/inventory/batches', selectedStore, selectedProduct],
    enabled: !!(selectedStore && selectedProduct),
  });

  // Import batches mutation
  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/inventory/batches/import', {
        method: 'POST',
        body: formData,
      });
      return (await response.json()) as BatchImportResponse;
    },
    onSuccess: data => {
      if (data.success) {
        toast({
          title: 'Import Successful',
          description: data.message,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/inventory/batches'] });
      } else {
        toast({
          title: 'Import Failed',
          description: data.message || 'Failed to import batch data',
          variant: 'destructive',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Import Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Add batch mutation
  const addBatchMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/inventory/batches', data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Batch Added',
        description: 'New batch added successfully',
      });
      setBatchData({
        batchNumber: '',
        quantity: 0,
        expiryDate: '',
        manufacturingDate: '',
        costPerUnit: '',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/batches'] });
      refetchBatches();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error Adding Batch',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCsvFile(e.target.files[0]);
    }
  };

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) {
      toast({
        title: 'No File Selected',
        description: 'Please select a CSV file to import',
        variant: 'destructive',
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', csvFile);
    importMutation.mutate(formData);
  };

  const handleAddBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore || !selectedProduct) {
      toast({
        title: 'Selection Required',
        description: 'Please select a store and product',
        variant: 'destructive',
      });
      return;
    }

    if (!batchData.batchNumber || batchData.quantity <= 0) {
      toast({
        title: 'Missing Required Fields',
        description: 'Batch number and a positive quantity are required',
        variant: 'destructive',
      });
      return;
    }

    addBatchMutation.mutate({
      storeId: parseInt(selectedStore),
      productId: parseInt(selectedProduct),
      batchNumber: batchData.batchNumber,
      quantity: batchData.quantity,
      expiryDate: batchData.expiryDate || null,
      manufacturingDate: batchData.manufacturingDate || null,
      costPerUnit: batchData.costPerUnit || null,
    });
  };

  const filteredProducts = productFilter
    ? products.filter(
        p =>
          p.name.toLowerCase().includes(productFilter.toLowerCase()) ||
          p.sku.toLowerCase().includes(productFilter.toLowerCase()) ||
          (p.barcode && p.barcode.toLowerCase().includes(productFilter.toLowerCase()))
      )
    : products;

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Batch Inventory Management</h1>
      <p className="text-gray-500 mb-8">
        Track and manage batches of products with different expiry dates for optimal inventory
        control
      </p>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 mb-8">
          <TabsTrigger value="upload">
            <Truck className="mr-2 h-4 w-4" />
            Import Batches
          </TabsTrigger>
          <TabsTrigger value="add">
            <Package className="mr-2 h-4 w-4" />
            Add Single Batch
          </TabsTrigger>
          <TabsTrigger value="view">
            <BarChart4 className="mr-2 h-4 w-4" />
            View Batches
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Import Batch Inventory</CardTitle>
              <CardDescription>Upload a CSV file containing batch inventory data</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleImport}>
                <div className="grid w-full items-center gap-6">
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="csvFile">CSV File</Label>
                    <Input id="csvFile" type="file" accept=".csv" onChange={handleCsvChange} />
                    <p className="text-sm text-gray-500">
                      Please ensure your CSV file follows the required format:
                    </p>
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertTitle>CSV Format</AlertTitle>
                      <AlertDescription>
                        <code>
                          product_name,sku,category,batch_id,quantity,expiry_date,unit_price,store_id
                        </code>
                      </AlertDescription>
                    </Alert>
                  </div>
                </div>
                <div className="mt-6">
                  <Button type="submit" disabled={importMutation.isPending || !csvFile}>
                    {importMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      'Import Batches'
                    )}
                  </Button>
                </div>
              </form>

              {importMutation.isSuccess && importMutation.data && (
                <div className="mt-6">
                  <BatchImportResult result={importMutation.data} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="add">
          <Card>
            <CardHeader>
              <CardTitle>Add Single Batch</CardTitle>
              <CardDescription>Manually add a batch for a specific product</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddBatch}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="store">Store</Label>
                    <Select value={selectedStore} onValueChange={setSelectedStore}>
                      <SelectTrigger id="store">
                        <SelectValue placeholder="Select store" />
                      </SelectTrigger>
                      <SelectContent>
                        {stores.map(store => (
                          <SelectItem key={store.id} value={store.id.toString()}>
                            {store.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="productFilter">Search Products</Label>
                    <Input
                      id="productFilter"
                      value={productFilter}
                      onChange={e => setProductFilter(e.target.value)}
                      placeholder="Search by name, SKU or barcode"
                    />
                  </div>

                  <div className="flex flex-col space-y-2 md:col-span-2">
                    <Label htmlFor="product">Product</Label>
                    <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                      <SelectTrigger id="product">
                        <SelectValue
                          placeholder={productsLoading ? 'Loading products...' : 'Select product'}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredProducts.map(product => (
                          <SelectItem key={product.id} value={product.id.toString()}>
                            {product.name} - {product.sku}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="batchNumber">Batch Number</Label>
                    <Input
                      id="batchNumber"
                      value={batchData.batchNumber}
                      onChange={e => setBatchData({ ...batchData, batchNumber: e.target.value })}
                      placeholder="e.g., BATCH001"
                    />
                  </div>

                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={batchData.quantity}
                      onChange={e =>
                        setBatchData({ ...batchData, quantity: parseInt(e.target.value) })
                      }
                    />
                  </div>

                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="expiryDate">Expiry Date</Label>
                    <Input
                      id="expiryDate"
                      type="date"
                      value={batchData.expiryDate}
                      onChange={e => setBatchData({ ...batchData, expiryDate: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="manufacturingDate">Manufacturing Date</Label>
                    <Input
                      id="manufacturingDate"
                      type="date"
                      value={batchData.manufacturingDate}
                      onChange={e =>
                        setBatchData({ ...batchData, manufacturingDate: e.target.value })
                      }
                    />
                  </div>

                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="costPerUnit">Cost Per Unit</Label>
                    <Input
                      id="costPerUnit"
                      type="number"
                      step="0.01"
                      value={batchData.costPerUnit}
                      onChange={e => setBatchData({ ...batchData, costPerUnit: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <Button
                    type="submit"
                    disabled={
                      addBatchMutation.isPending ||
                      !selectedStore ||
                      !selectedProduct ||
                      !batchData.batchNumber ||
                      batchData.quantity <= 0
                    }
                  >
                    {addBatchMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      'Add Batch'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="view">
          <Card>
            <CardHeader>
              <CardTitle>View Batches</CardTitle>
              <CardDescription>View and manage existing batch inventory</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="viewStore">Store</Label>
                  <Select value={selectedStore} onValueChange={setSelectedStore}>
                    <SelectTrigger id="viewStore">
                      <SelectValue placeholder="Select store" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map(store => (
                        <SelectItem key={store.id} value={store.id.toString()}>
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col space-y-2">
                  <Label htmlFor="viewProduct">Product</Label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger id="viewProduct">
                      <SelectValue
                        placeholder={productsLoading ? 'Loading products...' : 'Select product'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(product => (
                        <SelectItem key={product.id} value={product.id.toString()}>
                          {product.name} - {product.sku}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedStore && selectedProduct ? (
                <div className="mb-4">
                  <Alert className="bg-blue-50 border-blue-200">
                    <Info className="h-4 w-4 text-blue-500" />
                    <AlertTitle>Batch Management</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside text-sm">
                        <li>Expired batches are highlighted in red</li>
                        <li>Batches expiring within 30 days are highlighted in amber</li>
                        <li>
                          Click on a batch card to view details, audit logs, or perform actions
                        </li>
                        <li>
                          FIFO (First In, First Out) is automatically applied when selling products
                        </li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                </div>
              ) : null}

              {selectedStore && selectedProduct ? (
                batchesLoading ? (
                  <div className="flex justify-center items-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : batches.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {batches.map(batch => {
                      // Find the associated product
                      const product = products.find(p => p.id === parseInt(selectedProduct));
                      if (!product) return null;

                      return (
                        <div
                          key={batch.id}
                          className="transition-all duration-200 hover:scale-[1.01]"
                        >
                          <BatchDetails
                            batch={batch}
                            product={product}
                            onBatchUpdated={refetchBatches}
                            isManagerOrAdmin={true} // This should ideally be based on actual user role
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <div className="bg-muted/20 rounded-lg p-8">
                      <p className="text-muted-foreground">No batches found for this product.</p>
                      <p className="mt-2">Use the 'Add Single Batch' tab to create a new batch.</p>
                    </div>
                  </div>
                )
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Please select a store and product to view batches.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
