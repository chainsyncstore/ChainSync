import React, { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/providers/auth-provider';
import { User } from '@/providers/auth-provider';
import { getInitials } from '@/lib/utils';
import { 
  Menu, 
  Search, 
  Bell, 
  MessageSquare, 
  LogOut, 
  User as UserIcon,
  Store,
  Settings
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  user: User;
  onMenuClick: () => void;
  isSidebarOpen: boolean;
}

export function Header({ user, onMenuClick, isSidebarOpen }: HeaderProps) {
  const { logout } = useAuth();
  const [searchValue, setSearchValue] = useState('');
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle search logic here
    console.log('Searching for:', searchValue);
  };
  
  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="bg-white border-b border-neutral-200 shadow-sm">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onMenuClick} 
            className="md:hidden text-neutral-500 mr-2"
          >
            <Menu className="h-6 w-6" />
          </Button>
          
          {user.role !== 'cashier' && (
            <form onSubmit={handleSearch} className="hidden md:block relative ml-4">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
              <Input
                type="search"
                placeholder="Search..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="pl-9 pr-4 py-2 w-64 rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </form>
          )}
        </div>
        
        <div className="flex items-center">
          {/* AI Assistant Button */}
          {user.role !== 'cashier' && (
            <Button variant="ghost" size="icon" className="relative mr-4 text-neutral-500 hover:text-primary">
              <span className="absolute top-0 right-0 w-2 h-2 bg-accent rounded-full"></span>
              <Link href="/dashboard">
                <MessageSquare className="h-6 w-6" />
              </Link>
            </Button>
          )}
          
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative mr-4 text-neutral-500 hover:text-primary">
            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
            <Bell className="h-6 w-6" />
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center focus:outline-none p-1">
                <span className="hidden md:block mr-2 text-sm font-medium">
                  {user.fullName}
                </span>
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
                  <span className="text-sm font-medium">{getInitials(user.fullName)}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="font-normal">
                  <p className="text-sm font-medium">{user.fullName}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <UserIcon className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                {user.role !== 'cashier' && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/stores">
                        <Store className="mr-2 h-4 w-4" />
                        <span>Stores</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
