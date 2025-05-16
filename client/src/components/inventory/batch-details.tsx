import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, differenceInDays, isAfter, addDays, isPast } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { 
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Info, History, Trash2, Edit, CheckCircle2 } from "lucide-react";
import { BatchAuditLog } from './batch-audit-log';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Product {
  id: number;
  name: string;
  sku: string;
  barcode?: string | null;
}

interface Batch {
  id: number;
  batchNumber: string;
  quantity: number;
  expiryDate: string | null;
  manufacturingDate: string | null;
  costPerUnit: string | null;
  inventoryId?: number;
  receivedDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BatchDetailsProps {
  batch: Batch;
  product: Product;
  onBatchUpdated: () => void;
  isManagerOrAdmin?: boolean;
}

export function BatchDetails({ batch, product, onBatchUpdated, isManagerOrAdmin = false }: BatchDetailsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
  const [editData, setEditData] = useState({
    quantity: batch.quantity,
    expiryDate: batch.expiryDate || '',
    costPerUnit: batch.costPerUnit || ''
  });
  
  // Calculate if batch is expired or about to expire
  const today = new Date();
  const isExpired = batch.expiryDate ? isPast(new Date(batch.expiryDate)) : false;
  const daysUntilExpiry = batch.expiryDate 
    ? differenceInDays(new Date(batch.expiryDate), today)
    : null;
  const isNearExpiry = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
  
  // Get status badge and alert details
  const getBatchStatus = () => {
    if (isExpired) {
      return { 
        badge: <Badge variant="destructive">Expired</Badge>,
        alert: { 
          title: "Expired Batch", 
          description: `This batch expired on ${format(new Date(batch.expiryDate!), 'PPP')}.`,
          icon: <AlertTriangle className="h-4 w-4" />
        }
      };
    }
    if (isNearExpiry) {
      return { 
        badge: <Badge className="bg-amber-500 hover:bg-amber-600">Expiring Soon</Badge>,
        alert: { 
          title: "Expiring Soon", 
          description: `This batch will expire in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}.`,
          icon: <AlertTriangle className="h-4 w-4" />
        }
      };
    }
    if (batch.quantity === 0) {
      return { 
        badge: <Badge variant="outline">Out of Stock</Badge>,
        alert: null
      };
    }
    return { 
      badge: <Badge className="bg-green-500 hover:bg-green-600">Active</Badge>,
      alert: null
    };
  };
  
  const { badge, alert } = getBatchStatus();
  
  // Delete batch mutation
  const deleteBatchMutation = useMutation({
    mutationFn: async (force: boolean = false) => {
      const url = `/api/inventory/batches/${batch.id}${force ? '?force=true' : ''}`;
      const res = await apiRequest('DELETE', url);
      return await res.json();
    },
    onSuccess: () => {
      toast({ 
        title: "Batch Deleted",
        description: "The batch has been successfully deleted"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/batches'] });
      setIsDeleteDialogOpen(false);
      onBatchUpdated();
    },
    onError: (error: Error) => {
      // Check if error contains nonZeroQuantity information
      try {
        const errorData = JSON.parse((error as any).message);
        if (errorData.nonZeroQuantity) {
          toast({
            title: "Cannot Delete Batch",
            description: "This batch still has inventory. Adjust quantity to zero first or use force delete.",
            variant: "destructive"
          });
          // Keep dialog open for force delete option
          return;
        }
      } catch (e) {
        // Not a structured error, continue with normal error handling
      }
      
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Update batch mutation
  const updateBatchMutation = useMutation({
    mutationFn: async (data: Partial<Batch>) => {
      const res = await apiRequest('PATCH', `/api/inventory/batches/${batch.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({ 
        title: "Batch Updated",
        description: "The batch has been successfully updated"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/batches'] });
      setIsEditDialogOpen(false);
      onBatchUpdated();
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  const handleDelete = async (force: boolean = false) => {
    deleteBatchMutation.mutate(force);
  };
  
  const handleUpdate = () => {
    // Validate expiry date if provided
    if (editData.expiryDate) {
      const expiryDate = new Date(editData.expiryDate);
      if (isPast(expiryDate)) {
        toast({
          title: "Invalid Expiry Date",
          description: "Expiry date cannot be in the past",
          variant: "destructive"
        });
        return;
      }
    }
    
    updateBatchMutation.mutate({
      quantity: editData.quantity,
      expiryDate: editData.expiryDate || null,
      costPerUnit: editData.costPerUnit || null
    });
  };

  return (
    <Card className={`overflow-hidden ${isExpired ? 'border-red-300' : isNearExpiry ? 'border-amber-300' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{batch.batchNumber}</CardTitle>
            <CardDescription className="mt-1">
              {product.name} • SKU: {product.sku}
            </CardDescription>
          </div>
          <div>{badge}</div>
        </div>
      </CardHeader>
      
      <CardContent className="pb-2">
        {alert && (
          <Alert variant="default" className={`mb-3 ${isExpired ? 'bg-red-50 border-red-300 text-red-800' : 'bg-amber-50 border-amber-300 text-amber-800'}`}>
            {alert.icon}
            <AlertTitle>{alert.title}</AlertTitle>
            <AlertDescription>{alert.description}</AlertDescription>
          </Alert>
        )}
      
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex flex-col">
            <span className="text-muted-foreground">Quantity</span>
            <span className="font-medium">{batch.quantity}</span>
          </div>
          
          <div className="flex flex-col">
            <span className="text-muted-foreground">Cost Per Unit</span>
            <span className="font-medium">{batch.costPerUnit || 'Not set'}</span>
          </div>
          
          <div className="flex flex-col">
            <span className="text-muted-foreground">Manufacturing Date</span>
            <span className="font-medium">
              {batch.manufacturingDate 
                ? format(new Date(batch.manufacturingDate), 'PP')
                : 'Not set'}
            </span>
          </div>
          
          <div className="flex flex-col">
            <span className="text-muted-foreground">Expiry Date</span>
            <span className={`font-medium ${isExpired ? 'text-red-600' : isNearExpiry ? 'text-amber-600' : ''}`}>
              {batch.expiryDate 
                ? format(new Date(batch.expiryDate), 'PP')
                : 'Not set'}
            </span>
          </div>
          
          <div className="flex flex-col">
            <span className="text-muted-foreground">Received</span>
            <span className="font-medium">
              {batch.receivedDate ? format(new Date(batch.receivedDate), 'PP') : 
               batch.createdAt ? format(new Date(batch.createdAt), 'PP') : 'N/A'}
            </span>
          </div>
          
          <div className="flex flex-col">
            <span className="text-muted-foreground">Last Updated</span>
            <span className="font-medium">
              {batch.updatedAt ? format(new Date(batch.updatedAt), 'PP') : 'N/A'}
            </span>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="pt-3 flex justify-between">
        <Dialog open={isAuditLogOpen} onOpenChange={setIsAuditLogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <History className="h-4 w-4 mr-1" /> Audit Log
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Batch Audit Log - {batch.batchNumber}</DialogTitle>
              <DialogDescription>
                History of all changes made to this batch
              </DialogDescription>
            </DialogHeader>
            <BatchAuditLog batchId={batch.id} />
          </DialogContent>
        </Dialog>
        
        {isManagerOrAdmin && (
          <div className="flex space-x-2">
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" size="sm">
                  <Edit className="h-4 w-4 mr-1" /> Edit
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Batch</DialogTitle>
                  <DialogDescription>
                    Update details for batch {batch.batchNumber}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-quantity" className="text-right">Quantity</Label>
                    <Input
                      id="edit-quantity"
                      type="number"
                      min="0"
                      value={editData.quantity}
                      onChange={(e) => setEditData({ ...editData, quantity: parseInt(e.target.value) })}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-expiry" className="text-right">
                      Expiry Date
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 ml-1 inline" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Expiry date cannot be in the past</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Input
                      id="edit-expiry"
                      type="date"
                      value={editData.expiryDate}
                      onChange={(e) => setEditData({ ...editData, expiryDate: e.target.value })}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-cost" className="text-right">Cost Per Unit</Label>
                    <Input
                      id="edit-cost"
                      type="text"
                      value={editData.costPerUnit || ''}
                      onChange={(e) => setEditData({ ...editData, costPerUnit: e.target.value })}
                      className="col-span-3"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleUpdate} disabled={updateBatchMutation.isPending}>
                    {updateBatchMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Batch</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this batch? {batch.quantity > 0 ? 
                    `This batch still has ${batch.quantity} units in stock.` : 
                    'This action cannot be undone.'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {deleteBatchMutation.error && batch.quantity > 0 && (
                  <Alert className="bg-amber-50 border-amber-200">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Cannot Delete</AlertTitle>
                    <AlertDescription>
                      This batch has inventory. You can either:
                      <ul className="list-disc pl-5 mt-2">
                        <li>Adjust quantity to zero first then delete</li>
                        <li>Use force delete (will lose inventory records)</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDelete()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                  {batch.quantity > 0 && (
                    <Button
                      variant="destructive"
                      onClick={() => handleDelete(true)}
                      className="bg-red-700 hover:bg-red-800"
                    >
                      Force Delete
                    </Button>
                  )}
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}