import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Bell, CheckCircle, AlertTriangle, Info, X, Check } from 'lucide-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/providers/auth-provider';

// Interface for notification data
interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'alert' | 'info' | 'warning' | 'success';
  isRead: boolean;
  createdAt: string;
  readAt?: string;
  link?: string;
  storeId?: number;
}

export function NotificationPopover() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data: notificationsData = { notifications: [] }, isLoading } = useQuery<{
    notifications: Notification[];
  }>({
    queryKey: ['/api/notifications'],
    // Only fetch when the popover is open to save resources
    enabled: open,
  });

  // Fetch unread notification count
  const { data: countData = { count: 0 } } = useQuery<{ count: number }>({
    queryKey: ['/api/notifications/count'],
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      await apiRequest('PATCH', `/api/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/count'] });
    },
  });

  // Mark all notifications as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/notifications/mark-all-read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/count'] });
    },
  });

  // Get icon by notification type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'alert':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'info':
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  // Handle notification click - mark as read and navigate if link exists
  const handleNotificationClick = (notification: Notification) => {
    // Ensure notification type is valid before proceeding
    const validTypes: Notification['type'][] = ['alert', 'info', 'warning', 'success'];
    if (!validTypes.includes(notification.type)) {
      console.error('Invalid notification type:', notification.type);
      // Optionally, handle this error, e.g., by not processing the click
      // or by defaulting to a safe type if appropriate.
      // For now, we'll just prevent further processing for invalid types.
      return;
    }

    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }

    if (notification.link) {
      window.location.href = notification.link;
      setOpen(false);
    }
  };

  // Show example notifications if none exist
  const notifications: Notification[] =
    notificationsData.notifications.length > 0
      ? notificationsData.notifications
      : [
          {
            id: 1,
            title: 'Low Stock Alert',
            message: 'Several items are running low in inventory. Check inventory for details.',
            type: 'warning',
            isRead: false,
            createdAt: new Date().toISOString(),
            link: '/inventory',
          },
          {
            id: 2,
            title: 'Sales Target Reached',
            message: 'Your store has reached the monthly sales target! Congratulations!',
            type: 'success',
            isRead: true,
            createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          },
          {
            id: 3,
            title: 'System Update',
            message:
              'ChainSync has been updated with new features. Check the dashboard for details.',
            type: 'info',
            isRead: false,
            createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          },
        ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative mr-4 text-neutral-500 hover:text-primary"
        >
          {countData.count > 0 && (
            <span className="absolute top-0 right-0 flex items-center justify-center w-4 h-4 bg-red-500 text-white text-xs rounded-full">
              {countData.count > 9 ? '9+' : countData.count}
            </span>
          )}
          <Bell className="h-6 w-6" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="p-0 w-[350px] md:w-[400px]">
        <Card className="border-0 shadow-none">
          <div className="flex items-center justify-between border-b p-3">
            <h3 className="font-medium">Notifications</h3>
            <div className="flex space-x-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-muted-foreground"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending || countData.count === 0}
              >
                <Check className="mr-1 h-4 w-4" /> Mark all read
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[350px]">
            {isLoading ? (
              <div className="p-3 space-y-3">
                {[1, 2, 3].map((_, i) => (
                  <div key={i} className="flex space-x-3 p-2">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <Bell className="h-12 w-12 text-muted stroke-1 mb-3" />
                <h4 className="text-base font-medium">No notifications</h4>
                <p className="text-sm text-muted-foreground">
                  You're all caught up! New notifications will appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map(notification => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`flex gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer ${
                      notification.isRead ? 'opacity-75' : 'bg-primary-50'
                    }`}
                  >
                    <div className="shrink-0">{getNotificationIcon(notification.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h4
                          className={`text-sm font-medium ${!notification.isRead ? 'font-semibold' : ''}`}
                        >
                          {notification.title}
                        </h4>
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                          {formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
