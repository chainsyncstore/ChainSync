import { useAuth } from &apos;@/providers/auth-provider&apos;;
import { AppShell } from &apos;@/components/layout/app-shell&apos;;
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from &apos;@/components/ui/card&apos;;
import { Label } from &apos;@/components/ui/label&apos;;
import { ArrowLeft } from &apos;lucide-react&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Link } from &apos;wouter&apos;;
import { formatDate } from &apos;@/lib/utils&apos;;

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <AppShell>
        <div className=&quot;flex items-center justify-center h-[80vh]&quot;>
          <div className=&quot;text-center p-8 bg-destructive/10 rounded-lg max-w-md&quot;>
            <h1 className=&quot;text-xl font-semibold mb-4&quot;>Not Authenticated</h1>
            <p>Please log in to view your profile.</p>
            <Button asChild className=&quot;mt-4&quot;>
              <Link href=&quot;/login&quot;>Log In</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className=&quot;flex items-center justify-between mb-6&quot;>
        <div>
          <h1 className=&quot;text-2xl font-bold text-neutral-800&quot;>Your Profile</h1>
          <p className=&quot;text-neutral-500 mt-1&quot;>View and manage your account information</p>
        </div>
        <Button variant=&quot;outline&quot; asChild>
          <Link href=&quot;/dashboard&quot;>
            <ArrowLeft className=&quot;mr-2 h-4 w-4&quot; />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <div className=&quot;grid grid-cols-1 _md:grid-cols-2 gap-6&quot;>
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Your basic account details</CardDescription>
          </CardHeader>
          <CardContent className=&quot;space-y-4&quot;>
            <div className=&quot;space-y-2&quot;>
              <Label className=&quot;text-muted-foreground&quot;>Full Name</Label>
              <p className=&quot;text-lg font-medium&quot;>{user.fullName}</p>
            </div>

            <div className=&quot;space-y-2&quot;>
              <Label className=&quot;text-muted-foreground&quot;>Email Address</Label>
              <p className=&quot;text-lg&quot;>{user.email}</p>
            </div>

            <div className=&quot;space-y-2&quot;>
              <Label className=&quot;text-muted-foreground&quot;>Username</Label>
              <p className=&quot;text-lg&quot;>{user.username}</p>
            </div>

            <div className=&quot;space-y-2&quot;>
              <Label className=&quot;text-muted-foreground&quot;>Role</Label>
              <p className=&quot;text-lg capitalize&quot;>{user.role}</p>
            </div>

            <div className=&quot;space-y-2&quot;>
              <Label className=&quot;text-muted-foreground&quot;>User ID</Label>
              <p className=&quot;text-lg&quot;>{user.id}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Details about your account</CardDescription>
          </CardHeader>
          <CardContent className=&quot;space-y-4&quot;>
            {user.storeId && (
              <div className=&quot;space-y-2&quot;>
                <Label className=&quot;text-muted-foreground&quot;>Assigned Store ID</Label>
                <p className=&quot;text-lg&quot;>{user.storeId}</p>
              </div>
            )}

            <div className=&quot;space-y-2&quot;>
              <Label className=&quot;text-muted-foreground&quot;>Account Created</Label>
              <p className=&quot;text-lg&quot;>{formatDate(user.createdAt)}</p>
            </div>

            {user.lastLogin && (
              <div className=&quot;space-y-2&quot;>
                <Label className=&quot;text-muted-foreground&quot;>Last Login</Label>
                <p className=&quot;text-lg&quot;>{formatDate(user.lastLogin)}</p>
              </div>
            )}

            <div className=&quot;space-y-2&quot;>
              <Label className=&quot;text-muted-foreground&quot;>Account Updated</Label>
              <p className=&quot;text-lg&quot;>{formatDate(user.updatedAt)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
