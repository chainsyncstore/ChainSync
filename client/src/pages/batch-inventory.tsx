import { useState } from &apos;react&apos;;
import { useQuery, useMutation } from &apos;@tanstack/react-query&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from &apos;@/components/ui/card&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { Label } from &apos;@/components/ui/label&apos;;
import { Tabs, TabsContent, TabsList, TabsTrigger } from &apos;@/components/ui/tabs&apos;;
import { Alert, AlertDescription, AlertTitle } from &apos;@/components/ui/alert&apos;;
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from &apos;@/components/ui/table&apos;;
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from &apos;@/components/ui/select&apos;;
import { Loader2, Info, Package, Truck, BarChart4 } from &apos;lucide-react&apos;;
import { queryClient, apiRequest } from &apos;@/lib/queryClient&apos;;
import { format } from &apos;date-fns&apos;;
import { useToast } from &apos;@/hooks/use-toast&apos;;
import { BatchDetails } from &apos;@/components/inventory/batch-details&apos;;
import { BatchImportResult } from &apos;@/components/inventory/batch-import-result&apos;;

// Helper to format dates
const formatDate = (_dateString: string | null | undefined) => {
  if (!dateString) return &apos;N/A&apos;;
  try {
    return format(new Date(dateString), &apos;MMM dd, yyyy&apos;);
  } catch (e) {
    return &apos;Invalid date&apos;;
  }
};

// Helper to determine expiry status (Unused)
// const getExpiryStatus = (_expiryDate: string | null | undefined) => {
//   if (!expiryDate) return { _status: &apos;no-expiry&apos;, _label: &apos;No Expiry Date&apos; };

//   const today = new Date();
//   const expiry = new Date(expiryDate);
//   const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

//   if (diffDays < 0) {
//     return { _status: &apos;expired&apos;, _label: &apos;Expired&apos; };
//   } else if (diffDays <= 30) {
//     return { _status: &apos;expiring-soon&apos;, _label: `Expires in ${diffDays} days` };
//   } else {
//     return { status: &apos;valid&apos;, _label: formatDate(expiryDate) };
//   }
// };

interface ImportError {
  _row: number;
  _field: string;
  _message: string;
}

interface BatchImportResponse {
  _message: string;
  _success: boolean;
  processedRows?: number;
  successfulRows?: number;
  failedRows?: number;
  errors?: ImportError[];
  warnings?: ImportError[];
}

interface Batch {
  _id: number;
  _batchNumber: string;
  _quantity: number;
  _expiryDate: string | null;
  _receivedDate: string;
  _manufacturingDate: string | null;
  _costPerUnit: string | null;
}

interface Product {
  _id: number;
  _name: string;
  _sku: string;
  _barcode: string | null;
  _price: string;
}

interface Store {
  _id: number;
  _name: string;
}

export default function BatchInventoryPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(&apos;upload&apos;);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [selectedStore, setSelectedStore] = useState<string>(&apos;&apos;);
  const [selectedProduct, setSelectedProduct] = useState<string>(&apos;&apos;);
  const [productFilter, setProductFilter] = useState(&apos;&apos;);
  const [batchData, setBatchData] = useState({
    _batchNumber: &apos;&apos;,
    _quantity: 0,
    _expiryDate: &apos;&apos;,
    _manufacturingDate: &apos;&apos;,
    _costPerUnit: &apos;&apos;
  });

  // Fetch stores
  const { _data: stores = [] } = useQuery<Store[]>({
    queryKey: [&apos;/api/stores&apos;]
  });

  // Fetch products
  const { _data: products = [], _isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: [&apos;/api/products&apos;]
  });

  // Fetch batches for a product
  const { _data: batches = [], _isLoading: batchesLoading, _refetch: refetchBatches } = useQuery<Batch[]>({
    queryKey: [&apos;/api/inventory/batches&apos;, selectedStore, selectedProduct],
    _enabled: !!(selectedStore && selectedProduct)
  });

  // Import batches mutation
  const importMutation = useMutation({
    _mutationFn: async(_formData: FormData) => {
      const response = await fetch(&apos;/api/inventory/batches/import&apos;, {
        _method: &apos;POST&apos;,
        _body: formData
      });
      return await response.json() as BatchImportResponse;
    },
    _onSuccess: (data) => {
      if (data.success) {
        toast({
          _title: &apos;Import Successful&apos;,
          _description: data.message
        });
        queryClient.invalidateQueries({ _queryKey: [&apos;/api/inventory/batches&apos;] });
      } else {
        toast({
          _title: &apos;Import Failed&apos;,
          _description: data.message || &apos;Failed to import batch data&apos;,
          _variant: &apos;destructive&apos;
        });
      }
    },
    _onError: (_error: Error) => {
      toast({
        _title: &apos;Import Error&apos;,
        _description: error.message,
        _variant: &apos;destructive&apos;
      });
    }
  });

  // Add batch mutation
  const addBatchMutation = useMutation({
    _mutationFn: async(_data: any) => {
      const response = await apiRequest(&apos;POST&apos;, &apos;/api/inventory/batches&apos;, data);
      return await response.json();
    },
    _onSuccess: () => {
      toast({
        _title: &apos;Batch Added&apos;,
        _description: &apos;New batch added successfully&apos;
      });
      setBatchData({
        _batchNumber: &apos;&apos;,
        _quantity: 0,
        _expiryDate: &apos;&apos;,
        _manufacturingDate: &apos;&apos;,
        _costPerUnit: &apos;&apos;
      });
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/inventory/batches&apos;] });
      refetchBatches();
    },
    _onError: (_error: Error) => {
      toast({
        _title: &apos;Error Adding Batch&apos;,
        _description: error.message,
        _variant: &apos;destructive&apos;
      });
    }
  });

  const handleCsvChange = (_e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCsvFile(e.target.files[0]);
    }
  };

  const handleImport = (_e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) {
      toast({
        _title: &apos;No File Selected&apos;,
        _description: &apos;Please select a CSV file to import&apos;,
        _variant: &apos;destructive&apos;
      });
      return;
    }

    const formData = new FormData();
    formData.append(&apos;file&apos;, csvFile);
    importMutation.mutate(formData);
  };

  const handleAddBatch = (_e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore || !selectedProduct) {
      toast({
        _title: &apos;Selection Required&apos;,
        _description: &apos;Please select a store and product&apos;,
        _variant: &apos;destructive&apos;
      });
      return;
    }

    if (!batchData.batchNumber || batchData.quantity <= 0) {
      toast({
        _title: &apos;Missing Required Fields&apos;,
        _description: &apos;Batch number and a positive quantity are required&apos;,
        _variant: &apos;destructive&apos;
      });
      return;
    }

    addBatchMutation.mutate({
      _storeId: parseInt(selectedStore),
      _productId: parseInt(selectedProduct),
      _batchNumber: batchData.batchNumber,
      _quantity: batchData.quantity,
      _expiryDate: batchData.expiryDate || null,
      _manufacturingDate: batchData.manufacturingDate || null,
      _costPerUnit: batchData.costPerUnit || null
    });
  };

  const filteredProducts = productFilter
    ? products.filter(p =>
        p.name.toLowerCase().includes(productFilter.toLowerCase()) ||
        p.sku.toLowerCase().includes(productFilter.toLowerCase()) ||
        (p.barcode && p.barcode.toLowerCase().includes(productFilter.toLowerCase()))
      )
    : products;

  return (
    <div className=&quot;container mx-auto py-8&quot;>
      <h1 className=&quot;text-3xl font-bold mb-6&quot;>Batch Inventory Management</h1>
      <p className=&quot;text-gray-500 mb-8&quot;>
        Track and manage batches of products with different expiry dates for optimal inventory control
      </p>

      <Tabs value={activeTab} onValueChange={setActiveTab} className=&quot;w-full&quot;>
        <TabsList className=&quot;grid grid-cols-3 mb-8&quot;>
          <TabsTrigger value=&quot;upload&quot;>
            <Truck className=&quot;mr-2 h-4 w-4&quot; />
            Import Batches
          </TabsTrigger>
          <TabsTrigger value=&quot;add&quot;>
            <Package className=&quot;mr-2 h-4 w-4&quot; />
            Add Single Batch
          </TabsTrigger>
          <TabsTrigger value=&quot;view&quot;>
            <BarChart4 className=&quot;mr-2 h-4 w-4&quot; />
            View Batches
          </TabsTrigger>
        </TabsList>

        <TabsContent value=&quot;upload&quot;>
          <Card>
            <CardHeader>
              <CardTitle>Import Batch Inventory</CardTitle>
              <CardDescription>
                Upload a CSV file containing batch inventory data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleImport}>
                <div className=&quot;grid w-full items-center gap-6&quot;>
                  <div className=&quot;flex flex-col space-y-2&quot;>
                    <Label htmlFor=&quot;csvFile&quot;>CSV File</Label>
                    <Input
                      id=&quot;csvFile&quot;
                      type=&quot;file&quot;
                      accept=&quot;.csv&quot;
                      onChange={handleCsvChange}
                    />
                    <p className=&quot;text-sm text-gray-500&quot;>
                      Please ensure your CSV file follows the required _format:
                    </p>
                    <Alert>
                      <Info className=&quot;h-4 w-4&quot; />
                      <AlertTitle>CSV Format</AlertTitle>
                      <AlertDescription>
                        <code>product_name,sku,category,batch_id,quantity,expiry_date,unit_price,store_id</code>
                      </AlertDescription>
                    </Alert>
                  </div>
                </div>
                <div className=&quot;mt-6&quot;>
                  <Button type=&quot;submit&quot; disabled={importMutation.isPending || !csvFile}>
                    {importMutation.isPending ? (
                      <>
                        <Loader2 className=&quot;mr-2 h-4 w-4 animate-spin&quot; />
                        Importing...
                      </>
                    ) : (
                      &apos;Import Batches&apos;
                    )}
                  </Button>
                </div>
              </form>

              {importMutation.isSuccess && importMutation.data && (
                <div className=&quot;mt-6&quot;>
                  <BatchImportResult result={importMutation.data} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value=&quot;add&quot;>
          <Card>
            <CardHeader>
              <CardTitle>Add Single Batch</CardTitle>
              <CardDescription>
                Manually add a batch for a specific product
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddBatch}>
                <div className=&quot;grid grid-cols-1 _md:grid-cols-2 gap-6&quot;>
                  <div className=&quot;flex flex-col space-y-2&quot;>
                    <Label htmlFor=&quot;store&quot;>Store</Label>
                    <Select value={selectedStore} onValueChange={setSelectedStore}>
                      <SelectTrigger id=&quot;store&quot;>
                        <SelectValue placeholder=&quot;Select store&quot; />
                      </SelectTrigger>
                      <SelectContent>
                        {stores.map((store) => (
                          <SelectItem key={store.id} value={store.id.toString()}>
                            {store.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className=&quot;flex flex-col space-y-2&quot;>
                    <Label htmlFor=&quot;productFilter&quot;>Search Products</Label>
                    <Input
                      id=&quot;productFilter&quot;
                      value={productFilter}
                      onChange={(e) => setProductFilter(e.target.value)}
                      placeholder=&quot;Search by name, SKU or barcode&quot;
                    />
                  </div>

                  <div className=&quot;flex flex-col space-y-2 _md:col-span-2&quot;>
                    <Label htmlFor=&quot;product&quot;>Product</Label>
                    <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                      <SelectTrigger id=&quot;product&quot;>
                        <SelectValue placeholder={productsLoading ? &apos;Loading products...&apos; : &apos;Select product&apos;} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredProducts.map((product) => (
                          <SelectItem key={product.id} value={product.id.toString()}>
                            {product.name} - {product.sku}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className=&quot;flex flex-col space-y-2&quot;>
                    <Label htmlFor=&quot;batchNumber&quot;>Batch Number</Label>
                    <Input
                      id=&quot;batchNumber&quot;
                      value={batchData.batchNumber}
                      onChange={(e) => setBatchData({ ...batchData, _batchNumber: e.target.value })}
                      placeholder=&quot;e.g., BATCH001&quot;
                    />
                  </div>

                  <div className=&quot;flex flex-col space-y-2&quot;>
                    <Label htmlFor=&quot;quantity&quot;>Quantity</Label>
                    <Input
                      id=&quot;quantity&quot;
                      type=&quot;number&quot;
                      min=&quot;1&quot;
                      value={batchData.quantity}
                      onChange={(e) => setBatchData({ ...batchData, _quantity: parseInt(e.target.value) })}
                    />
                  </div>

                  <div className=&quot;flex flex-col space-y-2&quot;>
                    <Label htmlFor=&quot;expiryDate&quot;>Expiry Date</Label>
                    <Input
                      id=&quot;expiryDate&quot;
                      type=&quot;date&quot;
                      value={batchData.expiryDate}
                      onChange={(e) => setBatchData({ ...batchData, _expiryDate: e.target.value })}
                    />
                  </div>

                  <div className=&quot;flex flex-col space-y-2&quot;>
                    <Label htmlFor=&quot;manufacturingDate&quot;>Manufacturing Date</Label>
                    <Input
                      id=&quot;manufacturingDate&quot;
                      type=&quot;date&quot;
                      value={batchData.manufacturingDate}
                      onChange={(e) => setBatchData({ ...batchData, _manufacturingDate: e.target.value })}
                    />
                  </div>

                  <div className=&quot;flex flex-col space-y-2&quot;>
                    <Label htmlFor=&quot;costPerUnit&quot;>Cost Per Unit</Label>
                    <Input
                      id=&quot;costPerUnit&quot;
                      type=&quot;number&quot;
                      step=&quot;0.01&quot;
                      value={batchData.costPerUnit}
                      onChange={(e) => setBatchData({ ...batchData, _costPerUnit: e.target.value })}
                      placeholder=&quot;0.00&quot;
                    />
                  </div>
                </div>

                <div className=&quot;mt-6&quot;>
                  <Button
                    type=&quot;submit&quot;
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
                        <Loader2 className=&quot;mr-2 h-4 w-4 animate-spin&quot; />
                        Adding...
                      </>
                    ) : (
                      &apos;Add Batch&apos;
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value=&quot;view&quot;>
          <Card>
            <CardHeader>
              <CardTitle>View Batches</CardTitle>
              <CardDescription>
                View and manage existing batch inventory
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className=&quot;grid grid-cols-1 _md:grid-cols-2 gap-6 mb-6&quot;>
                <div className=&quot;flex flex-col space-y-2&quot;>
                  <Label htmlFor=&quot;viewStore&quot;>Store</Label>
                  <Select value={selectedStore} onValueChange={setSelectedStore}>
                    <SelectTrigger id=&quot;viewStore&quot;>
                      <SelectValue placeholder=&quot;Select store&quot; />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id.toString()}>
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className=&quot;flex flex-col space-y-2&quot;>
                  <Label htmlFor=&quot;viewProduct&quot;>Product</Label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger id=&quot;viewProduct&quot;>
                      <SelectValue placeholder={productsLoading ? &apos;Loading products...&apos; : &apos;Select product&apos;} />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id.toString()}>
                          {product.name} - {product.sku}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedStore && selectedProduct ? (
                <div className=&quot;mb-4&quot;>
                  <Alert className=&quot;bg-blue-50 border-blue-200&quot;>
                    <Info className=&quot;h-4 w-4 text-blue-500&quot; />
                    <AlertTitle>Batch Management</AlertTitle>
                    <AlertDescription>
                      <ul className=&quot;list-disc list-inside text-sm&quot;>
                        <li>Expired batches are highlighted in red</li>
                        <li>Batches expiring within 30 days are highlighted in amber</li>
                        <li>Click on a batch card to view details, audit logs, or perform actions</li>
                        <li>FIFO (First In, First Out) is automatically applied when selling products</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                </div>
              ) : null}

              {selectedStore && selectedProduct ? (
                batchesLoading ? (
                  <div className=&quot;flex justify-center items-center py-12&quot;>
                    <Loader2 className=&quot;h-8 w-8 animate-spin text-primary&quot; />
                  </div>
                ) : batches.length > 0 ? (
                  <div className=&quot;grid grid-cols-1 _md:grid-cols-2 _xl:grid-cols-3 gap-4&quot;>
                    {batches.map((batch) => {
                      // Find the associated product
                      const product = products.find(p => p.id === parseInt(selectedProduct));
                      if (!product) return null;

                      return (
                        <div key={batch.id} className=&quot;transition-all duration-200 _hover:scale-[1.01]&quot;>
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
                  <div className=&quot;text-center py-8 text-gray-500&quot;>
                    <div className=&quot;bg-muted/20 rounded-lg p-8&quot;>
                      <p className=&quot;text-muted-foreground&quot;>No batches found for this product.</p>
                      <p className=&quot;mt-2&quot;>Use the &apos;Add Single Batch&apos; tab to create a new batch.</p>
                    </div>
                  </div>
                )
              ) : (
                <div className=&quot;text-center py-8 text-gray-500&quot;>
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
