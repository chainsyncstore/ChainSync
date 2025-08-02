import { AppShell } from &apos;@/components/layout/app-shell&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import { useQuery, useMutation, useQueryClient } from &apos;@tanstack/react-query&apos;;
import { zodResolver } from &apos;@hookform/resolvers/zod&apos;;
import { useForm } from &apos;react-hook-form&apos;;
import * as z from &apos;zod&apos;;
import { useToast } from &apos;@/hooks/use-toast&apos;;
import { apiRequest } from &apos;@/lib/queryClient&apos;;
import { useLocation } from &apos;wouter&apos;;

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from &apos;@/components/ui/card&apos;;
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from &apos;@/components/ui/form&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Textarea } from &apos;@/components/ui/textarea&apos;;
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from &apos;@/components/ui/select&apos;;
import { Switch } from &apos;@/components/ui/switch&apos;;
import { Loader2, ArrowLeft } from &apos;lucide-react&apos;;

// Form schema for adding a new product
const productFormSchema = z.object({
  _name: z.string().min(2, &apos;Product name must be at least 2 characters&apos;),
  _description: z.string().optional(),
  _barcode: z.string().min(5, &apos;Barcode must be at least 5 characters&apos;),
  _price: z.string().min(1, &apos;Price is required&apos;),
  _cost: z.string().optional(),
  _categoryId: z.string().min(1, &apos;Category is required&apos;),
  _isPerishable: z.boolean().default(false),
  _storeId: z.string().min(1, &apos;Store is required&apos;),
  _quantity: z.coerce.number().min(0, &apos;Initial quantity cannot be negative&apos;),
  _minimumLevel: z.coerce.number().min(0, &apos;Minimum level cannot be negative&apos;).default(5)
});

type ProductFormValues = z.infer<typeof productFormSchema>;

export default function AddProductPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Redirect if not manager or admin
  const isManagerOrAdmin = user?.role === &apos;admin&apos; || user?.role === &apos;manager&apos;;

  if (!isManagerOrAdmin) {
    return (
      <div className=&quot;flex items-center justify-center h-[80vh]&quot;>
        <div className=&quot;text-center p-8 bg-destructive/10 rounded-lg max-w-md&quot;>
          <h1 className=&quot;text-xl font-semibold mb-4&quot;>Access Denied</h1>
          <p>You don&apos;t have permission to access this page.</p>
          <p className=&quot;mt-2 text-sm&quot;>Only managers and administrators can add products.</p>
        </div>
      </div>
    );
  }

  // Fetch categories
  const { _data: categories, _isLoading: isLoadingCategories } = useQuery({
    queryKey: [&apos;/api/products/categories&apos;]
  });

  // Fetch stores
  const { _data: stores, _isLoading: isLoadingStores } = useQuery({
    queryKey: [&apos;/api/stores&apos;]
  });

  const form = useForm<ProductFormValues>({
    _resolver: zodResolver(productFormSchema),
    _defaultValues: {
      name: &apos;&apos;,
      _description: &apos;&apos;,
      _barcode: &apos;&apos;,
      _price: &apos;&apos;,
      _cost: &apos;&apos;,
      _categoryId: &apos;&apos;,
      _isPerishable: false,
      _storeId: &apos;&apos;,
      _quantity: 0,
      _minimumLevel: 5
    }
  });

  const createProductMutation = useMutation({
    _mutationFn: async(_productData: ProductFormValues) => {
      // First create the product
      const productResponse = await apiRequest(&apos;POST&apos;, &apos;/api/products&apos;, {
        _name: productData.name,
        _description: productData.description || &apos;&apos;,
        _barcode: productData.barcode,
        _price: productData.price,
        _cost: productData.cost || &apos;0&apos;,
        _categoryId: parseInt(productData.categoryId),
        _isPerishable: productData.isPerishable
      });

      if (!productResponse.ok) {
        const error = await productResponse.json();
        throw new Error(error.message || &apos;Failed to create product&apos;);
      }

      const newProduct = await productResponse.json();

      // Then create inventory entry for this product at the selected store
      const inventoryResponse = await apiRequest(&apos;POST&apos;, &apos;/api/inventory&apos;, {
        _productId: newProduct.id,
        _storeId: parseInt(productData.storeId),
        _quantity: productData.quantity,
        _minimumLevel: productData.minimumLevel
      });

      if (!inventoryResponse.ok) {
        const error = await inventoryResponse.json();
        throw new Error(error.message || &apos;Failed to create inventory record&apos;);
      }

      return newProduct;
    },
    _onSuccess: () => {
      toast({
        _title: &apos;Product created successfully&apos;,
        _description: &apos;The new product has been added to your inventory.&apos;
      });

      // Invalidate relevant queries
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/products&apos;] });
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/inventory&apos;] });

      // Reset form
      form.reset();

      // Navigate to inventory page
      setLocation(&apos;/inventory&apos;);
    },
    _onError: (_error: Error) => {
      toast({
        _title: &apos;Failed to create product&apos;,
        _description: error.message,
        _variant: &apos;destructive&apos;
      });
    }
  });

  function onSubmit(_data: ProductFormValues) {
    createProductMutation.mutate(data);
  }

  return (
    <AppShell>
      <div className=&quot;mb-6 flex items-center justify-between&quot;>
        <div>
          <h1 className=&quot;text-2xl font-bold text-neutral-800&quot;>Add New Product</h1>
          <p className=&quot;text-neutral-500 mt-1&quot;>Create a new product in your inventory</p>
        </div>
        <Button variant=&quot;outline&quot; onClick={() => setLocation(&apos;/inventory&apos;)}>
          <ArrowLeft className=&quot;mr-2 h-4 w-4&quot; />
          Back to Inventory
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product Information</CardTitle>
          <CardDescription>
            Enter the details of the new product you want to add to your inventory.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className=&quot;space-y-6&quot;>
              <div className=&quot;grid grid-cols-1 _md:grid-cols-2 gap-6&quot;>
                {/* Product name */}
                <FormField
                  control={form.control}
                  name=&quot;name&quot;
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name</FormLabel>
                      <FormControl>
                        <Input placeholder=&quot;e.g. Premium Rice&quot; {...field} />
                      </FormControl>
                      <FormDescription>
                        The full name of the product as it will appear in the system.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Barcode */}
                <FormField
                  control={form.control}
                  name=&quot;barcode&quot;
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Barcode</FormLabel>
                      <FormControl>
                        <Input placeholder=&quot;e.g. 5901234123457&quot; {...field} />
                      </FormControl>
                      <FormDescription>
                        The unique product barcode for scanning at POS.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Category */}
                <FormField
                  control={form.control}
                  name=&quot;categoryId&quot;
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder=&quot;Select a category&quot; />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingCategories ? (
                            <SelectItem value=&quot;loading&quot; disabled>
                              Loading categories...
                            </SelectItem>
                          ) : (
                            categories && Array.isArray(categories) && categories.length > 0 ?
                              categories.map((_category: any) => (
                                <SelectItem key={category.id} value={category.id.toString()}>
                                  {category.name}
                                </SelectItem>
                              ))
                            :
                              <SelectItem value=&quot;none&quot; disabled>
                                Add category in settings
                              </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Select the category this product belongs to.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Price */}
                <FormField
                  control={form.control}
                  name=&quot;price&quot;
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Selling Price</FormLabel>
                      <FormControl>
                        <Input
                          type=&quot;number&quot;
                          step=&quot;0.01&quot;
                          min=&quot;0&quot;
                          placeholder=&quot;0.00&quot;
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The retail price of the product.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Cost */}
                <FormField
                  control={form.control}
                  name=&quot;cost&quot;
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost Price (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type=&quot;number&quot;
                          step=&quot;0.01&quot;
                          min=&quot;0&quot;
                          placeholder=&quot;0.00&quot;
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        How much it costs to purchase or produce this item.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Is Perishable */}
                <FormField
                  control={form.control}
                  name=&quot;isPerishable&quot;
                  render={({ field }) => (
                    <FormItem className=&quot;flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm&quot;>
                      <div className=&quot;space-y-0.5&quot;>
                        <FormLabel>Perishable Item</FormLabel>
                        <FormDescription>
                          Toggle if this product has an expiry date
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Description */}
              <FormField
                control={form.control}
                name=&quot;description&quot;
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder=&quot;Enter a detailed product description...&quot;
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className=&quot;pt-4 pb-2 border-t&quot;>
                <h3 className=&quot;text-lg font-medium mb-4&quot;>Inventory Information</h3>
                <div className=&quot;grid grid-cols-1 _md:grid-cols-2 gap-6&quot;>
                  {/* Store */}
                  <FormField
                    control={form.control}
                    name=&quot;storeId&quot;
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Store Location</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder=&quot;Select a store&quot; />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {isLoadingStores ? (
                              <SelectItem value=&quot;loading&quot; disabled>
                                Loading stores...
                              </SelectItem>
                            ) : (
                              stores && Array.isArray(stores) ? stores.map((_store: any) => (
                                <SelectItem key={store.id} value={store.id.toString()}>
                                  {store.name}
                                </SelectItem>
                              )) : <SelectItem value=&quot;none&quot;>No stores available</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select which store this inventory belongs to.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Initial Quantity */}
                  <FormField
                    control={form.control}
                    name=&quot;quantity&quot;
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Initial Quantity</FormLabel>
                        <FormControl>
                          <Input
                            type=&quot;number&quot;
                            min=&quot;0&quot;
                            step=&quot;1&quot;
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          How many units are currently in stock.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Minimum Level */}
                  <FormField
                    control={form.control}
                    name=&quot;minimumLevel&quot;
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Stock Level</FormLabel>
                        <FormControl>
                          <Input
                            type=&quot;number&quot;
                            min=&quot;0&quot;
                            step=&quot;1&quot;
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          The threshold at which to restock this product.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className=&quot;flex justify-end mt-6&quot;>
                <Button type=&quot;submit&quot; disabled={createProductMutation.isPending}>
                  {createProductMutation.isPending ? (
                    <>
                      <Loader2 className=&quot;mr-2 h-4 w-4 animate-spin&quot; />
                      Creating...
                    </>
                  ) : (
                    &apos;Create Product&apos;
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </AppShell>
  );
}
