import { Card, CardContent } from &apos;@/components/ui/card&apos;;
import { AlertCircle } from &apos;lucide-react&apos;;

export default function NotFound() {
  return (
    <div className=&quot;min-h-screen w-full flex items-center justify-center bg-gray-50&quot;>
      <Card className=&quot;w-full max-w-md mx-4&quot;>
        <CardContent className=&quot;pt-6&quot;>
          <div className=&quot;flex mb-4 gap-2&quot;>
            <AlertCircle className=&quot;h-8 w-8 text-red-500&quot; size={32} />
            <h1 className=&quot;text-2xl font-bold text-gray-900&quot;>404 Page Not Found</h1>
          </div>

          <p className=&quot;mt-4 text-sm text-gray-600&quot;>
            Did you forget to add the page to the router?
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
