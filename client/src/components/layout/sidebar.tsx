import React from &apos;react&apos;;
import { Link, useLocation } from &apos;wouter&apos;;
import { cn } from &apos;@/lib/utils&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import { useOfflineMode } from &apos;@/hooks/use-offline-mode&apos;;
import {
  LayoutDashboard,
  Store,
  BarChart2,
  Package,
  Users,
  Settings,
  ShoppingCart,
  Share2,
  RotateCcw,
  Award,
  FileInput
} from &apos;lucide-react&apos;;
import { ScrollArea } from &apos;@/components/ui/scroll-area&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { useMobile } from &apos;@/hooks/use-mobile&apos;;

interface SidebarProps {
  _isOpen: boolean;
  onClose: () => void;
  _role: &apos;admin&apos; | &apos;manager&apos; | &apos;cashier&apos; | &apos;affiliate&apos;;
}

interface NavItemProps {
  _href: string;
  _icon: React.ReactNode;
  _children: React.ReactNode;
  _active: boolean;
  onClick?: () => void;
  external?: boolean;
}

// Regular NavItem component for internal app navigation
const NavItem = ({ href, icon, children, active, onClick }: NavItemProps) => (
  <Link
    href={href}
    onClick={onClick}
    className={cn(
      &apos;flex items-center px-4 py-3 text-primary-100 _hover:bg-primary-600 transition-colors&apos;,
      active && &apos;bg-primary-600&apos;
    )}
  >
    <div className=&quot;w-5 h-5 mr-3 text-primary-100&quot;>
      {icon}
    </div>
    <span>{children}</span>
  </Link>
);

// Separate component for external links outside the app
interface ExternalLinkProps {
  _href: string;
  _icon: React.ReactNode;
  _children: React.ReactNode;
  onClick?: () => void;
}

const ExternalLink = ({ href, icon, children, onClick }: ExternalLinkProps) => (
  <a
    href={href}
    onClick={onClick}
    target=&quot;_blank&quot;
    rel=&quot;noopener noreferrer&quot;
    className=&quot;flex items-center px-4 py-3 text-primary-100 _hover:bg-primary-600 transition-colors&quot;
  >
    <div className=&quot;w-5 h-5 mr-3 text-primary-100&quot;>
      {icon}
    </div>
    <span>{children}</span>
  </a>
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
          className=&quot;fixed inset-0 bg-black/50 z-40&quot;
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          &apos;bg-primary text-white w-64 flex-shrink-0 h-full overflow-hidden z-50 transition-all duration-300 ease-in-out&apos;,
          isMobile && &apos;fixed top-0 bottom-0 left-0&apos;,
          isMobile && !isOpen && &apos;-translate-x-full&apos;
        )}
      >
        <div className=&quot;p-4 border-b border-primary-600&quot;>
          <div className=&quot;flex items-center space-x-2&quot;>
            <svg className=&quot;w-8 h-8&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot;>
              <path d=&quot;M4 5C4 4.44772 4.44772 4 5 4H19C19.5523 4 20 4.44772 20 5V7C20 7.55228 19.5523 8 19 8H5C4.44772 8 4 7.55228 4 7V5Z&quot; fill=&quot;white&quot;/>
              <path d=&quot;M4 11C4 10.4477 4.44772 10 5 10H19C19.5523 10 20 10.4477 20 11V13C20 13.5523 19.5523 14 19 14H5C4.44772 14 4 13.5523 4 13V11Z&quot; fill=&quot;white&quot;/>
              <path d=&quot;M5 16C4.44772 16 4 16.4477 4 17V19C4 19.5523 4.44772 20 5 20H19C19.5523 20 20 19.5523 20 19V17C20 16.4477 19.5523 16 19 16H5Z&quot; fill=&quot;white&quot;/>
            </svg>
            <h1 className=&quot;text-xl font-bold&quot;>ChainSync</h1>
          </div>
        </div>

        <ScrollArea className=&quot;flex-1&quot;>
          {/* Main Navigation */}
          <div className=&quot;py-2&quot;>
            <div className=&quot;px-4 py-3 text-xs uppercase text-primary-100 font-semibold&quot;>
              Navigation
            </div>

            <nav>
              {role === &apos;cashier&apos; ? (
                <>
                  <NavItem
                    href=&quot;/pos&quot;
                    icon={<ShoppingCart className=&quot;w-5 h-5&quot; />}
                    active={location === &apos;/pos&apos;}
                    onClick={isMobile ? _onClose : undefined}
                  >
                    Point of Sale
                  </NavItem>

                  <NavItem
                    href=&quot;/loyalty&quot;
                    icon={<Award className=&quot;w-5 h-5&quot; />}
                    active={location === &apos;/loyalty&apos;}
                    onClick={isMobile ? _onClose : undefined}
                  >
                    Loyalty Program
                  </NavItem>

                  <ExternalLink
                    href=&quot;https://chainsync.store/affiliates&quot;
                    icon={<Share2 className=&quot;w-5 h-5&quot; />}
                    onClick={isMobile ? _onClose : undefined}
                  >
                    Affiliate Program
                  </ExternalLink>
                </>
              ) : (
                <>
                  <NavItem
                    href=&quot;/dashboard&quot;
                    icon={<LayoutDashboard className=&quot;w-5 h-5&quot; />}
                    active={location === &apos;/dashboard&apos;}
                    onClick={isMobile ? _onClose : undefined}
                  >
                    Dashboard
                  </NavItem>

                  <NavItem
                    href=&quot;/stores&quot;
                    icon={<Store className=&quot;w-5 h-5&quot; />}
                    active={location === &apos;/stores&apos;}
                    onClick={isMobile ? _onClose : undefined}
                  >
                    Stores
                  </NavItem>

                  <NavItem
                    href=&quot;/analytics&quot;
                    icon={<BarChart2 className=&quot;w-5 h-5&quot; />}
                    active={location === &apos;/analytics&apos;}
                    onClick={isMobile ? _onClose : undefined}
                  >
                    Analytics
                  </NavItem>

                  <NavItem
                    href=&quot;/inventory&quot;
                    icon={<Package className=&quot;w-5 h-5&quot; />}
                    active={location === &apos;/inventory&apos;}
                    onClick={isMobile ? _onClose : undefined}
                  >
                    Inventory
                  </NavItem>

                  <NavItem
                    href=&quot;/returns&quot;
                    icon={<RotateCcw className=&quot;w-5 h-5&quot; />}
                    active={location === &apos;/returns&apos;}
                    onClick={isMobile ? _onClose : undefined}
                  >
                    Returns
                  </NavItem>

                  <NavItem
                    href=&quot;/loyalty&quot;
                    icon={<Award className=&quot;w-5 h-5&quot; />}
                    active={location === &apos;/loyalty&apos;}
                    onClick={isMobile ? _onClose : undefined}
                  >
                    Loyalty Program
                  </NavItem>

                  {(role === &apos;admin&apos; || role === &apos;manager&apos;) && (
                    <NavItem
                      href=&quot;/import&quot;
                      icon={<FileInput className=&quot;w-5 h-5&quot; />}
                      active={location === &apos;/import&apos;}
                      onClick={isMobile ? _onClose : undefined}
                    >
                      Import Data
                    </NavItem>
                  )}

                  {role === &apos;admin&apos; && (
                    <NavItem
                      href=&quot;/users&quot;
                      icon={<Users className=&quot;w-5 h-5&quot; />}
                      active={location === &apos;/users&apos;}
                      onClick={isMobile ? _onClose : undefined}
                    >
                      Users
                    </NavItem>
                  )}

                  <ExternalLink
                    href=&quot;https://chainsync.store/affiliates&quot;
                    icon={<Share2 className=&quot;w-5 h-5&quot; />}
                    onClick={isMobile ? _onClose : undefined}
                  >
                    Affiliate Program
                  </ExternalLink>

                  <NavItem
                    href=&quot;/settings&quot;
                    icon={<Settings className=&quot;w-5 h-5&quot; />}
                    active={location === &apos;/settings&apos;}
                    onClick={isMobile ? _onClose : undefined}
                  >
                    Settings
                  </NavItem>
                </>
              )}
            </nav>
          </div>
        </ScrollArea>

        <div className=&quot;px-4 pt-6 pb-2 text-primary-100 border-t border-primary-600 mt-auto&quot;>
          <div className=&quot;flex items-center mb-3&quot;>
            <div className={cn(
              &apos;w-2 h-2 rounded-full mr-2&apos;,
              isOnline ? &apos;bg-green-500&apos; : &apos;bg-amber-500 animate-pulse-custom&apos;
            )} />
            <p className=&quot;text-xs font-medium&quot;>
              System _Status: {isOnline ? &apos;Online&apos; : &apos;Offline&apos;}
            </p>
          </div>

          {hasPendingTransactions && (
            <div className=&quot;text-xs text-amber-300 mb-2&quot;>
              {`${hasPendingTransactions ? &apos;Pending transactions to sync&apos; : &apos;&apos;}`}
            </div>
          )}

          <div className=&quot;text-xs text-primary-100 opacity-75&quot;>
            Last _sync: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </aside>
    </>
  );
}
