import React from "react";
import { useLocation, Link } from "wouter";
import {
  Activity,
  Home,
  Package,
  ShoppingCart,
  Store,
  Users,
  Settings,
  LogOut,
  BarChart3,
  RotateCcw,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useMobileDetect } from "@/hooks/use-mobile";
import { useAuth } from "@/providers/auth-provider";

interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  items: {
    href: string;
    title: string;
    icon: React.ReactNode;
    roles?: string[];
  }[];
}

interface AppShellProps {
  children: React.ReactNode;
}

export function SidebarNav({ items, className, ...props }: SidebarNavProps) {
  const [location] = useLocation();
  const { user } = useAuth();

  return (
    <nav className={cn("flex flex-col space-y-1", className)} {...props}>
      {items
        .filter((item) => !item.roles || item.roles.includes(user?.role || ""))
        .map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors",
              location === item.href
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground"
            )}
          >
            {item.icon}
            {item.title}
          </Link>
        ))}
    </nav>
  );
}

export function AppShell({ children }: AppShellProps) {
  const { isMobile } = useMobileDetect();
  const { logout, user } = useAuth();
  const [location, setLocation] = useLocation();
  const [isOpen, setIsOpen] = React.useState(false);

  const navItems = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: <Home className="h-4 w-4" />,
      roles: ["admin", "manager"],
    },
    {
      title: "POS",
      href: "/pos",
      icon: <ShoppingCart className="h-4 w-4" />,
      roles: ["admin", "manager", "cashier"],
    },
    {
      title: "Inventory",
      href: "/inventory",
      icon: <Package className="h-4 w-4" />,
      roles: ["admin", "manager"],
    },
    {
      title: "Stores",
      href: "/stores",
      icon: <Store className="h-4 w-4" />,
      roles: ["admin", "manager"],
    },
    {
      title: "Transactions",
      href: "/transactions",
      icon: <Activity className="h-4 w-4" />,
      roles: ["admin", "manager", "cashier"],
    },
    {
      title: "Refunds",
      href: "/refunds",
      icon: <RotateCcw className="h-4 w-4" />,
      roles: ["admin", "manager"],
    },
    {
      title: "Analytics",
      href: "/analytics",
      icon: <BarChart3 className="h-4 w-4" />,
      roles: ["admin", "manager"],
    },
    {
      title: "Users",
      href: "/users",
      icon: <Users className="h-4 w-4" />,
      roles: ["admin"],
    },
    {
      title: "Settings",
      href: "/settings",
      icon: <Settings className="h-4 w-4" />,
      roles: ["admin", "manager", "cashier"],
    },
  ];

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  const handleNavigation = () => {
    if (isMobile) {
      setIsOpen(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background flex-col">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            {isMobile && (
              <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="lg:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle Menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="lg:hidden">
                  <div className="flex flex-col h-full">
                    <div className="px-2 py-4 flex items-center justify-between">
                      <Link href="/dashboard" className="flex items-center" onClick={handleNavigation}>
                        <span className="text-xl font-bold">ChainSync</span>
                      </Link>
                      <Button variant="outline" size="icon" onClick={() => setIsOpen(false)}>
                        <X className="h-5 w-5" />
                        <span className="sr-only">Close Menu</span>
                      </Button>
                    </div>
                    <Separator />
                    <ScrollArea className="flex-1 py-4">
                      <SidebarNav items={navItems} className="px-2" />
                    </ScrollArea>
                    <Separator />
                    <div className="py-4 px-2">
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={handleLogout}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            )}

            <Link href="/dashboard" className="flex items-center" onClick={handleNavigation}>
              <span className="text-xl font-bold hidden sm:inline-block">
                ChainSync
              </span>
              <span className="text-xl font-bold sm:hidden">CS</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-2">
                <div className="text-sm hidden md:block">
                  <p className="font-medium">{user.fullName}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {user.role}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  <span className="sr-only">Logout</span>
                </Button>
              </div>
            ) : (
              <Button variant="default" onClick={() => setLocation("/login")}>
                Sign In
              </Button>
            )}
          </div>
        </div>
      </header>
      <div className="flex flex-1">
        {!isMobile && (
          <aside className="w-[250px] border-r bg-background hidden lg:block">
            <ScrollArea className="h-[calc(100vh-4rem)] py-6">
              <SidebarNav items={navItems} className="px-4" />
            </ScrollArea>
          </aside>
        )}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}