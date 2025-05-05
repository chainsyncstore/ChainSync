import React, { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PlusIcon, Store, RefreshCw, Edit, MapPin, Phone, Users } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';

export default function StoresPage() {
  const { user } = useAuth();
  const { data: stores, isLoading, refetch } = useQuery({ queryKey: ['/api/stores'] });
  
  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">Stores</h1>
          <p className="text-neutral-500 mt-1">Manage your retail store locations</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          
          {user?.role === 'admin' && (
            <Button>
              <PlusIcon className="w-4 h-4 mr-2" />
              Add New Store
            </Button>
          )}
        </div>
      </div>
      
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-32 mb-1" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
                <div className="mt-4">
                  <Skeleton className="h-9 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores?.map((store: any) => (
            <Card key={store.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{store.name}</CardTitle>
                    <CardDescription>ID: {store.id}</CardDescription>
                  </div>
                  <Badge variant={store.isActive ? "outline" : "destructive"} className={store.isActive ? "bg-green-100 text-green-700 border-green-200" : ""}>
                    {store.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm">
                    <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>{store.address}, {store.city}, {store.state} {store.zipCode}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>{store.phone}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>5 Employees</span>
                  </div>
                </div>
                <Button variant="outline" className="w-full" asChild>
                  <a href={`/stores/${store.id}`}>
                    <Store className="h-4 w-4 mr-2" />
                    View Store Details
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
