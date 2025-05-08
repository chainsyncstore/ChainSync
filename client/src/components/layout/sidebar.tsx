import React from 'react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { useOfflineMode } from '@/hooks/use-offline-mode';
import { 
  LayoutDashboard, 
  Store, 
  BarChart2, 
  Package, 
  Users, 
  Settings,
  ShoppingCart
} from 'lucide-react';
import { ChainSyncLogo } from '@/components/ui/chain-sync-logo';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useMobile } from '@/hooks/use-mobile';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  role: 'admin' | 'manager' | 'cashier';
}

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  active: boolean;
  onClick?: () => void;
}

const NavItem = ({ href, icon, children, active, onClick }: NavItemProps) => (
  <Link
    href={href}
    onClick={onClick}
    className={cn(
      "flex items-center px-4 py-3 text-primary-100 hover:bg-primary-600 transition-colors",
      active && "bg-primary-600"
    )}
  >
    <div className="w-5 h-5 mr-3 text-primary-100">
      {icon}
    </div>
    <span>{children}</span>
  </Link>
);

export function Sidebar({ isOpen, onClose, role }: SidebarProps) {
  const isMobile = useMobile();
  const [location] = useLocation();
  const { isOnline, hasPendingTransactions } = useOfflineMode();
  
  return (
    <>
      {/* Mobile overlay */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}
      
      <aside 
        className={cn(
          "bg-primary text-white w-64 flex-shrink-0 h-full overflow-hidden z-50 transition-all duration-300 ease-in-out",
          isMobile && "fixed top-0 bottom-0 left-0",
          isMobile && !isOpen && "-translate-x-full"
        )}
      >
        <div className="p-4 border-b border-primary-600">
          <ChainSyncLogo 
            className="w-8 h-8" 
            textClassName="ml-2 text-xl font-bold"
            iconColor="white"
            textColor="white"
          />
        </div>

        <ScrollArea className="flex-1">
          {/* Main Navigation */}
          <div className="py-2">
            <div className="px-4 py-3 text-xs uppercase text-primary-100 font-semibold">
              Navigation
            </div>
            
            <nav>
              {role === 'cashier' ? (
                <NavItem 
                  href="/pos" 
                  icon={<ShoppingCart className="w-5 h-5" />} 
                  active={location === '/pos'} 
                  onClick={isMobile ? onClose : undefined}
                >
                  Point of Sale
                </NavItem>
              ) : (
                <>
                  <NavItem 
                    href="/dashboard" 
                    icon={<LayoutDashboard className="w-5 h-5" />} 
                    active={location === '/dashboard'} 
                    onClick={isMobile ? onClose : undefined}
                  >
                    Dashboard
                  </NavItem>
                  
                  <NavItem 
                    href="/stores" 
                    icon={<Store className="w-5 h-5" />} 
                    active={location === '/stores'} 
                    onClick={isMobile ? onClose : undefined}
                  >
                    Stores
                  </NavItem>
                  
                  <NavItem 
                    href="/analytics" 
                    icon={<BarChart2 className="w-5 h-5" />} 
                    active={location === '/analytics'} 
                    onClick={isMobile ? onClose : undefined}
                  >
                    Analytics
                  </NavItem>
                  
                  <NavItem 
                    href="/inventory" 
                    icon={<Package className="w-5 h-5" />} 
                    active={location === '/inventory'} 
                    onClick={isMobile ? onClose : undefined}
                  >
                    Inventory
                  </NavItem>
                  
                  {role === 'admin' && (
                    <NavItem 
                      href="/users" 
                      icon={<Users className="w-5 h-5" />} 
                      active={location === '/users'} 
                      onClick={isMobile ? onClose : undefined}
                    >
                      Users
                    </NavItem>
                  )}
                  
                  <NavItem 
                    href="/settings" 
                    icon={<Settings className="w-5 h-5" />} 
                    active={location === '/settings'} 
                    onClick={isMobile ? onClose : undefined}
                  >
                    Settings
                  </NavItem>
                </>
              )}
            </nav>
          </div>
        </ScrollArea>

        <div className="px-4 pt-6 pb-2 text-primary-100 border-t border-primary-600 mt-auto">
          <div className="flex items-center mb-3">
            <div className={cn(
              "w-2 h-2 rounded-full mr-2",
              isOnline ? "bg-green-500" : "bg-amber-500 animate-pulse-custom"
            )}></div>
            <p className="text-xs font-medium">
              System Status: {isOnline ? "Online" : "Offline"}
            </p>
          </div>
          
          {hasPendingTransactions && (
            <div className="text-xs text-amber-300 mb-2">
              {`${hasPendingTransactions ? 'Pending transactions to sync' : ''}`}
            </div>
          )}
          
          <div className="text-xs text-primary-100 opacity-75">
            Last sync: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </aside>
    </>
  );
}
