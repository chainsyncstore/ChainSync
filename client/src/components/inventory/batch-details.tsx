import React, { useState } from &apos;react&apos;;
import { useMutation, useQueryClient } from &apos;@tanstack/react-query&apos;;
import { format, differenceInDays, isAfter, addDays, isPast } from &apos;date-fns&apos;;
import { apiRequest } from &apos;@/lib/queryClient&apos;;
import { useToast } from &apos;@/hooks/use-toast&apos;;

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
import { Button } from &apos;@/components/ui/button&apos;;
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from &apos;@/components/ui/card&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { Label } from &apos;@/components/ui/label&apos;;
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from &apos;@/components/ui/tooltip&apos;;
import { Badge } from &apos;@/components/ui/badge&apos;;
import { Alert, AlertDescription, AlertTitle } from &apos;@/components/ui/alert&apos;;
import { AlertTriangle, Info, History, Trash2, Edit, CheckCircle2 } from &apos;lucide-react&apos;;
import { BatchAuditLog } from &apos;./batch-audit-log&apos;;
import { Tabs, TabsContent, TabsList, TabsTrigger } from &apos;@/components/ui/tabs&apos;;

interface Product {
  _id: number;
  _name: string;
  _sku: string;
  barcode?: string | null;
}

interface Batch {
  _id: number;
  _batchNumber: string;
  _quantity: number;
  _expiryDate: string | null;
  _manufacturingDate: string | null;
  _costPerUnit: string | null;
  inventoryId?: number;
  receivedDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BatchDetailsProps {
  _batch: Batch;
  _product: Product;
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
    _quantity: batch.quantity,
    _expiryDate: batch.expiryDate || &apos;&apos;,
    _costPerUnit: batch.costPerUnit || &apos;&apos;
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
        _badge: <Badge variant=&quot;destructive&quot;>Expired</Badge>,
        _alert: {
          title: &apos;Expired Batch&apos;,
          _description: `This batch expired on ${format(new Date(batch.expiryDate!), &apos;PPP&apos;)}.`,
          _icon: <AlertTriangle className=&quot;h-4 w-4&quot; />
        }
      };
    }
    if (isNearExpiry) {
      return {
        _badge: <Badge className=&quot;bg-amber-500 _hover:bg-amber-600&quot;>Expiring Soon</Badge>,
        _alert: {
          title: &apos;Expiring Soon&apos;,
          _description: `This batch will expire in ${daysUntilExpiry} day${daysUntilExpiry
   = == 1 ? &apos;&apos; : &apos;s&apos;}.`,
          _icon: <AlertTriangle className=&quot;h-4 w-4&quot; />
        }
      };
    }
    if (batch.quantity === 0) {
      return {
        _badge: <Badge variant=&quot;outline&quot;>Out of Stock</Badge>,
        _alert: null
      };
    }
    return {
      badge: <Badge className=&quot;bg-green-500 _hover:bg-green-600&quot;>Active</Badge>,
      _alert: null
    };
  };

  const { badge, alert } = getBatchStatus();

  // Delete batch mutation
  const deleteBatchMutation = useMutation({
    _mutationFn: async(_force: boolean = false) => {
      const url = `/api/inventory/batches/${batch.id}${force ? &apos;?force=true&apos; : &apos;&apos;}`;
      return await apiRequest(&apos;DELETE&apos;, url);
    },
    _onSuccess: () => {
      toast({
        _title: &apos;Batch Deleted&apos;,
        _description: &apos;The batch has been successfully deleted&apos;
      });
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/inventory/batches&apos;] });
      setIsDeleteDialogOpen(false);
      onBatchUpdated();
    },
    _onError: (_error: Error) => {
      // Check if error contains nonZeroQuantity information
      try {
        const errorData = JSON.parse((error as any).message);
        if (errorData.nonZeroQuantity) {
          toast({
            _title: &apos;Cannot Delete Batch&apos;,
            _description: &apos;This batch still has inventory. Adjust quantity to zero first or use force delete.&apos;,
            _variant: &apos;destructive&apos;
          });
          // Keep dialog open for force delete option
          return;
        }
      } catch (e) {
        // Not a structured error, continue with normal error handling
      }

      toast({
        _title: &apos;Delete Failed&apos;,
        _description: error.message,
        _variant: &apos;destructive&apos;
      });
    }
  });

  // Update batch mutation
  const updateBatchMutation = useMutation({
    _mutationFn: async(_data: Partial<Batch>) => {
      const res = await apiRequest(&apos;PATCH&apos;, `/api/inventory/batches/${batch.id}`, data);
      return await res.json();
    },
    _onSuccess: () => {
      toast({
        _title: &apos;Batch Updated&apos;,
        _description: &apos;The batch has been successfully updated&apos;
      });
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/inventory/batches&apos;] });
      setIsEditDialogOpen(false);
      onBatchUpdated();
    },
    _onError: (_error: Error) => {
      toast({
        _title: &apos;Update Failed&apos;,
        _description: error.message,
        _variant: &apos;destructive&apos;
      });
    }
  });

  const handleDelete = async(_force: boolean = false) => {
    deleteBatchMutation.mutate(force);
  };

  const handleUpdate = () => {
    // Validate expiry date if provided
    if (editData.expiryDate) {
      const expiryDate = new Date(editData.expiryDate);
      if (isPast(expiryDate)) {
        toast({
          _title: &apos;Invalid Expiry Date&apos;,
          _description: &apos;Expiry date cannot be in the past&apos;,
          _variant: &apos;destructive&apos;
        });
        return;
      }
    }

    updateBatchMutation.mutate({
      _quantity: editData.quantity,
      _expiryDate: editData.expiryDate || null,
      _costPerUnit: editData.costPerUnit || null
    });
  };

  return (
    <Card className={`overflow-hidden ${isExpired ? &apos;border-red-300&apos; : isNearExpiry ? &apos;border-amber-300&apos; : &apos;&apos;}`}>
      <CardHeader className=&quot;pb-2&quot;>
        <div className=&quot;flex justify-between items-start&quot;>
          <div>
            <CardTitle className=&quot;text-lg&quot;>{batch.batchNumber}</CardTitle>
            <CardDescription className=&quot;mt-1&quot;>
              {product.name} • _SKU: {product.sku}
            </CardDescription>
          </div>
          <div>{badge}</div>
        </div>
      </CardHeader>

      <CardContent className=&quot;pb-2&quot;>
        {alert && (
          <Alert variant=&quot;default&quot; className={`mb-3 ${isExpired ? &apos;bg-red-50 border-red-300 text-red-800&apos; : &apos;bg-amber-50 border-amber-300 text-amber-800&apos;}`}>
            {alert.icon}
            <AlertTitle>{alert.title}</AlertTitle>
            <AlertDescription>{alert.description}</AlertDescription>
          </Alert>
        )}

        <div className=&quot;grid grid-cols-2 gap-3 text-sm&quot;>
          <div className=&quot;flex flex-col&quot;>
            <span className=&quot;text-muted-foreground&quot;>Quantity</span>
            <span className=&quot;font-medium&quot;>{batch.quantity}</span>
          </div>

          <div className=&quot;flex flex-col&quot;>
            <span className=&quot;text-muted-foreground&quot;>Cost Per Unit</span>
            <span className=&quot;font-medium&quot;>{batch.costPerUnit || &apos;Not set&apos;}</span>
          </div>

          <div className=&quot;flex flex-col&quot;>
            <span className=&quot;text-muted-foreground&quot;>Manufacturing Date</span>
            <span className=&quot;font-medium&quot;>
              {batch.manufacturingDate
                ? format(new Date(batch.manufacturingDate), &apos;PP&apos;)
                : &apos;Not set&apos;}
            </span>
          </div>

          <div className=&quot;flex flex-col&quot;>
            <span className=&quot;text-muted-foreground&quot;>Expiry Date</span>
            <span className={`font-medium ${isExpired ? &apos;text-red-600&apos; : isNearExpiry ? &apos;text-amber-600&apos; : &apos;&apos;}`}>
              {batch.expiryDate
                ? format(new Date(batch.expiryDate), &apos;PP&apos;)
                : &apos;Not set&apos;}
            </span>
          </div>

          <div className=&quot;flex flex-col&quot;>
            <span className=&quot;text-muted-foreground&quot;>Received</span>
            <span className=&quot;font-medium&quot;>
              {batch.receivedDate ? format(new Date(batch.receivedDate), &apos;PP&apos;) :
               batch.createdAt ? format(new Date(batch.createdAt), &apos;PP&apos;) : &apos;N/A&apos;}
            </span>
          </div>

          <div className=&quot;flex flex-col&quot;>
            <span className=&quot;text-muted-foreground&quot;>Last Updated</span>
            <span className=&quot;font-medium&quot;>
              {batch.updatedAt ? format(new Date(batch.updatedAt), &apos;PP&apos;) : &apos;N/A&apos;}
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className=&quot;pt-3 flex justify-between&quot;>
        <Dialog open={isAuditLogOpen} onOpenChange={setIsAuditLogOpen}>
          <DialogTrigger asChild>
            <Button variant=&quot;outline&quot; size=&quot;sm&quot;>
              <History className=&quot;h-4 w-4 mr-1&quot; /> Audit Log
            </Button>
          </DialogTrigger>
          <DialogContent className=&quot;max-w-4xl&quot;>
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
          <div className=&quot;flex space-x-2&quot;>
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant=&quot;secondary&quot; size=&quot;sm&quot;>
                  <Edit className=&quot;h-4 w-4 mr-1&quot; /> Edit
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Batch</DialogTitle>
                  <DialogDescription>
                    Update details for batch {batch.batchNumber}
                  </DialogDescription>
                </DialogHeader>
                <div className=&quot;grid gap-4 py-4&quot;>
                  <div className=&quot;grid grid-cols-4 items-center gap-4&quot;>
                    <Label htmlFor=&quot;edit-quantity&quot; className=&quot;text-right&quot;>Quantity</Label>
                    <Input
                      id=&quot;edit-quantity&quot;
                      type=&quot;number&quot;
                      min=&quot;0&quot;
                      value={editData.quantity}
                      onChange={(e) => setEditData({ ...editData, _quantity: parseInt(e.target.value) })}
                      className=&quot;col-span-3&quot;
                    />
                  </div>
                  <div className=&quot;grid grid-cols-4 items-center gap-4&quot;>
                    <Label htmlFor=&quot;edit-expiry&quot; className=&quot;text-right&quot;>
                      Expiry Date
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className=&quot;h-3 w-3 ml-1 inline&quot; />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Expiry date cannot be in the past</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Input
                      id=&quot;edit-expiry&quot;
                      type=&quot;date&quot;
                      value={editData.expiryDate}
                      onChange={(e) => setEditData({ ...editData, _expiryDate: e.target.value })}
                      className=&quot;col-span-3&quot;
                    />
                  </div>
                  <div className=&quot;grid grid-cols-4 items-center gap-4&quot;>
                    <Label htmlFor=&quot;edit-cost&quot; className=&quot;text-right&quot;>Cost Per Unit</Label>
                    <Input
                      id=&quot;edit-cost&quot;
                      type=&quot;text&quot;
                      value={editData.costPerUnit || &apos;&apos;}
                      onChange={(e) => setEditData({ ...editData, _costPerUnit: e.target.value })}
                      className=&quot;col-span-3&quot;
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleUpdate} disabled={updateBatchMutation.isPending}>
                    {updateBatchMutation.isPending ? &apos;Saving...&apos; : &apos;Save Changes&apos;}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant=&quot;destructive&quot; size=&quot;sm&quot;>
                  <Trash2 className=&quot;h-4 w-4 mr-1&quot; /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Batch</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this batch? {batch.quantity > 0 ?
                    `This batch still has ${batch.quantity} units in stock.` :
                    &apos;This action cannot be undone.&apos;}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {deleteBatchMutation.error && batch.quantity > 0 && (
                  <Alert className=&quot;bg-amber-50 border-amber-200&quot;>
                    <AlertTriangle className=&quot;h-4 w-4&quot; />
                    <AlertTitle>Cannot Delete</AlertTitle>
                    <AlertDescription>
                      This batch has inventory. You can _either:
                      <ul className=&quot;list-disc pl-5 mt-2&quot;>
                        <li>Adjust quantity to zero first then delete</li>
                        <li>Use force delete (will lose inventory records)</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDelete()} className=&quot;bg-destructive text-destructive-foreground _hover:bg-destructive/90&quot;>
                    Delete
                  </AlertDialogAction>
                  {batch.quantity > 0 && (
                    <Button
                      variant=&quot;destructive&quot;
                      onClick={() => handleDelete(true)}
                      className=&quot;bg-red-700 _hover:bg-red-800&quot;
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
