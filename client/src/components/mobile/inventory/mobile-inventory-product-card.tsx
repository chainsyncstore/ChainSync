import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Info, Trash, ShoppingCart } from 'lucide-react';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

interface MobileInventoryProductCardProps {
  product: any;
}

export function MobileInventoryProductCard({ product }: MobileInventoryProductCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Determine stock level badge variant
  const getStockBadgeVariant = (quantity: number) => {
    if (quantity <= 5) return "destructive";
    if (quantity <= 15) return "warning";
    return "success";
  };

  const getStockLabel = (quantity: number) => {
    if (quantity <= 0) return "Out of stock";
    if (quantity <= 5) return "Low stock";
    if (quantity <= 15) return "Medium stock";
    return "In stock";
  };

  const handleDelete = () => {
    console.log('Delete product:', product.id);
    // API call would go here
    setShowDeleteDialog(false);
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="p-4">
            <div className="flex gap-3">
              {product.imageUrl ? (
                <img 
                  src={product.imageUrl} 
                  alt={product.name} 
                  className="h-16 w-16 object-cover rounded-md"
                />
              ) : (
                <div className="h-16 w-16 bg-muted rounded-md flex items-center justify-center text-muted-foreground">
                  No Image
                </div>
              )}
              <div className="flex-1">
                <div className="flex justify-between">
                  <h3 className="font-medium text-sm line-clamp-1">
                    {product.name}
                  </h3>
                  <Badge 
                    variant={getStockBadgeVariant(product.quantity)} 
                    className="text-[10px]"
                  >
                    {getStockLabel(product.quantity)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {product.barcode}
                </p>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-sm font-semibold">
                    ${parseFloat(product.price).toFixed(2)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Qty: {product.quantity}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex justify-between mt-3 pt-2 border-t">
              <Sheet open={showDetails} onOpenChange={setShowDetails}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8">
                    <Info className="h-3.5 w-3.5 mr-1" />
                    Details
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[80%]">
                  <SheetHeader>
                    <SheetTitle>Product Details</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4 space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold">{product.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {product.barcode}
                      </p>
                    </div>
                    
                    {product.imageUrl && (
                      <img 
                        src={product.imageUrl} 
                        alt={product.name} 
                        className="w-full h-48 object-contain rounded-md bg-muted/50"
                      />
                    )}
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Price</p>
                        <p className="font-medium">${parseFloat(product.price).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cost</p>
                        <p className="font-medium">${parseFloat(product.cost).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Category</p>
                        <p className="font-medium">{product.category?.name || 'Uncategorized'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Perishable</p>
                        <p className="font-medium">{product.isPerishable ? 'Yes' : 'No'}</p>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-muted-foreground text-sm">Description</p>
                      <p className="text-sm">{product.description || 'No description'}</p>
                    </div>
                    
                    <div className="pt-4 border-t">
                      <h4 className="font-medium mb-2">Store Inventory</h4>
                      {product.inventory && product.inventory.length > 0 ? (
                        <div className="space-y-2">
                          {product.inventory.map((inv: any) => (
                            <div key={inv.id} className="flex justify-between p-2 bg-muted/50 rounded-md">
                              <span className="text-sm">{inv.store.name}</span>
                              <Badge 
                                variant={getStockBadgeVariant(inv.quantity)}
                                className="text-[10px]"
                              >
                                {inv.quantity}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No inventory data available</p>
                      )}
                    </div>
                    
                    <div className="flex justify-between pt-4">
                      <Link href={`/inventory/edit/${product.id}`}>
                        <Button 
                          variant="outline"
                          className="w-[48%]"
                          onClick={() => setShowDetails(false)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </Link>
                      <Button 
                        variant="destructive"
                        className="w-[48%]"
                        onClick={() => {
                          setShowDetails(false);
                          setShowDeleteDialog(true);
                        }}
                      >
                        <Trash className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
              
              <div className="flex gap-2">
                <Link href={`/inventory/edit/${product.id}`}>
                  <Button variant="outline" size="sm" className="h-8">
                    <Edit className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                </Link>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="h-8"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash className="h-3.5 w-3.5 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the product "{product.name}" from your inventory.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}