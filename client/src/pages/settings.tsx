import React from &apos;react&apos;;
import { AppShell } from &apos;@/components/layout/app-shell&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import { Tabs, TabsContent, TabsList, TabsTrigger } from &apos;@/components/ui/tabs&apos;;
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from &apos;@/components/ui/card&apos;;
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from &apos;@/components/ui/form&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Switch } from &apos;@/components/ui/switch&apos;;
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from &apos;@/components/ui/select&apos;;
import { Separator } from &apos;@/components/ui/separator&apos;;
import { z } from &apos;zod&apos;;
import { useForm } from &apos;react-hook-form&apos;;
import { zodResolver } from &apos;@hookform/resolvers/zod&apos;;
import { useToast } from &apos;@/hooks/use-toast&apos;;
import CategoryManagement from &apos;@/components/inventory/category-management&apos;;

// Profile settings form schema
const profileFormSchema = z.object({
  _fullName: z.string().min(2, {
    _message: &apos;Name must be at least 2 characters.&apos;
  }),
  _email: z.string().email({
    _message: &apos;Please enter a valid email address.&apos;
  }),
  _currentPassword: z.string().optional(),
  _newPassword: z.string().min(6, {
    _message: &apos;New password must be at least 6 characters.&apos;
  }).optional(),
  _confirmPassword: z.string().optional()
}).refine((data) => {
  if (data.newPassword && !data.currentPassword) {
    return false;
  }
  return true;
}, {
  _message: &apos;Current password is required to set a new password.&apos;,
  _path: [&apos;currentPassword&apos;]
}).refine((data) => {
  if (data.newPassword && data.newPassword !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  _message: &quot;Passwords don&apos;t match.&quot;,
  _path: [&apos;confirmPassword&apos;]
});

// System settings form schema
const systemFormSchema = z.object({
  _taxRate: z.string(),
  _currency: z.string(),
  _receiptHeader: z.string(),
  _receiptFooter: z.string(),
  _lowStockThreshold: z.string(),
  _enableOfflineMode: z.boolean(),
  _autoBackupEnabled: z.boolean(),
  _backupFrequency: z.string()
});

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [lowStockAlerts, setLowStockAlerts] = React.useState(true);
  const [salesSummary, setSalesSummary] = React.useState(true);
  const [securityAlerts, setSecurityAlerts] = React.useState(true);
  const [salesMilestones, setSalesMilestones] = React.useState(true);
  const [inventoryAlerts, setInventoryAlerts] = React.useState(true);
  const [userActivity, setUserActivity] = React.useState(false);

  // Profile form
  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    _resolver: zodResolver(profileFormSchema),
    _defaultValues: {
      _fullName: user?.fullName || &apos;&apos;,
      _email: user?.email || &apos;&apos;,
      _currentPassword: &apos;&apos;,
      _newPassword: &apos;&apos;,
      _confirmPassword: &apos;&apos;
    }
  });

  // System settings form
  const systemForm = useForm<z.infer<typeof systemFormSchema>>({
    _resolver: zodResolver(systemFormSchema),
    _defaultValues: {
      taxRate: &apos;8.25&apos;,
      _currency: &apos;USD&apos;,
      _receiptHeader: &apos;ChainSync Market&apos;,
      _receiptFooter: &apos;Thank you for shopping with us!&apos;,
      _lowStockThreshold: &apos;10&apos;,
      _enableOfflineMode: true,
      _autoBackupEnabled: true,
      _backupFrequency: &apos;daily&apos;
    }
  });

  // Handle profile form submission with temporary real password functionality
  const onProfileSubmit = async(_data: z.infer<typeof profileFormSchema>) => {
    try {
      // Store password in localStorage for testing purposes
      if (data.newPassword) {
        // In a real app, we&apos;d make an API call to update the password
        localStorage.setItem(&apos;tempTestPassword&apos;, data.newPassword);

        // Reset password fields after successful submission
        profileForm.setValue(&apos;currentPassword&apos;, &apos;&apos;);
        profileForm.setValue(&apos;newPassword&apos;, &apos;&apos;);
        profileForm.setValue(&apos;confirmPassword&apos;, &apos;&apos;);
      }

      // Update user profile info in localStorage for testing
      localStorage.setItem(&apos;userProfile&apos;, JSON.stringify({
        _fullName: data.fullName,
        _email: data.email,
        _updatedAt: new Date().toISOString()
      }));

      toast({
        _title: &apos;Profile updated&apos;,
        _description: &apos;Your profile has been updated successfully. Password is now stored for testing.&apos;,
        _duration: 5000
      });

      console.log(&apos;Updated profile _data:&apos;, data);
    } catch (error) {
      console.error(&apos;Error updating _profile:&apos;, error);
      toast({
        _title: &apos;Update failed&apos;,
        _description: &apos;There was a problem updating your profile.&apos;,
        _variant: &apos;destructive&apos;
      });
    }
  };

  // Handle system settings form submission with enhanced functionality for testing
  const onSystemSubmit = async(_data: z.infer<typeof systemFormSchema>) => {
    try {
      // In a real app, we&apos;d send these settings to an API
      // Store system settings in localStorage for testing purposes
      localStorage.setItem(&apos;systemSettings&apos;, JSON.stringify({
        ...data,
        _updatedAt: new Date().toISOString()
      }));

      toast({
        _title: &apos;Settings updated&apos;,
        _description: &apos;System settings have been saved and are ready for testing.&apos;,
        _duration: 5000
      });

      console.log(&apos;Updated system _settings:&apos;, data);
    } catch (error) {
      console.error(&apos;Error updating system _settings:&apos;, error);
      toast({
        _title: &apos;Update failed&apos;,
        _description: &apos;There was a problem updating system settings.&apos;,
        _variant: &apos;destructive&apos;
      });
    }
  };

  // Handle notification preferences saving
  const saveNotificationPreferences = () => {
    try {
      // Store notification preferences in localStorage for testing
      const notificationSettings = {
        _emailNotifications: {
          lowStockAlerts,
          salesSummary,
          securityAlerts
        },
        _inAppNotifications: {
          salesMilestones,
          inventoryAlerts,
          userActivity
        },
        _updatedAt: new Date().toISOString()
      };

      localStorage.setItem(&apos;notificationPreferences&apos;, JSON.stringify(notificationSettings));

      toast({
        _title: &apos;Notification preferences updated&apos;,
        _description: &apos;Your notification preferences have been saved and are ready for testing.&apos;,
        _duration: 5000
      });

      console.log(&apos;Updated notification _preferences:&apos;, notificationSettings);
    } catch (error) {
      console.error(&apos;Error updating notification _preferences:&apos;, error);
      toast({
        _title: &apos;Update failed&apos;,
        _description: &apos;There was a problem updating your notification preferences.&apos;,
        _variant: &apos;destructive&apos;
      });
    }
  };

  return (
    <AppShell>
      <div className=&quot;mb-6&quot;>
        <h1 className=&quot;text-2xl font-bold text-neutral-800&quot;>Settings</h1>
        <p className=&quot;text-neutral-500 mt-1&quot;>Manage your account and system preferences</p>
      </div>

      <Tabs defaultValue=&quot;profile&quot; className=&quot;space-y-4&quot;>
        <TabsList>
          <TabsTrigger value=&quot;profile&quot;>Profile</TabsTrigger>
          <TabsTrigger value=&quot;system&quot;>System</TabsTrigger>
          <TabsTrigger value=&quot;notifications&quot;>Notifications</TabsTrigger>
          <TabsTrigger value=&quot;categories&quot;>Categories</TabsTrigger>
        </TabsList>

        {/* Profile Settings */}
        <TabsContent value=&quot;profile&quot;>
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                Manage your personal information and change your password
              </CardDescription>
            </CardHeader>
            <CardContent className=&quot;space-y-6&quot;>
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className=&quot;space-y-6&quot;>
                  {/* Personal Information */}
                  <div className=&quot;space-y-4&quot;>
                    <h3 className=&quot;text-lg font-medium&quot;>Personal Information</h3>

                    <FormField
                      control={profileForm.control}
                      name=&quot;fullName&quot;
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name=&quot;email&quot;
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <FormControl>
                        <Input value={user?.role || &apos;&apos;} disabled />
                      </FormControl>
                      <FormDescription>
                        Your role cannot be changed. Contact an administrator if you need a role change.
                      </FormDescription>
                    </FormItem>
                  </div>

                  <Separator />

                  {/* Change Password */}
                  <div className=&quot;space-y-4&quot;>
                    <h3 className=&quot;text-lg font-medium&quot;>Change Password</h3>

                    <FormField
                      control={profileForm.control}
                      name=&quot;currentPassword&quot;
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <Input type=&quot;password&quot; {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name=&quot;newPassword&quot;
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <Input type=&quot;password&quot; {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name=&quot;confirmPassword&quot;
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm New Password</FormLabel>
                          <FormControl>
                            <Input type=&quot;password&quot; {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type=&quot;submit&quot;>Update Profile</Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Settings */}
        <TabsContent value=&quot;system&quot;>
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>
                Configure system-wide settings for your store
              </CardDescription>
            </CardHeader>
            <CardContent className=&quot;space-y-6&quot;>
              <Form {...systemForm}>
                <form onSubmit={systemForm.handleSubmit(onSystemSubmit)} className=&quot;space-y-6&quot;>
                  {/* Basic Settings */}
                  <div className=&quot;space-y-4&quot;>
                    <h3 className=&quot;text-lg font-medium&quot;>Basic Settings</h3>

                    <div className=&quot;grid grid-cols-2 gap-4&quot;>
                      <FormField
                        control={systemForm.control}
                        name=&quot;taxRate&quot;
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Default Tax Rate (%)</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormDescription>
                              The tax rate applied to transactions
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={systemForm.control}
                        name=&quot;currency&quot;
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Currency</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder=&quot;Select currency&quot; />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value=&quot;USD&quot;>USD - US Dollar</SelectItem>
                                <SelectItem value=&quot;NGN&quot;>NGN - Nigerian Naira</SelectItem>
                                <SelectItem value=&quot;EUR&quot;>EUR - Euro</SelectItem>
                                <SelectItem value=&quot;GBP&quot;>GBP - British Pound</SelectItem>
                                <SelectItem value=&quot;CAD&quot;>CAD - Canadian Dollar</SelectItem>
                                <SelectItem value=&quot;AUD&quot;>AUD - Australian Dollar</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Currency used throughout the system
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={systemForm.control}
                      name=&quot;lowStockThreshold&quot;
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Default Low Stock Threshold</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormDescription>
                            The default minimum quantity for inventory items
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  {/* Receipt Settings */}
                  <div className=&quot;space-y-4&quot;>
                    <h3 className=&quot;text-lg font-medium&quot;>Receipt Settings</h3>

                    <FormField
                      control={systemForm.control}
                      name=&quot;receiptHeader&quot;
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Receipt Header</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormDescription>
                            Text displayed at the top of each receipt
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={systemForm.control}
                      name=&quot;receiptFooter&quot;
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Receipt Footer</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormDescription>
                            Text displayed at the bottom of each receipt
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  {/* Advanced Settings */}
                  <div className=&quot;space-y-4&quot;>
                    <h3 className=&quot;text-lg font-medium&quot;>Advanced Settings</h3>

                    <FormField
                      control={systemForm.control}
                      name=&quot;enableOfflineMode&quot;
                      render={({ field }) => (
                        <FormItem className=&quot;flex flex-row items-center justify-between rounded-lg border p-4&quot;>
                          <div className=&quot;space-y-0.5&quot;>
                            <FormLabel className=&quot;text-base&quot;>Enable Offline Mode</FormLabel>
                            <FormDescription>
                              Allow the POS system to function without internet connection
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={systemForm.control}
                      name=&quot;autoBackupEnabled&quot;
                      render={({ field }) => (
                        <FormItem className=&quot;flex flex-row items-center justify-between rounded-lg border p-4&quot;>
                          <div className=&quot;space-y-0.5&quot;>
                            <FormLabel className=&quot;text-base&quot;>Automatic Backups</FormLabel>
                            <FormDescription>
                              Automatically create backups of your data
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {systemForm.watch(&apos;autoBackupEnabled&apos;) && (
                      <FormField
                        control={systemForm.control}
                        name=&quot;backupFrequency&quot;
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Backup Frequency</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder=&quot;Select frequency&quot; />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value=&quot;hourly&quot;>Hourly</SelectItem>
                                <SelectItem value=&quot;daily&quot;>Daily</SelectItem>
                                <SelectItem value=&quot;weekly&quot;>Weekly</SelectItem>
                                <SelectItem value=&quot;monthly&quot;>Monthly</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              How often backups are created
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  <Button type=&quot;submit&quot;>Save Settings</Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Settings */}
        <TabsContent value=&quot;notifications&quot;>
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Configure how and when you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className=&quot;space-y-4&quot;>
              <div className=&quot;space-y-4&quot;>
                <h3 className=&quot;text-lg font-medium&quot;>Email Notifications</h3>

                <div className=&quot;space-y-2&quot;>
                  <div className=&quot;flex items-center justify-between rounded-lg border p-4&quot;>
                    <div className=&quot;space-y-0.5&quot;>
                      <h4 className=&quot;text-base font-medium&quot;>Low Stock Alerts</h4>
                      <p className=&quot;text-sm text-muted-foreground&quot;>
                        Receive emails when inventory items reach their minimum stock level
                      </p>
                    </div>
                    <Switch
                      checked={lowStockAlerts}
                      onCheckedChange={setLowStockAlerts}
                    />
                  </div>

                  <div className=&quot;flex items-center justify-between rounded-lg border p-4&quot;>
                    <div className=&quot;space-y-0.5&quot;>
                      <h4 className=&quot;text-base font-medium&quot;>Daily Sales Summary</h4>
                      <p className=&quot;text-sm text-muted-foreground&quot;>
                        Receive a daily summary of sales across all stores
                      </p>
                    </div>
                    <Switch
                      checked={salesSummary}
                      onCheckedChange={setSalesSummary}
                    />
                  </div>

                  <div className=&quot;flex items-center justify-between rounded-lg border p-4&quot;>
                    <div className=&quot;space-y-0.5&quot;>
                      <h4 className=&quot;text-base font-medium&quot;>Security Alerts</h4>
                      <p className=&quot;text-sm text-muted-foreground&quot;>
                        Receive notifications about security events like login attempts
                      </p>
                    </div>
                    <Switch
                      checked={securityAlerts}
                      onCheckedChange={setSecurityAlerts}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className=&quot;space-y-4&quot;>
                <h3 className=&quot;text-lg font-medium&quot;>In-App Notifications</h3>

                <div className=&quot;space-y-2&quot;>
                  <div className=&quot;flex items-center justify-between rounded-lg border p-4&quot;>
                    <div className=&quot;space-y-0.5&quot;>
                      <h4 className=&quot;text-base font-medium&quot;>Sales Milestone Alerts</h4>
                      <p className=&quot;text-sm text-muted-foreground&quot;>
                        Receive notifications when sales targets are reached
                      </p>
                    </div>
                    <Switch
                      checked={salesMilestones}
                      onCheckedChange={setSalesMilestones}
                    />
                  </div>

                  <div className=&quot;flex items-center justify-between rounded-lg border p-4&quot;>
                    <div className=&quot;space-y-0.5&quot;>
                      <h4 className=&quot;text-base font-medium&quot;>Inventory Alerts</h4>
                      <p className=&quot;text-sm text-muted-foreground&quot;>
                        Notifications for low stock, expiring items, and other inventory events
                      </p>
                    </div>
                    <Switch
                      checked={inventoryAlerts}
                      onCheckedChange={setInventoryAlerts}
                    />
                  </div>

                  <div className=&quot;flex items-center justify-between rounded-lg border p-4&quot;>
                    <div className=&quot;space-y-0.5&quot;>
                      <h4 className=&quot;text-base font-medium&quot;>User Activity</h4>
                      <p className=&quot;text-sm text-muted-foreground&quot;>
                        Notifications about user logins and important account activities
                      </p>
                    </div>
                    <Switch
                      checked={userActivity}
                      onCheckedChange={setUserActivity}
                    />
                  </div>
                </div>
              </div>

              <div className=&quot;pt-4&quot;>
                <Button onClick={saveNotificationPreferences}>Save Preferences</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Management */}
        <TabsContent value=&quot;categories&quot;>
          <CategoryManagement />
        </TabsContent>

      </Tabs>
    </AppShell>
  );
}
