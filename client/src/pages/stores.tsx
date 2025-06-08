import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, Store, RefreshCw, Edit, MapPin, Phone, Users, Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/providers/auth-provider';

// Form schema for adding a new store
const storeFormSchema = z.object({
  name: z.string().min(2, 'Store name must be at least 2 characters'),
  address: z.string().min(5, 'Please enter a valid address'),
  city: z.string().min(2, 'City name is required'),
  state: z.string().min(2, 'State name is required'),
  zipCode: z.string().min(5, 'ZIP code must be at least 5 characters'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  isActive: z.boolean().default(true),
});

type StoreFormValues = z.infer<typeof storeFormSchema>;

interface AddStoreFormProps {
  onSuccess: () => void;
}

function AddStoreForm({ onSuccess }: AddStoreFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(true);

  const form = useForm<StoreFormValues>({
    resolver: zodResolver(storeFormSchema),
    defaultValues: {
      name: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      phone: '',
      isActive: true,
    },
  });

  const createStoreMutation = useMutation({
    mutationFn: async (storeData: StoreFormValues) => {
      const response = await apiRequest('POST', '/api/stores', storeData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create store');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Store created successfully',
        description: 'The new store location has been added to your retail chain.',
        variant: 'default',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/stores'] });
      form.reset();
      onSuccess();
      setIsOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create store',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  function onSubmit(data: StoreFormValues) {
    createStoreMutation.mutate(data);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Store Name</FormLabel>
              <FormControl>
                <Input placeholder="Main Street Store" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Input placeholder="123 Main St" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input placeholder="New York" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>State</FormLabel>
                <FormControl>
                  <Input placeholder="NY" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="zipCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ZIP Code</FormLabel>
                <FormControl>
                  <Input placeholder="10001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input placeholder="555-123-4567" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Active Status</FormLabel>
                <p className="text-sm text-muted-foreground">
                  Enable this store to appear in reports and allow operations
                </p>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-between pt-4">
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={createStoreMutation.isPending}>
            {createStoreMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Store'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function StoresPage() {
  const { user } = useAuth();
  const { data: stores, isLoading, refetch } = useQuery({ queryKey: ['/api/stores'] });

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">Stores</h1>
          <p className="text-neutral-500 mt-1">Manage your retail store locations</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>

          {user?.role === 'admin' && (
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Add New Store
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Store</DialogTitle>
                  <DialogDescription>
                    Create a new store location in your retail chain.
                  </DialogDescription>
                </DialogHeader>
                <AddStoreForm
                  onSuccess={() => {
                    refetch();
                  }}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-32 mb-1" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
                <div className="mt-4">
                  <Skeleton className="h-9 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.isArray(stores) ? (
            stores.map((store: any) => (
              <Card key={store.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{store.name}</CardTitle>
                      <CardDescription>ID: {store.id}</CardDescription>
                    </div>
                    <Badge
                      variant={store.isActive ? 'outline' : 'destructive'}
                      className={
                        store.isActive ? 'bg-green-100 text-green-700 border-green-200' : ''
                      }
                    >
                      {store.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm">
                      <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span className="break-words">
                        {store.address}, {store.city}, {store.state} {store.zipCode}
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>{store.phone}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>5 Employees</span>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full" asChild>
                    <a href={`/stores/${store.id}`}>
                      <Store className="h-4 w-4 mr-2" />
                      View Store Details
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No stores found. Add a store to get started.
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
