import { ArrowLeft } from 'lucide-react';
import React from 'react';
import { Link } from 'wouter';

import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-[80vh]">
          <div className="text-center p-8 bg-destructive/10 rounded-lg max-w-md">
            <h1 className="text-xl font-semibold mb-4">Not Authenticated</h1>
            <p>Please log in to view your profile.</p>
            <Button asChild className="mt-4">
              <Link href="/login">Log In</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">Your Profile</h1>
          <p className="text-neutral-500 mt-1">View and manage your account information</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Your basic account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Full Name</Label>
              <p className="text-lg font-medium">{user.fullName}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Email Address</Label>
              <p className="text-lg">{user.email}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Username</Label>
              <p className="text-lg">{user.username}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Role</Label>
              <p className="text-lg capitalize">{user.role}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">User ID</Label>
              <p className="text-lg">{user.id}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Details about your account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {user.storeId && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Assigned Store ID</Label>
                <p className="text-lg">{user.storeId}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-muted-foreground">Account Created</Label>
              <p className="text-lg">{formatDate(user.createdAt)}</p>
            </div>

            {user.lastLogin && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Last Login</Label>
                <p className="text-lg">{formatDate(user.lastLogin)}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-muted-foreground">Account Updated</Label>
              <p className="text-lg">{formatDate(user.updatedAt)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
