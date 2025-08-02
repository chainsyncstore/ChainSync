import ProductImport from &apos;@/components/import/product-import&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;

export default function ProductImportPage() {
  const { user } = useAuth();
  const isManagerOrAdmin = user?.role === &apos;admin&apos; || user?.role === &apos;manager&apos;;

  if (!isManagerOrAdmin) {
    return (
      <div className=&quot;flex items-center justify-center h-[80vh]&quot;>
        <div className=&quot;text-center p-8 bg-destructive/10 rounded-lg max-w-md&quot;>
          <h1 className=&quot;text-xl font-semibold mb-4&quot;>Access Denied</h1>
          <p>You don&apos;t have permission to access this page.</p>
          <p className=&quot;mt-2 text-sm&quot;>Only managers and administrators can import products.</p>
        </div>
      </div>
    );
  }

  return (
    <div className=&quot;container mx-auto px-4 py-8&quot;>
      <ProductImport />
    </div>
  );
}
