import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  Menu, 
  X, 
  Home, 
  Package, 
  ShoppingCart, 
  BarChart3, 
  Store, 
  Users, 
  Settings, 
  Gift,
  RefreshCw,
  FileUp,
  UserPlus
} from 'lucide-react';
import { useMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface MobileLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function MobileLayout({ children, title = 'ChainSync' }: MobileLayoutProps) {
  const [location] = useLocation();
  const { isMobile } = useMobile();
  const [open, setOpen] = useState(false);

  if (!isMobile) {
    return <>{children}</>;
  }

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    { href: '/pos', label: 'Point of Sale', icon: ShoppingCart },
    { href: '/inventory', label: 'Inventory', icon: Package },
    { href: '/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/stores', label: 'Stores', icon: Store },
    { href: '/users', label: 'Users', icon: Users },
    { href: '/loyalty', label: 'Loyalty', icon: Gift },
    { href: '/returns', label: 'Returns', icon: RefreshCw },
    { href: '/import', label: 'Import', icon: FileUp },
    { href: '/affiliates', label: 'Affiliates', icon: UserPlus },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-2">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0">
              <div className="flex h-14 items-center border-b px-4">
                <Link href="/dashboard">
                  <div className="flex items-center font-semibold" onClick={() => setOpen(false)}>
                    <span className="hidden md:inline-block">ChainSync</span>
                  </div>
                </Link>
                <Button variant="ghost" size="icon" className="ml-auto" onClick={() => setOpen(false)}>
                  <X className="h-5 w-5" />
                  <span className="sr-only">Close</span>
                </Button>
              </div>
              <ScrollArea className="h-[calc(100vh-3.5rem)]">
                <div className="flex flex-col gap-1 p-2">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.href;
                    return (
                      <Link key={item.href} href={item.href}>
                        <Button
                          variant={isActive ? "default" : "ghost"}
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => setOpen(false)}
                        >
                          <Icon className="mr-2 h-4 w-4" />
                          {item.label}
                        </Button>
                      </Link>
                    );
                  })}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
          <h1 className="text-xl font-semibold">{title}</h1>
        </div>
      </header>
      <main className="flex-1 p-4">
        {children}
      </main>
    </div>
  );
}