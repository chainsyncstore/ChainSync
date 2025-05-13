import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { RefreshCw } from 'lucide-react';

export function MobileRecentReturns() {
  const { data: returns, isLoading } = useQuery({
    queryKey: ['/api/returns/recent'],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Returns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-4 w-[150px]" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Map status to badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'pending':
        return 'warning';
      case 'rejected':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Returns</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {returns && returns.length > 0 ? (
            returns.map((returnItem: any) => (
              <div key={returnItem.id} className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-orange-100 p-2 flex-shrink-0">
                    <RefreshCw className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">ID: #{returnItem.returnId}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(returnItem.createdAt), 'MMM dd, h:mm a')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {returnItem.items?.length || 0} {returnItem.items?.length === 1 ? 'item' : 'items'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    ${parseFloat(returnItem.totalAmount).toFixed(2)}
                  </p>
                  <Badge 
                    variant={getStatusBadgeVariant(returnItem.status)}
                    className="mt-1"
                  >
                    {returnItem.status}
                  </Badge>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              No recent returns
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}