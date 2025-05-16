import React, { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/providers/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, ArrowLeft } from 'lucide-react';

// Form schema for adding a new product
const productFormSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters"),
  description: z.string().optional(),
  barcode: z.string().min(5, "Barcode must be at least 5 characters"),
  price: z.string().min(1, "Price is required"),
  cost: z.string().optional(),
  categoryId: z.string().min(1, "Category is required"),
  isPerishable: z.boolean().default(false),
  storeId: z.string().min(1, "Store is required"),
  quantity: z.coerce.number().min(0, "Initial quantity cannot be negative"),
  minimumLevel: z.coerce.number().min(0, "Minimum level cannot be negative").default(5)
});

type ProductFormValues = z.infer<typeof productFormSchema>;

export default function AddProductPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  // Redirect if not manager or admin
  const isManagerOrAdmin = user?.role === 'admin' || user?.role === 'manager';
  
  if (!isManagerOrAdmin) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="text-center p-8 bg-destructive/10 rounded-lg max-w-md">
          <h1 className="text-xl font-semibold mb-4">Access Denied</h1>
          <p>You don't have permission to access this page.</p>
          <p className="mt-2 text-sm">Only managers and administrators can add products.</p>
        </div>
      </div>
    );
  }

  // Fetch categories
  const { data: categories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['/api/products/categories'],
  });

  // Fetch stores
  const { data: stores, isLoading: isLoadingStores } = useQuery({
    queryKey: ['/api/stores'],
  });

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      description: "",
      barcode: "",
      price: "",
      cost: "",
      categoryId: "",
      isPerishable: false,
      storeId: "",
      quantity: 0,
      minimumLevel: 5
    }
  });

  const createProductMutation = useMutation({
    mutationFn: async (productData: ProductFormValues) => {
      // First create the product
      const productResponse = await apiRequest("POST", "/api/products", {
        name: productData.name,
        description: productData.description || "",
        barcode: productData.barcode,
        price: productData.price,
        cost: productData.cost || "0",
        categoryId: parseInt(productData.categoryId),
        isPerishable: productData.isPerishable
      });
      
      if (!productResponse.ok) {
        const error = await productResponse.json();
        throw new Error(error.message || "Failed to create product");
      }
      
      const newProduct = await productResponse.json();
      
      // Then create inventory entry for this product at the selected store
      const inventoryResponse = await apiRequest("POST", "/api/inventory", {
        productId: newProduct.id,
        storeId: parseInt(productData.storeId),
        quantity: productData.quantity,
        minimumLevel: productData.minimumLevel
      });
      
      if (!inventoryResponse.ok) {
        const error = await inventoryResponse.json();
        throw new Error(error.message || "Failed to create inventory record");
      }
      
      return newProduct;
    },
    onSuccess: () => {
      toast({
        title: "Product created successfully",
        description: "The new product has been added to your inventory.",
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      
      // Reset form
      form.reset();
      
      // Navigate to inventory page
      setLocation('/inventory');
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create product",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  function onSubmit(data: ProductFormValues) {
    createProductMutation.mutate(data);
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">Add New Product</h1>
          <p className="text-neutral-500 mt-1">Create a new product in your inventory</p>
        </div>
        <Button variant="outline" onClick={() => setLocation('/inventory')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Product name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Premium Rice" {...field} />
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
                  name="barcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Barcode</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 5901234123457" {...field} />
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
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingCategories ? (
                            <SelectItem value="loading" disabled>
                              Loading categories...
                            </SelectItem>
                          ) : (
                            categories?.map((category: any) => (
                              <SelectItem key={category.id} value={category.id.toString()}>
                                {category.name}
                              </SelectItem>
                            ))
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
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Selling Price</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
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
                  name="cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost Price (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
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
                  name="isPerishable"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
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
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter a detailed product description..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-4 pb-2 border-t">
                <h3 className="text-lg font-medium mb-4">Inventory Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Store */}
                  <FormField
                    control={form.control}
                    name="storeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Store Location</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a store" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {isLoadingStores ? (
                              <SelectItem value="loading" disabled>
                                Loading stores...
                              </SelectItem>
                            ) : (
                              stores?.map((store: any) => (
                                <SelectItem key={store.id} value={store.id.toString()}>
                                  {store.name}
                                </SelectItem>
                              ))
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
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Initial Quantity</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="1"
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
                    name="minimumLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Stock Level</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="1"
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

              <div className="flex justify-end mt-6">
                <Button type="submit" disabled={createProductMutation.isPending}>
                  {createProductMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Product"
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