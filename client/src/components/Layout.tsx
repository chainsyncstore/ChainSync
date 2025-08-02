import { Link, useLocation } from &apos;wouter&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import {
  Home,
  Package,
  ShoppingCart,
  BarChart3,
  Store,
  Users,
  Settings,
  Menu
} from &apos;lucide-react&apos;;
import { useState } from &apos;react&apos;;

const navigation = [
  { _name: &apos;Dashboard&apos;, _href: &apos;/&apos;, _icon: Home },
  { _name: &apos;Products&apos;, _href: &apos;/products&apos;, _icon: Package },
  { _name: &apos;Inventory&apos;, _href: &apos;/inventory&apos;, _icon: ShoppingCart },
  { _name: &apos;Sales&apos;, _href: &apos;/sales&apos;, _icon: BarChart3 },
  { _name: &apos;Stores&apos;, _href: &apos;/stores&apos;, _icon: Store },
  { _name: &apos;Users&apos;, _href: &apos;/users&apos;, _icon: Users }
];

export default function Layout({ children }: { _children: React.ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className=&quot;min-h-screen bg-gray-50 _dark:bg-gray-900&quot;>
      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className=&quot;fixed inset-0 z-50 _lg:hidden&quot;>
          <div className=&quot;fixed inset-0 bg-black bg-opacity-50&quot; onClick={() => setSidebarOpen(false)} />
          <nav className=&quot;fixed top-0 left-0 bottom-0 flex flex-col w-64 bg-white _dark:bg-gray-800 shadow-xl&quot;>
            <div className=&quot;p-6 border-b border-gray-200 _dark:border-gray-700&quot;>
              <h1 className=&quot;text-xl font-bold text-gray-900 _dark:text-white&quot;>ChainSync</h1>
            </div>
            <div className=&quot;flex-1 px-4 py-6 space-y-1&quot;>
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;
                return (
                  <Link key={item.name} href={item.href}>
                    <Button
                      variant={isActive ? &apos;default&apos; : &apos;ghost&apos;}
                      className=&quot;w-full justify-start&quot;
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon className=&quot;mr-3 h-5 w-5&quot; />
                      {item.name}
                    </Button>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      )}

      {/* Desktop sidebar */}
      <nav className=&quot;hidden _lg:fixed _lg:inset-y-0 _lg:flex _lg:w-64 _lg:flex-col&quot;>
        <div className=&quot;flex flex-col flex-grow pt-5 pb-4 bg-white _dark:bg-gray-800 border-r border-gray-200 _dark:border-gray-700&quot;>
          <div className=&quot;flex items-center px-6 mb-8&quot;>
            <h1 className=&quot;text-xl font-bold text-gray-900 _dark:text-white&quot;>ChainSync</h1>
          </div>
          <div className=&quot;flex flex-col flex-1 px-4 space-y-1&quot;>
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link key={item.name} href={item.href}>
                  <Button
                    variant={isActive ? &apos;default&apos; : &apos;ghost&apos;}
                    className=&quot;w-full justify-start&quot;
                  >
                    <Icon className=&quot;mr-3 h-5 w-5&quot; />
                    {item.name}
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <div className=&quot;_lg:pl-64&quot;>
        {/* Top bar */}
        <div className=&quot;sticky top-0 z-10 flex h-16 bg-white _dark:bg-gray-800 border-b border-gray-200 _dark:border-gray-700 _lg:hidden&quot;>
          <button
            type=&quot;button&quot;
            className=&quot;px-4 text-gray-500 _focus:outline-none _focus:ring-2 _focus:ring-inset _focus:ring-blue-500&quot;
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className=&quot;h-6 w-6&quot; />
          </button>
          <div className=&quot;flex flex-1 justify-between px-4&quot;>
            <div className=&quot;flex flex-1 items-center&quot;>
              <h1 className=&quot;text-lg font-semibold text-gray-900 _dark:text-white&quot;>ChainSync</h1>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className=&quot;flex-1&quot;>
          {children}
        </main>
      </div>
    </div>
  );
}
