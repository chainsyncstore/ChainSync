import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

export function MobileStockAlert() {
  const [open, setOpen] = useState(false);
  
  const { data: lowStockCount, isLoading: isCountLoading } = useQuery({
    queryKey: ['/api/inventory/low-stock/count'],
  });
  
  const { data: lowStockItems, isLoading: isItemsLoading } = useQuery({
    queryKey: ['/api/inventory/low-stock'],
    enabled: open,
  });

  if (isCountLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Low Stock Alert</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-6 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  if (!lowStockCount || lowStockCount.count === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Stock Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-green-600 flex items-center">
            All inventory items are well-stocked
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Low Stock Alert</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center text-amber-600">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">
                    {lowStockCount.count} {lowStockCount.count === 1 ? 'item' : 'items'} running low
                  </span>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[80%]">
          <SheetHeader className="text-left">
            <SheetTitle>Low Stock Items</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {isItemsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Store</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockItems && lowStockItems.map((item: any) => (
                    <TableRow key={`${item.productId}-${item.storeId}`}>
                      <TableCell className="font-medium">{item.product.name}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={item.quantity <= 5 ? "destructive" : "outline"}>
                          {item.quantity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{item.store.name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="mt-4 flex justify-end">
              <Link href="/inventory">
                <Button size="sm" onClick={() => setOpen(false)}>
                  View Inventory
                </Button>
              </Link>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}