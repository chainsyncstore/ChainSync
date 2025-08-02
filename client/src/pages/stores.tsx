import { useState } from &apos;react&apos;;
import { AppShell } from &apos;@/components/layout/app-shell&apos;;
import { useQuery, useMutation, useQueryClient } from &apos;@tanstack/react-query&apos;;
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from &apos;@/components/ui/card&apos;;
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from &apos;@/components/ui/table&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Skeleton } from &apos;@/components/ui/skeleton&apos;;
import { Badge } from &apos;@/components/ui/badge&apos;;
import { PlusIcon, Store, RefreshCw, MapPin, Phone, Users, Loader2 } from &apos;lucide-react&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from &apos;@/components/ui/dialog&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { useToast } from &apos;@/hooks/use-toast&apos;;
import { zodResolver } from &apos;@hookform/resolvers/zod&apos;;
import { useForm } from &apos;react-hook-form&apos;;
import * as z from &apos;zod&apos;;
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from &apos;@/components/ui/form&apos;;
import { Switch } from &apos;@/components/ui/switch&apos;;
import { apiRequest } from &apos;@/lib/queryClient&apos;;

// Form schema for adding a new store
const storeFormSchema = z.object({
  _name: z.string().min(2, &apos;Store name must be at least 2 characters&apos;),
  _address: z.string().min(5, &apos;Please enter a valid address&apos;),
  _city: z.string().min(2, &apos;City name is required&apos;),
  _state: z.string().min(2, &apos;State name is required&apos;),
  _zipCode: z.string().min(5, &apos;ZIP code must be at least 5 characters&apos;),
  _phone: z.string().min(10, &apos;Phone number must be at least 10 digits&apos;),
  _isActive: z.boolean().default(true)
});

type StoreFormValues = z.infer<typeof storeFormSchema>;

interface AddStoreFormProps {
  _onSuccess: () => void;
}

function AddStoreForm({ onSuccess }: AddStoreFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setIsOpen] = useState(true); // isOpen was unused

  const form = useForm<StoreFormValues>({
    _resolver: zodResolver(storeFormSchema),
    _defaultValues: {
      name: &apos;&apos;,
      _address: &apos;&apos;,
      _city: &apos;&apos;,
      _state: &apos;&apos;,
      _zipCode: &apos;&apos;,
      _phone: &apos;&apos;,
      _isActive: true
    }
  });

  const createStoreMutation = useMutation({
    _mutationFn: async(_storeData: StoreFormValues) => {
      const response = await apiRequest(&apos;POST&apos;, &apos;/api/stores&apos;, storeData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || &apos;Failed to create store&apos;);
      }
      return response.json();
    },
    _onSuccess: () => {
      toast({
        _title: &apos;Store created successfully&apos;,
        _description: &apos;The new store location has been added to your retail chain.&apos;,
        _variant: &apos;default&apos;
      });
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/stores&apos;] });
      form.reset();
      onSuccess();
      setIsOpen(false);
    },
    _onError: (_error: Error) => {
      toast({
        _title: &apos;Failed to create store&apos;,
        _description: error.message,
        _variant: &apos;destructive&apos;
      });
    }
  });

  function onSubmit(_data: StoreFormValues) {
    createStoreMutation.mutate(data);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className=&quot;space-y-4 mt-4&quot;>
        <FormField
          control={form.control}
          name=&quot;name&quot;
          render={({ field }) => (
            <FormItem>
              <FormLabel>Store Name</FormLabel>
              <FormControl>
                <Input placeholder=&quot;Main Street Store&quot; {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name=&quot;address&quot;
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Input placeholder=&quot;123 Main St&quot; {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className=&quot;grid grid-cols-2 gap-4&quot;>
          <FormField
            control={form.control}
            name=&quot;city&quot;
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input placeholder=&quot;New York&quot; {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name=&quot;state&quot;
            render={({ field }) => (
              <FormItem>
                <FormLabel>State</FormLabel>
                <FormControl>
                  <Input placeholder=&quot;NY&quot; {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className=&quot;grid grid-cols-2 gap-4&quot;>
          <FormField
            control={form.control}
            name=&quot;zipCode&quot;
            render={({ field }) => (
              <FormItem>
                <FormLabel>ZIP Code</FormLabel>
                <FormControl>
                  <Input placeholder=&quot;10001&quot; {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name=&quot;phone&quot;
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input placeholder=&quot;555-123-4567&quot; {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name=&quot;isActive&quot;
          render={({ field }) => (
            <FormItem className=&quot;flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm&quot;>
              <div className=&quot;space-y-0.5&quot;>
                <FormLabel>Active Status</FormLabel>
                <p className=&quot;text-sm text-muted-foreground&quot;>
                  Enable this store to appear in reports and allow operations
                </p>
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

        <div className=&quot;flex justify-between pt-4&quot;>
          <Button
            type=&quot;button&quot;
            variant=&quot;outline&quot;
            onClick={() => setIsOpen(false)}
          >
            Cancel
          </Button>
          <Button type=&quot;submit&quot; disabled={createStoreMutation.isPending}>
            {createStoreMutation.isPending ? (
              <>
                <Loader2 className=&quot;mr-2 h-4 w-4 animate-spin&quot; />
                Creating...
              </>
            ) : (
              &apos;Create Store&apos;
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function StoresPage() {
  const { user } = useAuth();
  const { _data: stores, isLoading, refetch } = useQuery({ _queryKey: [&apos;/api/stores&apos;] });

  return (
    <AppShell>
      <div className=&quot;mb-6 flex items-center justify-between&quot;>
        <div>
          <h1 className=&quot;text-2xl font-bold text-neutral-800&quot;>Stores</h1>
          <p className=&quot;text-neutral-500 mt-1&quot;>Manage your retail store locations</p>
        </div>
        <div className=&quot;flex space-x-2&quot;>
          <Button variant=&quot;outline&quot; size=&quot;icon&quot; onClick={() => refetch()}>
            <RefreshCw className=&quot;h-4 w-4&quot; />
          </Button>

          {user?.role === &apos;admin&apos; && (
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <PlusIcon className=&quot;w-4 h-4 mr-2&quot; />
                  Add New Store
                </Button>
              </DialogTrigger>
              <DialogContent className=&quot;_sm:max-w-[500px] max-h-[90vh] overflow-y-auto&quot;>
                <DialogHeader>
                  <DialogTitle>Add New Store</DialogTitle>
                  <DialogDescription>
                    Create a new store location in your retail chain.
                  </DialogDescription>
                </DialogHeader>
                <AddStoreForm onSuccess={() => {
                  refetch();
                }} />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className=&quot;grid grid-cols-1 _md:grid-cols-2 _lg:grid-cols-3 gap-6&quot;>
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader className=&quot;pb-2&quot;>
                <Skeleton className=&quot;h-6 w-32 mb-1&quot; />
                <Skeleton className=&quot;h-4 w-24&quot; />
              </CardHeader>
              <CardContent>
                <div className=&quot;space-y-3&quot;>
                  <Skeleton className=&quot;h-4 w-full&quot; />
                  <Skeleton className=&quot;h-4 w-2/3&quot; />
                  <Skeleton className=&quot;h-4 w-1/2&quot; />
                </div>
                <div className=&quot;mt-4&quot;>
                  <Skeleton className=&quot;h-9 w-full&quot; />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className=&quot;grid grid-cols-1 _md:grid-cols-2 _lg:grid-cols-3 gap-6&quot;>
          {Array.isArray(stores) ? stores.map((_store: any) => (
            <Card key={store.id}>
              <CardHeader className=&quot;pb-2&quot;>
                <div className=&quot;flex justify-between items-start&quot;>
                  <div>
                    <CardTitle>{store.name}</CardTitle>
                    <CardDescription>ID: {store.id}</CardDescription>
                  </div>
                  <Badge variant={store.isActive ? &apos;outline&apos; : &apos;destructive&apos;} className={store.isActive ? &apos;bg-green-100 text-green-700 border-green-200&apos; : &apos;&apos;}>
                    {store.isActive ? &apos;Active&apos; : &apos;Inactive&apos;}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className=&quot;space-y-2 mb-4&quot;>
                  <div className=&quot;flex items-center text-sm&quot;>
                    <MapPin className=&quot;h-4 w-4 mr-2 text-muted-foreground&quot; />
                    <span className=&quot;break-words&quot;>{store.address}, {store.city}, {store.state} {store.zipCode}</span>
                  </div>
                  <div className=&quot;flex items-center text-sm&quot;>
                    <Phone className=&quot;h-4 w-4 mr-2 text-muted-foreground&quot; />
                    <span>{store.phone}</span>
                  </div>
                  <div className=&quot;flex items-center text-sm&quot;>
                    <Users className=&quot;h-4 w-4 mr-2 text-muted-foreground&quot; />
                    <span>5 Employees</span>
                  </div>
                </div>
                <Button variant=&quot;outline&quot; className=&quot;w-full&quot; asChild>
                  <a href={`/stores/${store.id}`}>
                    <Store className=&quot;h-4 w-4 mr-2&quot; />
                    View Store Details
                  </a>
                </Button>
              </CardContent>
            </Card>
          )) : (
            <div className=&quot;text-center py-8 text-muted-foreground&quot;>
              No stores found. Add a store to get started.
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
