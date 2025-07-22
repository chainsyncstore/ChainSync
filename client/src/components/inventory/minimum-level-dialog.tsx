import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

interface MinimumLevelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventoryItem: {
    id: number;
    productId: number;
    productName: string;
    currentQuantity: number;
    minimumLevel: number;
  } | null;
}

const formSchema = z.object({
  minimumLevel: z.coerce
    .number()
    .int('Minimum level must be a whole number')
    .min(0, 'Minimum level must be at least 0')
    .max(10000, 'Minimum level must be less than 10,000'),
});

export function MinimumLevelDialog({
  open,
  onOpenChange,
  inventoryItem,
}: MinimumLevelDialogProps) {
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      minimumLevel: inventoryItem?.minimumLevel || 0,
    },
  });
  
  // Set up form values when inventory item changes
  React.useEffect(() => {
    if (inventoryItem) {
      form.reset({
        minimumLevel: inventoryItem.minimumLevel,
      });
    }
  }, [inventoryItem, form]);
  
  const updateMinLevelMutation = useMutation({
    mutationFn: async (data: { inventoryId: number; minimumLevel: number }) => {
      return await apiRequest('POST', '/api/inventory/minimum-level', data);
    },
    onSuccess: () => {
      toast({
        title: 'Minimum stock level updated',
        description: `Minimum stock level for ${inventoryItem?.productName} has been updated.`,
      });
      
      // Close the dialog
      onOpenChange(false);
      
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/low-stock'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update minimum stock level',
        description: error.message || 'An error occurred while updating the minimum stock level.',
        variant: 'destructive',
      });
    },
  });
  
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    if (!inventoryItem) return;
    
    updateMinLevelMutation.mutate({
      inventoryId: inventoryItem.id,
      minimumLevel: data.minimumLevel,
    });
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Set Minimum Stock Level</DialogTitle>
          <DialogDescription>
            Products below this level will be flagged as low stock.
          </DialogDescription>
        </DialogHeader>
        
        {inventoryItem && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2 py-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Product:</span>
                  <span className="font-medium">{inventoryItem.productName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current stock:</span>
                  <span className="font-medium">{inventoryItem.currentQuantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current minimum:</span>
                  <span className="font-medium">{inventoryItem.minimumLevel}</span>
                </div>
                
                <div className="pt-4">
                  <FormField
                    control={form.control}
                    name="minimumLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New minimum level</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={0} 
                            {...field} 
                            onChange={(e) => {
                              const value = e.target.value === "" ? "0" : e.target.value;
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
                  type="submit" 
                  disabled={updateMinLevelMutation.isPending}
                >
                  {updateMinLevelMutation.isPending ? 'Saving...' : 'Save changes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}