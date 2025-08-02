import ProductImport from '@/components/import/product-import';
import { useAuth } from '@/providers/auth-provider';

export default function ProductImportPage() {
  const { user } = useAuth();
  const isManagerOrAdmin = user?.role === 'admin' || user?.role === 'manager';
  
  if (!isManagerOrAdmin) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="text-center p-8 bg-destructive/10 rounded-lg max-w-md">
          <h1 className="text-xl font-semibold mb-4">Access Denied</h1>
          <p>You don't have permission to access this page.</p>
          <p className="mt-2 text-sm">Only managers and administrators can import products.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <ProductImport />
    </div>
  );
}