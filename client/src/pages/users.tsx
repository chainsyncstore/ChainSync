import { useState } from &apos;react&apos;;
import { AppShell } from &apos;@/components/layout/app-shell&apos;;
import { useQuery, useMutation, useQueryClient } from &apos;@tanstack/react-query&apos;;
import { apiRequest } from &apos;@/lib/queryClient&apos;;
import { useToast } from &apos;@/hooks/use-toast&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import { z } from &apos;zod&apos;;
import { useForm } from &apos;react-hook-form&apos;;
import { zodResolver } from &apos;@hookform/resolvers/zod&apos;;

import {
  Card,
  CardContent,
  CardFooter,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from &apos;@/components/ui/dialog&apos;;
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from &apos;@/components/ui/form&apos;;
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from &apos;@/components/ui/select&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Skeleton } from &apos;@/components/ui/skeleton&apos;;
import { Badge } from &apos;@/components/ui/badge&apos;;
import { Search, RefreshCw, PlusIcon, Edit, Trash2 } from &apos;lucide-react&apos;;
import { formatDate } from &apos;@/lib/utils&apos;;

// Form schema for user creation/editing
const userFormSchema = z.object({
  _username: z.string().min(3, &apos;Username must be at least 3 characters&apos;),
  _password: z.string().min(6, &apos;Password must be at least 6 characters&apos;),
  _fullName: z.string().min(2, &apos;Full name must be at least 2 characters&apos;),
  _email: z.string().email(&apos;Please enter a valid email address&apos;),
  _role: z.enum([&apos;admin&apos;, &apos;manager&apos;, &apos;cashier&apos;], {
    _required_error: &apos;Please select a role&apos;
  }),
  _storeId: z.string().optional()
});

type UserFormValues = z.infer<typeof userFormSchema>;

export default function UsersPage() {
  const { toast } = useToast();
  useAuth(); // user variable was unused
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState(&apos;&apos;);
  const [isOpen, setIsOpen] = useState(false);

  // Form for user creation
  const form = useForm<UserFormValues>({
    _resolver: zodResolver(userFormSchema),
    _defaultValues: {
      username: &apos;&apos;,
      _password: &apos;&apos;,
      _fullName: &apos;&apos;,
      _email: &apos;&apos;,
      _role: &apos;cashier&apos;,
      _storeId: &apos;&apos;
    }
  });

  // Fetch users
  const { _data: users, _isLoading: isLoadingUsers, refetch } = useQuery({
    _queryKey: [&apos;/api/users&apos;]
  });

  // Fetch stores for assigning users
  const { _data: stores } = useQuery({ // isLoadingStores was unused
    queryKey: [&apos;/api/stores&apos;]
  });

  // Create user mutation
  const createUserMutation = useMutation({
    _mutationFn: async(_userData: UserFormValues) => {
      // Convert storeId to number if provided
      const payload = {
        ...userData,
        _storeId: userData.storeId ? parseInt(userData.storeId) : undefined
      };

      const response = await apiRequest(&apos;POST&apos;, &apos;/api/users&apos;, payload);
      return response.json();
    },
    _onSuccess: () => {
      toast({
        _title: &apos;User created&apos;,
        _description: &apos;The user has been created successfully.&apos;
      });
      setIsOpen(false);
      form.reset();
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/users&apos;] });
    },
    _onError: (error) => {
      toast({
        _title: &apos;Error creating user&apos;,
        _description: &apos;There was an error creating the user. Please try again.&apos;,
        _variant: &apos;destructive&apos;
      });
      console.error(&apos;Error creating _user:&apos;, error);
    }
  });

  // Handle form submission
  const onSubmit = (_data: UserFormValues) => {
    createUserMutation.mutate(data);
  };

  // Define user and store type interfaces for better TypeScript support
  interface UserType {
    _id: number;
    _username: string;
    _fullName: string;
    _email: string;
    _role: string;
    store?: { _name: string };
    lastLogin?: string;
  }

  interface StoreType {
    _id: number;
    _name: string;
  }

  // Filter users based on search term
  const filteredUsers = users ? (users as UserType[]).filter((user) =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  return (
    <AppShell>
      <div className=&quot;mb-6 flex items-center justify-between&quot;>
        <div>
          <h1 className=&quot;text-2xl font-bold text-neutral-800&quot;>User Management</h1>
          <p className=&quot;text-neutral-500 mt-1&quot;>Manage user accounts and access permissions</p>
        </div>
        <div className=&quot;flex space-x-2&quot;>
          <Button variant=&quot;outline&quot; size=&quot;icon&quot; onClick={() => refetch()}>
            <RefreshCw className=&quot;h-4 w-4&quot; />
          </Button>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusIcon className=&quot;w-4 h-4 mr-2&quot; />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className=&quot;_sm:max-w-[425px] max-h-[90vh] overflow-y-auto&quot;>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Add a new user to the system. Fill in all required fields.
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className=&quot;space-y-4&quot;>
                  <FormField
                    control={form.control}
                    name=&quot;username&quot;
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder=&quot;username&quot; {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name=&quot;password&quot;
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type=&quot;password&quot; placeholder=&quot;******&quot; {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name=&quot;fullName&quot;
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder=&quot;John Doe&quot; {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name=&quot;email&quot;
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder=&quot;user@example.com&quot; {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name=&quot;role&quot;
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder=&quot;Select a role&quot; />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value=&quot;admin&quot;>Admin</SelectItem>
                            <SelectItem value=&quot;manager&quot;>Manager</SelectItem>
                            <SelectItem value=&quot;cashier&quot;>Cashier</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          This determines the user&apos;s permissions in the system.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch(&apos;role&apos;) !== &apos;admin&apos; && (
                    <FormField
                      control={form.control}
                      name=&quot;storeId&quot;
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assigned Store</FormLabel>
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
                              {stores ? (stores as StoreType[]).map((store) => (
                                <SelectItem key={store.id} value={store.id.toString()}>
                                  {store.name}
                                </SelectItem>
                              )) : null}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            {form.watch(&apos;role&apos;) === &apos;manager&apos;
                              ? &apos;Managers are responsible for a specific store.&apos;
                              : &apos;Cashiers must be assigned to a specific store.&apos;}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <DialogFooter className=&quot;flex justify-between&quot;>
                    <Button
                      type=&quot;button&quot;
                      variant=&quot;outline&quot;
                      onClick={() => {
                        setIsOpen(false);
                        form.reset();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type=&quot;submit&quot;
                      disabled={createUserMutation.isPending}
                    >
                      {createUserMutation.isPending ? &apos;Creating...&apos; : &apos;Create User&apos;}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className=&quot;pb-3&quot;>
          <div className=&quot;flex items-center justify-between&quot;>
            <CardTitle>User Accounts</CardTitle>
            <div className=&quot;relative w-64&quot;>
              <Search className=&quot;absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground&quot; />
              <Input
                type=&quot;search&quot;
                placeholder=&quot;Search users...&quot;
                className=&quot;pl-8&quot;
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingUsers ? (
            <div className=&quot;space-y-2&quot;>
              {[...Array(5)].map((_, i) => (
                <div key={i} className=&quot;flex items-center space-x-4&quot;>
                  <Skeleton className=&quot;h-12 w-12 rounded-full&quot; />
                  <div className=&quot;space-y-2&quot;>
                    <Skeleton className=&quot;h-4 w-[250px]&quot; />
                    <Skeleton className=&quot;h-4 w-[200px]&quot; />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Assigned Store</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className=&quot;text-right&quot;>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className=&quot;text-center&quot;>
                      No users found matching your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((_user: UserType) => (
                    <TableRow key={user.id}>
                      <TableCell className=&quot;font-medium&quot;>{user.fullName}</TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === &apos;admin&apos; ? &apos;default&apos; : user.role === &apos;manager&apos; ? &apos;secondary&apos; : &apos;outline&apos;}>
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.store?.name || (user.role === &apos;admin&apos; ? &apos;All Stores&apos; : &apos;Unassigned&apos;)}
                      </TableCell>
                      <TableCell>
                        {user.lastLogin ? formatDate(user.lastLogin) : &apos;Never&apos;}
                      </TableCell>
                      <TableCell className=&quot;text-right&quot;>
                        <Button variant=&quot;ghost&quot; size=&quot;icon&quot; className=&quot;text-muted-foreground _hover:text-foreground&quot;>
                          <Edit className=&quot;h-4 w-4&quot; />
                        </Button>
                        <Button variant=&quot;ghost&quot; size=&quot;icon&quot; className=&quot;text-muted-foreground _hover:text-destructive&quot;>
                          <Trash2 className=&quot;h-4 w-4&quot; />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter className=&quot;flex justify-between items-center border-t p-4&quot;>
          <div className=&quot;text-sm text-muted-foreground&quot;>
            Showing {filteredUsers.length || 0} of {(users as UserType[] | undefined)?.length || 0} users
          </div>
          <div className=&quot;flex space-x-2&quot;>
            <Button variant=&quot;outline&quot; size=&quot;sm&quot; disabled>
              Previous
            </Button>
            <Button variant=&quot;outline&quot; size=&quot;sm&quot; disabled>
              Next
            </Button>
          </div>
        </CardFooter>
      </Card>
    </AppShell>
  );
}
