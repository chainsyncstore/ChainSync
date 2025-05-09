import React from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { AffiliateDashboard } from '@/components/affiliate/affiliate-dashboard';
import { useAuth } from '@/providers/auth-provider';

export default function AffiliatePage() {
  const { user } = useAuth();
  
  return (
    <AppShell>
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-800">Affiliate Program</h1>
        <p className="text-neutral-500 mt-1">Earn commission by referring new users to ChainSync</p>
      </div>
      
      {/* Affiliate Dashboard */}
      <AffiliateDashboard />
    </AppShell>
  );
}