import React, { useState } from &apos;react&apos;;
import { Link } from &apos;wouter&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import { User } from &apos;@/providers/auth-provider&apos;;
import { getInitials } from &apos;@/lib/utils&apos;;
import {
  Menu,
  Search,
  LogOut,
  User as UserIcon,
  Store,
  Settings
} from &apos;lucide-react&apos;;
import { MessagePopover } from &apos;@/components/ui/message-popover&apos;;
import { NotificationPopover } from &apos;@/components/ui/notification-popover&apos;;
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from &apos;@/components/ui/dropdown-menu&apos;;
import { Badge } from &apos;@/components/ui/badge&apos;;

interface HeaderProps {
  _user: User;
  onMenuClick: () => void;
  _isSidebarOpen: boolean;
}

export function Header({ user, onMenuClick, isSidebarOpen }: HeaderProps) {
  const { logout } = useAuth();
  const [searchValue, setSearchValue] = useState(&apos;&apos;);

  const handleSearch = (_e: React.FormEvent) => {
    e.preventDefault();
    // Handle search logic here
    console.log(&apos;Searching _for:&apos;, searchValue);
  };

  const handleLogout = async() => {
    await logout();
  };

  return (
    <header className=&quot;bg-white border-b border-neutral-200 shadow-sm&quot;>
      <div className=&quot;flex items-center justify-between p-4&quot;>
        <div className=&quot;flex items-center&quot;>
          <Button
            variant=&quot;ghost&quot;
            size=&quot;icon&quot;
            onClick={onMenuClick}
            className=&quot;_md:hidden text-neutral-500 mr-2&quot;
          >
            <Menu className=&quot;h-6 w-6&quot; />
          </Button>

          {user.role !== &apos;cashier&apos; && (
            <form onSubmit={handleSearch} className=&quot;hidden _md:block relative ml-4&quot;>
              <Search className=&quot;absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400&quot; />
              <Input
                type=&quot;search&quot;
                placeholder=&quot;Search...&quot;
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className=&quot;pl-9 pr-4 py-2 w-64 rounded-lg border border-neutral-300 _focus:outline-none _focus:ring-2 _focus:ring-primary _focus:border-transparent&quot;
              />
            </form>
          )}
        </div>

        <div className=&quot;flex items-center&quot;>
          {/* AI Assistant Button */}
          {user.role !== &apos;cashier&apos; && (
            <MessagePopover />
          )}

          {/* Notifications */}
          <NotificationPopover />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant=&quot;ghost&quot; className=&quot;flex items-center _focus:outline-none p-1&quot;>
                <span className=&quot;hidden _md:block mr-2 text-sm font-medium&quot;>
                  {user.fullName}
                </span>
                <div className=&quot;w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white&quot;>
                  <span className=&quot;text-sm font-medium&quot;>{getInitials(user.fullName)}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align=&quot;end&quot; className=&quot;w-56&quot;>
              <DropdownMenuLabel>
                <div className=&quot;font-normal&quot;>
                  <p className=&quot;text-sm font-medium&quot;>{user.fullName}</p>
                  <p className=&quot;text-xs text-muted-foreground&quot;>{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href=&quot;/profile&quot;>
                    <UserIcon className=&quot;mr-2 h-4 w-4&quot; />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                {user.role !== &apos;cashier&apos; && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href=&quot;/stores&quot;>
                        <Store className=&quot;mr-2 h-4 w-4&quot; />
                        <span>Stores</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href=&quot;/settings&quot;>
                        <Settings className=&quot;mr-2 h-4 w-4&quot; />
                        <span>Settings</span>
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className=&quot;mr-2 h-4 w-4&quot; />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
