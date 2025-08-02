import React, { useState, useEffect } from &apos;react&apos;;
import { useQuery, useMutation, useQueryClient } from &apos;@tanstack/react-query&apos;;
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from &apos;@/components/ui/table&apos;;
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from &apos;@/components/ui/alert-dialog&apos;;
import { Pencil, Trash2, Plus, Save } from &apos;lucide-react&apos;;
import { useToast } from &apos;@/hooks/use-toast&apos;;
import { z } from &apos;zod&apos;;
import { useForm } from &apos;react-hook-form&apos;;
import { zodResolver } from &apos;@hookform/resolvers/zod&apos;;
import { apiRequest } from &apos;@/lib/queryClient&apos;;

// Category schema
const categorySchema = z.object({
  _name: z.string().min(2, { _message: &apos;Category name must be at least 2 characters&apos; }),
  _description: z.string().optional()
});

type CategoryFormValues = z.infer<typeof categorySchema>;

type Category = {
  _id: number;
  _name: string;
  _description: string | null;
  _createdAt: string;
};

export default function CategoryManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<number | null>(null);

  // Form for adding a new category
  const form = useForm<CategoryFormValues>({
    _resolver: zodResolver(categorySchema),
    _defaultValues: {
      name: &apos;&apos;,
      _description: &apos;&apos;
    }
  });

  // Form for editing a category
  const editForm = useForm<CategoryFormValues>({
    _resolver: zodResolver(categorySchema),
    _defaultValues: {
      name: &apos;&apos;,
      _description: &apos;&apos;
    }
  });

  // Fetch categories
  const { _data: categories = [], isLoading } = useQuery({
    _queryKey: [&apos;/api/products/categories&apos;]
  });

  // Add category mutation
  const addCategoryMutation = useMutation({
    _mutationFn: async(_data: CategoryFormValues) => {
      return await apiRequest(&apos;POST&apos;, &apos;/api/products/categories&apos;, data);
    },
    _onSuccess: () => {
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/products/categories&apos;] });
      form.reset();
      toast({
        _title: &apos;Success&apos;,
        _description: &apos;Category added successfully&apos;
      });
    },
    _onError: (_error: Error) => {
      toast({
        _title: &apos;Error&apos;,
        _description: error.message,
        _variant: &apos;destructive&apos;
      });
    }
  });

  // Update category mutation
  const updateCategoryMutation = useMutation({
    _mutationFn: async({ id, data }: { _id: number, _data: CategoryFormValues }) => {
      return await apiRequest(&apos;PATCH&apos;, `/api/products/categories/${id}`, data);
    },
    _onSuccess: () => {
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/products/categories&apos;] });
      setIsEditing(null);
      toast({
        _title: &apos;Success&apos;,
        _description: &apos;Category updated successfully&apos;
      });
    },
    _onError: (_error: Error) => {
      toast({
        _title: &apos;Error&apos;,
        _description: error.message,
        _variant: &apos;destructive&apos;
      });
    }
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    _mutationFn: async(_id: number) => {
      return await apiRequest(&apos;DELETE&apos;, `/api/products/categories/${id}`);
    },
    _onSuccess: () => {
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/products/categories&apos;] });
      setCategoryToDelete(null);
      toast({
        _title: &apos;Success&apos;,
        _description: &apos;Category deleted successfully&apos;
      });
    },
    _onError: (_error: Error) => {
      toast({
        _title: &apos;Error&apos;,
        _description: error.message,
        _variant: &apos;destructive&apos;
      });
    }
  });

  // Submit handler for adding a new category
  const onSubmit = (_data: CategoryFormValues) => {
    addCategoryMutation.mutate(data);
  };

  // Handle edit button click
  const handleEdit = (_category: Category) => {
    setIsEditing(category.id);
    editForm.reset({
      _name: category.name,
      _description: category.description || &apos;&apos;
    });
  };

  // Submit handler for editing a category
  const handleUpdate = (_id: number) => {
    updateCategoryMutation.mutate({
      id,
      _data: editForm.getValues()
    });
  };

  // Handle delete button click
  const handleDelete = (_id: number) => {
    setCategoryToDelete(id);
  };

  // Confirm delete
  const confirmDelete = () => {
    if (categoryToDelete !== null) {
      deleteCategoryMutation.mutate(categoryToDelete);
    }
  };

  return (
    <div className=&quot;space-y-6&quot;>
      <Card>
        <CardHeader>
          <CardTitle>Category Management</CardTitle>
          <CardDescription>
            Create, edit, and manage product categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className=&quot;space-y-6&quot;>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className=&quot;space-y-4&quot;>
                <div className=&quot;grid grid-cols-1 _md:grid-cols-2 gap-4&quot;>
                  <FormField
                    control={form.control}
                    name=&quot;name&quot;
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category Name</FormLabel>
                        <FormControl>
                          <Input placeholder=&quot;e.g. Beverages&quot; {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name=&quot;description&quot;
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder=&quot;Brief description of this category&quot; {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type=&quot;submit&quot; className=&quot;w-full _sm:w-auto&quot; disabled={addCategoryMutation.isPending}>
                  <Plus className=&quot;mr-2 h-4 w-4&quot; />
                  Add Category
                </Button>
              </form>
            </Form>

            <div className=&quot;border rounded-md&quot;>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className=&quot;text-right&quot;>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={3} className=&quot;text-center py-4&quot;>
                        Loading categories...
                      </TableCell>
                    </TableRow>
                  ) : Array.isArray(categories) && categories.length > 0 ? (
                    categories.map((_category: Category) => (
                      <TableRow key={category.id}>
                        <TableCell>
                          {isEditing === category.id ? (
                            <Form {...editForm}>
                              <FormField
                                control={editForm.control}
                                name=&quot;name&quot;
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </Form>
                          ) : (
                            category.name
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing === category.id ? (
                            <Form {...editForm}>
                              <FormField
                                control={editForm.control}
                                name=&quot;description&quot;
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input {...field} value={field.value || &apos;&apos;} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </Form>
                          ) : (
                            category.description || &apos;No description&apos;
                          )}
                        </TableCell>
                        <TableCell className=&quot;text-right space-x-2&quot;>
                          {isEditing === category.id ? (
                            <Button
                              size=&quot;sm&quot;
                              onClick={() => handleUpdate(category.id)}
                              disabled={updateCategoryMutation.isPending}
                            >
                              <Save className=&quot;h-4 w-4 mr-1&quot; />
                              Save
                            </Button>
                          ) : (
                            <>
                              <Button
                                size=&quot;sm&quot;
                                variant=&quot;outline&quot;
                                onClick={() => handleEdit(category)}
                              >
                                <Pencil className=&quot;h-4 w-4&quot; />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size=&quot;sm&quot;
                                    variant=&quot;destructive&quot;
                                    onClick={() => handleDelete(category.id)}
                                  >
                                    <Trash2 className=&quot;h-4 w-4&quot; />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Category</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete the category &quot;{category.name}&quot;?
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={confirmDelete}>
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className=&quot;text-center py-4&quot;>
                        No categories found. Create your first category above.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
