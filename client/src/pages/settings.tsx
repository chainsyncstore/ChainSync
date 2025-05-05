import React from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/providers/auth-provider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';

// Profile settings form schema
const profileFormSchema = z.object({
  fullName: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, {
    message: "New password must be at least 6 characters.",
  }).optional(),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  if (data.newPassword && !data.currentPassword) {
    return false;
  }
  return true;
}, {
  message: "Current password is required to set a new password.",
  path: ["currentPassword"],
}).refine((data) => {
  if (data.newPassword && data.newPassword !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "Passwords don't match.",
  path: ["confirmPassword"],
});

// System settings form schema
const systemFormSchema = z.object({
  taxRate: z.string(),
  currency: z.string(),
  receiptHeader: z.string(),
  receiptFooter: z.string(),
  lowStockThreshold: z.string(),
  enableOfflineMode: z.boolean(),
  autoBackupEnabled: z.boolean(),
  backupFrequency: z.string(),
});

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Profile form
  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      email: user?.email || "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  
  // System settings form
  const systemForm = useForm<z.infer<typeof systemFormSchema>>({
    resolver: zodResolver(systemFormSchema),
    defaultValues: {
      taxRate: "8.25",
      currency: "USD",
      receiptHeader: "ChainSync Market",
      receiptFooter: "Thank you for shopping with us!",
      lowStockThreshold: "10",
      enableOfflineMode: true,
      autoBackupEnabled: true,
      backupFrequency: "daily",
    },
  });
  
  // Handle profile form submission
  const onProfileSubmit = (data: z.infer<typeof profileFormSchema>) => {
    toast({
      title: "Profile updated",
      description: "Your profile has been updated successfully.",
    });
    console.log(data);
  };
  
  // Handle system settings form submission
  const onSystemSubmit = (data: z.infer<typeof systemFormSchema>) => {
    toast({
      title: "Settings updated",
      description: "System settings have been updated successfully.",
    });
    console.log(data);
  };
  
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-800">Settings</h1>
        <p className="text-neutral-500 mt-1">Manage your account and system preferences</p>
      </div>
      
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>
        
        {/* Profile Settings */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                Manage your personal information and change your password
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                  {/* Personal Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Personal Information</h3>
                    
                    <FormField
                      control={profileForm.control}
                      name="fullName"
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
                      name="email"
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
                        <Input value={user?.role || ""} disabled />
                      </FormControl>
                      <FormDescription>
                        Your role cannot be changed. Contact an administrator if you need a role change.
                      </FormDescription>
                    </FormItem>
                  </div>
                  
                  <Separator />
                  
                  {/* Change Password */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Change Password</h3>
                    
                    <FormField
                      control={profileForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={profileForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={profileForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm New Password</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <Button type="submit">Update Profile</Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* System Settings */}
        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>
                Configure system-wide settings for your store
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Form {...systemForm}>
                <form onSubmit={systemForm.handleSubmit(onSystemSubmit)} className="space-y-6">
                  {/* Basic Settings */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Basic Settings</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={systemForm.control}
                        name="taxRate"
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
                        name="currency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Currency</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select currency" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="USD">USD - US Dollar</SelectItem>
                                <SelectItem value="EUR">EUR - Euro</SelectItem>
                                <SelectItem value="GBP">GBP - British Pound</SelectItem>
                                <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                                <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
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
                      name="lowStockThreshold"
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
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Receipt Settings</h3>
                    
                    <FormField
                      control={systemForm.control}
                      name="receiptHeader"
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
                      name="receiptFooter"
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
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Advanced Settings</h3>
                    
                    <FormField
                      control={systemForm.control}
                      name="enableOfflineMode"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Enable Offline Mode</FormLabel>
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
                      name="autoBackupEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Automatic Backups</FormLabel>
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
                    
                    {systemForm.watch("autoBackupEnabled") && (
                      <FormField
                        control={systemForm.control}
                        name="backupFrequency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Backup Frequency</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select frequency" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="hourly">Hourly</SelectItem>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
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
                  
                  <Button type="submit">Save Settings</Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Notifications Settings */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Configure how and when you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Email Notifications</h3>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <h4 className="text-base font-medium">Low Stock Alerts</h4>
                      <p className="text-sm text-muted-foreground">
                        Receive emails when inventory items reach their minimum stock level
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <h4 className="text-base font-medium">Daily Sales Summary</h4>
                      <p className="text-sm text-muted-foreground">
                        Receive a daily summary of sales across all stores
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <h4 className="text-base font-medium">Security Alerts</h4>
                      <p className="text-sm text-muted-foreground">
                        Receive notifications about security events like login attempts
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium">In-App Notifications</h3>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <h4 className="text-base font-medium">Sales Milestone Alerts</h4>
                      <p className="text-sm text-muted-foreground">
                        Receive notifications when sales targets are reached
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <h4 className="text-base font-medium">Inventory Alerts</h4>
                      <p className="text-sm text-muted-foreground">
                        Notifications for low stock, expiring items, and other inventory events
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <h4 className="text-base font-medium">User Activity</h4>
                      <p className="text-sm text-muted-foreground">
                        Notifications about user logins and important account activities
                      </p>
                    </div>
                    <Switch />
                  </div>
                </div>
              </div>
              
              <div className="pt-4">
                <Button>Save Preferences</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Appearance Settings */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize the look and feel of your ChainSync experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Theme</h3>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg border-2 border-primary p-4 cursor-pointer">
                    <div className="space-y-2">
                      <div className="h-10 rounded-md bg-primary"></div>
                      <div className="space-y-1">
                        <div className="h-2 w-[80%] rounded-lg bg-neutral-200"></div>
                        <div className="h-2 w-[60%] rounded-lg bg-neutral-200"></div>
                      </div>
                    </div>
                    <div className="mt-2 font-medium text-center">Light Mode</div>
                  </div>
                  
                  <div className="rounded-lg border p-4 cursor-pointer">
                    <div className="space-y-2">
                      <div className="h-10 rounded-md bg-neutral-800"></div>
                      <div className="space-y-1">
                        <div className="h-2 w-[80%] rounded-lg bg-neutral-600"></div>
                        <div className="h-2 w-[60%] rounded-lg bg-neutral-700"></div>
                      </div>
                    </div>
                    <div className="mt-2 font-medium text-center">Dark Mode</div>
                  </div>
                  
                  <div className="rounded-lg border p-4 cursor-pointer">
                    <div className="space-y-2">
                      <div className="h-10 rounded-md bg-neutral-200"></div>
                      <div className="space-y-1">
                        <div className="h-2 w-[80%] rounded-lg bg-neutral-400"></div>
                        <div className="h-2 w-[60%] rounded-lg bg-neutral-400"></div>
                      </div>
                    </div>
                    <div className="mt-2 font-medium text-center">System Default</div>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Density</h3>
                
                <div className="flex flex-col space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="radio" name="density" className="form-radio" defaultChecked />
                    <span>Comfortable (Default)</span>
                  </label>
                  
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="radio" name="density" className="form-radio" />
                    <span>Compact</span>
                  </label>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Font Size</h3>
                
                <div className="flex items-center space-x-4">
                  <span className="text-sm">A</span>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    defaultValue="2"
                    className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-lg">A</span>
                </div>
              </div>
              
              <div className="pt-4">
                <Button>Save Appearance</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
