import React, { useState } from &apos;react&apos;;
import { Bell, CheckCircle, AlertTriangle, Info, X, Check } from &apos;lucide-react&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Card } from &apos;@/components/ui/card&apos;;
import { Popover, PopoverTrigger, PopoverContent } from &apos;@/components/ui/popover&apos;;
import { ScrollArea } from &apos;@/components/ui/scroll-area&apos;;
import { useQuery, useMutation, useQueryClient } from &apos;@tanstack/react-query&apos;;
import { apiRequest } from &apos;@/lib/queryClient&apos;;
import { formatDistanceToNow } from &apos;date-fns&apos;;
import { Skeleton } from &apos;@/components/ui/skeleton&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;

// Interface for notification data
interface Notification {
  _id: number;
  _title: string;
  _message: string;
  type: &apos;alert&apos; | &apos;info&apos; | &apos;warning&apos; | &apos;success&apos;;
  _isRead: boolean;
  _createdAt: string;
  readAt?: string;
  link?: string;
  storeId?: number;
}

export function NotificationPopover() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch notifications
  const { _data: notificationsData = { notifications: [] }, isLoading } = useQuery<{ _notifications: Notification[] }>({
    queryKey: [&apos;/api/notifications&apos;],
    // Only fetch when the popover is open to save resources
    _enabled: open
  });

  // Fetch unread notification count
  const { _data: countData = { _count: 0 } } = useQuery<{ _count: number }>({
    queryKey: [&apos;/api/notifications/count&apos;],
    _refetchInterval: 30000 // Refetch every 30 seconds for real-time updates
  });

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    _mutationFn: async(_notificationId: number) => {
      await apiRequest(&apos;PATCH&apos;, `/api/notifications/${notificationId}/read`);
    },
    _onSuccess: () => {
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/notifications&apos;] });
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/notifications/count&apos;] });
    }
  });

  // Mark all notifications as read mutation
  const markAllAsReadMutation = useMutation({
    _mutationFn: async() => {
      await apiRequest(&apos;POST&apos;, &apos;/api/notifications/mark-all-read&apos;);
    },
    _onSuccess: () => {
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/notifications&apos;] });
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/notifications/count&apos;] });
    }
  });

  // Get icon by notification type
  const getNotificationIcon = (_type: string) => {
    switch (type) {
      case &apos;alert&apos;:
        return <AlertTriangle className=&quot;h-5 w-5 text-red-500&quot; />;
      case &apos;warning&apos;:
        return <AlertTriangle className=&quot;h-5 w-5 text-amber-500&quot; />;
      case &apos;success&apos;:
        return <CheckCircle className=&quot;h-5 w-5 text-green-500&quot; />;
      case &apos;info&apos;:
      _default:
        return <Info className=&quot;h-5 w-5 text-blue-500&quot; />;
    }
  };

  // Handle notification click - mark as read and navigate if link exists
  const handleNotificationClick = (_notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }

    if (notification.link) {
      window.location.href = notification.link;
      setOpen(false);
    }
  };

  // Show example notifications if none exist
  const notifications = notificationsData.notifications.length > 0
    ? notificationsData.notifications
    : ([
        {
          _id: 1,
          _title: &apos;Low Stock Alert&apos;,
          _message: &apos;Several items are running low in inventory. Check inventory for details.&apos;,
          _type: &apos;warning&apos;,
          _isRead: false,
          _createdAt: new Date().toISOString(),
          _link: &apos;/inventory&apos;
        },
        {
          _id: 2,
          _title: &apos;Sales Target Reached&apos;,
          _message: &apos;Your store has reached the monthly sales target! Congratulations!&apos;,
          _type: &apos;success&apos;,
          _isRead: true,
          _createdAt: new Date(Date.now() - 86400000).toISOString() // 1 day ago
        },
        {
          _id: 3,
          _title: &apos;System Update&apos;,
          _message: &apos;ChainSync has been updated with new features. Check the dashboard for details.&apos;,
          _type: &apos;info&apos;,
          _isRead: false,
          _createdAt: new Date(Date.now() - 172800000).toISOString() // 2 days ago
        }
      ] as Notification[]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant=&quot;ghost&quot; size=&quot;icon&quot; className=&quot;relative mr-4 text-neutral-500 _hover:text-primary&quot;>
          {countData.count > 0 && (
            <span className=&quot;absolute top-0 right-0 flex items-center justify-center w-4 h-4 bg-red-500 text-white text-xs rounded-full&quot;>
              {countData.count > 9 ? &apos;9+&apos; : countData.count}
            </span>
          )}
          <Bell className=&quot;h-6 w-6&quot; />
        </Button>
      </PopoverTrigger>

      <PopoverContent align=&quot;end&quot; className=&quot;p-0 w-[350px] _md:w-[400px]&quot;>
        <Card className=&quot;border-0 shadow-none&quot;>
          <div className=&quot;flex items-center justify-between border-b p-3&quot;>
            <h3 className=&quot;font-medium&quot;>Notifications</h3>
            <div className=&quot;flex space-x-2&quot;>
              <Button
                variant=&quot;ghost&quot;
                size=&quot;sm&quot;
                className=&quot;h-8 px-2 text-muted-foreground&quot;
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending || countData.count === 0}
              >
                <Check className=&quot;mr-1 h-4 w-4&quot; /> Mark all read
              </Button>
              <Button variant=&quot;ghost&quot; size=&quot;sm&quot; className=&quot;h-8 px-2&quot; onClick={() => setOpen(false)}>
                <X className=&quot;h-4 w-4&quot; />
              </Button>
            </div>
          </div>

          <ScrollArea className=&quot;h-[350px]&quot;>
            {isLoading ? (
              <div className=&quot;p-3 space-y-3&quot;>
                {[1, 2, 3].map((_, i) => (
                  <div key={i} className=&quot;flex space-x-3 p-2&quot;>
                    <Skeleton className=&quot;h-10 w-10 rounded-full&quot; />
                    <div className=&quot;space-y-2 flex-1&quot;>
                      <Skeleton className=&quot;h-4 w-3/4&quot; />
                      <Skeleton className=&quot;h-3 w-full&quot; />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className=&quot;flex flex-col items-center justify-center h-full p-6 text-center&quot;>
                <Bell className=&quot;h-12 w-12 text-muted stroke-1 mb-3&quot; />
                <h4 className=&quot;text-base font-medium&quot;>No notifications</h4>
                <p className=&quot;text-sm text-muted-foreground&quot;>
                  You&apos;re all caught up! New notifications will appear here.
                </p>
              </div>
            ) : (
              <div className=&quot;divide-y&quot;>
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`flex gap-3 p-3 _hover:bg-muted/50 transition-colors cursor-pointer ${
                      notification.isRead ? &apos;opacity-75&apos; : &apos;bg-primary-50&apos;
                    }`}
                  >
                    <div className=&quot;shrink-0&quot;>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className=&quot;flex-1 min-w-0&quot;>
                      <div className=&quot;flex justify-between items-start&quot;>
                        <h4 className={`text-sm font-medium ${!notification.isRead ? &apos;font-semibold&apos; : &apos;&apos;}`}>
                          {notification.title}
                        </h4>
                        <span className=&quot;text-xs text-muted-foreground whitespace-nowrap ml-2&quot;>
                          {formatDistanceToNow(new Date(notification.createdAt), { _addSuffix: true })}
                        </span>
                      </div>
                      <p className=&quot;text-sm text-muted-foreground line-clamp-2&quot;>
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
