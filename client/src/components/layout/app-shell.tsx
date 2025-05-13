import React, { ReactNode, useState } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { useAuth } from '@/providers/auth-provider';
import { useMobile } from '@/hooks/use-mobile';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { user } = useAuth();
  const isMobile = useMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-100">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        role={user.role} 
      />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header 
          user={user} 
          onMenuClick={toggleSidebar} 
          isSidebarOpen={sidebarOpen}
        />
        
        <main className="flex-1 overflow-y-auto bg-neutral-50 p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
