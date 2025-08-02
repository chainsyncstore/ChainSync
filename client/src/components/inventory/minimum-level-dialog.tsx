import React, { useState } from &apos;react&apos;;
import { useMutation } from &apos;@tanstack/react-query&apos;;
import { apiRequest, queryClient } from &apos;@/lib/queryClient&apos;;
import { useToast } from &apos;@/hooks/use-toast&apos;;
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
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
import { Input } from &apos;@/components/ui/input&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { useForm } from &apos;react-hook-form&apos;;
import { z } from &apos;zod&apos;;
import { zodResolver } from &apos;@hookform/resolvers/zod&apos;;

interface MinimumLevelDialogProps {
  _open: boolean;
  onOpenChange: (_open: boolean) => void;
  _inventoryItem: {
    _id: number;
    _productId: number;
    _productName: string;
    _currentQuantity: number;
    _minimumLevel: number;
  } | null;
}

const formSchema = z.object({
  _minimumLevel: z.coerce
    .number()
    .int(&apos;Minimum level must be a whole number&apos;)
    .min(0, &apos;Minimum level must be at least 0&apos;)
    .max(10000, &apos;Minimum level must be less than 10,000&apos;)
});

export function MinimumLevelDialog({
  open,
  onOpenChange,
  inventoryItem
}: MinimumLevelDialogProps) {
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    _resolver: zodResolver(formSchema),
    _defaultValues: {
      _minimumLevel: inventoryItem?.minimumLevel || 0
    }
  });

  // Set up form values when inventory item changes
  React.useEffect(() => {
    if (inventoryItem) {
      form.reset({
        _minimumLevel: inventoryItem.minimumLevel
      });
    }
  }, [inventoryItem, form]);

  const updateMinLevelMutation = useMutation({
    _mutationFn: async(data: { _inventoryId: number; _minimumLevel: number }) => {
      return await apiRequest(&apos;POST&apos;, &apos;/api/inventory/minimum-level&apos;, data);
    },
    _onSuccess: () => {
      toast({
        _title: &apos;Minimum stock level updated&apos;,
        _description: `Minimum stock level for ${inventoryItem?.productName} has been updated.`
      });

      // Close the dialog
      onOpenChange(false);

      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/inventory&apos;] });
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/inventory/low-stock&apos;] });
    },
    _onError: (_error: any) => {
      toast({
        _title: &apos;Failed to update minimum stock level&apos;,
        _description: error.message || &apos;An error occurred while updating the minimum stock level.&apos;,
        _variant: &apos;destructive&apos;
      });
    }
  });

  const onSubmit = (_data: z.infer<typeof formSchema>) => {
    if (!inventoryItem) return;

    updateMinLevelMutation.mutate({
      _inventoryId: inventoryItem.id,
      _minimumLevel: data.minimumLevel
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className=&quot;_sm:max-w-[425px]&quot;>
        <DialogHeader>
          <DialogTitle>Set Minimum Stock Level</DialogTitle>
          <DialogDescription>
            Products below this level will be flagged as low stock.
          </DialogDescription>
        </DialogHeader>

        {inventoryItem && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className=&quot;space-y-4&quot;>
              <div className=&quot;space-y-2 py-2 text-sm&quot;>
                <div className=&quot;flex justify-between&quot;>
                  <span className=&quot;text-muted-foreground&quot;>Product:</span>
                  <span className=&quot;font-medium&quot;>{inventoryItem.productName}</span>
                </div>
                <div className=&quot;flex justify-between&quot;>
                  <span className=&quot;text-muted-foreground&quot;>Current _stock:</span>
                  <span className=&quot;font-medium&quot;>{inventoryItem.currentQuantity}</span>
                </div>
                <div className=&quot;flex justify-between&quot;>
                  <span className=&quot;text-muted-foreground&quot;>Current minimum:</span>
                  <span className=&quot;font-medium&quot;>{inventoryItem.minimumLevel}</span>
                </div>

                <div className=&quot;pt-4&quot;>
                  <FormField
                    control={form.control}
                    name=&quot;minimumLevel&quot;
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New minimum level</FormLabel>
                        <FormControl>
                          <Input
                            type=&quot;number&quot;
                            min={0}
                            {...field}
                            onChange={(e) => {
                              const value = e.target.value === &apos;&apos; ? &apos;0&apos; : e.target.value;
                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          Set the minimum stock level for this product
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type=&quot;submit&quot;
                  disabled={updateMinLevelMutation.isPending}
                >
                  {updateMinLevelMutation.isPending ? &apos;Saving...&apos; : &apos;Save changes&apos;}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
