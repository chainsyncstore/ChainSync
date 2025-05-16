import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Barcode, X, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useMobile } from '@/hooks/use-mobile';

interface BarcodeResponse {
  product?: {
    id: number;
    name: string;
    barcode: string;
    price: string;
    description?: string;
    categoryId?: number;
    imageUrl?: string;
  };
  error?: string;
}

interface BarcodeScannerProps {
  onProductFound: (product: any) => void;
  disabled?: boolean;
}

export default function BarcodeScanner({ onProductFound, disabled = false }: BarcodeScannerProps) {
  const [barcode, setBarcode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [foundProduct, setFoundProduct] = useState<any>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { isMobile } = useMobile() || { isMobile: false };
  
  // Set up beep sound for successful scan
  const successBeep = useRef<HTMLAudioElement | null>(null);
  const errorBeep = useRef<HTMLAudioElement | null>(null);
  
  useEffect(() => {
    // Create audio elements
    successBeep.current = new Audio('/assets/sounds/success-beep.mp3');
    errorBeep.current = new Audio('/assets/sounds/error-beep.mp3');
    
    // If the audio files don't exist, create fallback sounds
    successBeep.current.addEventListener('error', () => {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      successBeep.current = createBeepSound(ctx, 1000, 0.1);
    });
    
    errorBeep.current.addEventListener('error', () => {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      errorBeep.current = createBeepSound(ctx, 300, 0.3);
    });
    
    // Function to keep input focused
    const focusInput = () => {
      if (inputRef.current && !isMobile) {
        inputRef.current.focus();
      }
    };
    
    // Set focus initially
    focusInput();
    
    // Set up interval to keep input focused
    const focusInterval = setInterval(focusInput, 1000);
    
    // Listen for keyboard events globally to capture barcode scanner input
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle key events when the scanner is active
      if (disabled) return;
      
      // Prevent default for Enter key to avoid form submissions
      if (e.key === 'Enter') {
        e.preventDefault();
      }
      
      // If the target is already our input field, no need to redirect
      if (e.target === inputRef.current) return;
      
      // If the key event should be captured for our scanner (alphanumeric or Enter)
      if (
        (e.key.length === 1 && /[\w\d-]/.test(e.key)) || 
        e.key === 'Enter' ||
        e.key === 'Backspace'
      ) {
        // Redirect focus to our input
        if (inputRef.current) {
          inputRef.current.focus();
          
          // For alphanumeric keys, simulate input
          if (e.key.length === 1) {
            const currentValue = inputRef.current.value || '';
            inputRef.current.value = currentValue + e.key;
            setBarcode(currentValue + e.key);
          }
          
          // For Enter, trigger scan
          if (e.key === 'Enter') {
            handleScan();
          }
          
          // For Backspace, handle deletion
          if (e.key === 'Backspace') {
            const currentValue = inputRef.current.value || '';
            inputRef.current.value = currentValue.slice(0, -1);
            setBarcode(currentValue.slice(0, -1));
          }
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      clearInterval(focusInterval);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [disabled, isMobile]);
  
  // Create a beep sound programmatically (fallback)
  const createBeepSound = (
    context: AudioContext, 
    frequency: number, 
    duration: number
  ): HTMLAudioElement => {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gainNode.gain.value = 0.5;
    
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + duration);
    
    // Create a fake HTMLAudioElement with a play method
    return {
      play: () => {
        // Create a new sound each time
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.value = frequency;
        gain.gain.value = 0.5;
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
      }
    } as any;
  };
  
  // Handle barcode submission
  const handleScan = async () => {
    if (!barcode.trim() || disabled) return;
    
    setIsScanning(true);
    
    try {
      // Look up the product by barcode
      const response = await apiRequest('GET', `/api/products/barcode/${encodeURIComponent(barcode)}`);
      const data = await response.json();
      
      if (response.status === 400 && data.isExpired) {
        // Product is expired
        if (errorBeep.current) errorBeep.current.play();
        
        // Format the expiry date for display
        const expiryDate = new Date(data.expiryDate);
        const formattedDate = expiryDate.toLocaleDateString();
        
        setErrorMessage(`This product expired on ${formattedDate} and cannot be sold.`);
        setShowError(true);
        setFoundProduct(data.product);
      } else if (data.error || !data.product) {
        // Product not found or other error
        if (errorBeep.current) errorBeep.current.play();
        setErrorMessage(data.error || 'Product not found. Please check the barcode and try again.');
        setShowError(true);
      } else {
        // Product found and not expired
        setFoundProduct(data.product);
        if (successBeep.current) successBeep.current.play();
        
        // Flash success indicator
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 1500);
        
        // Add to cart
        onProductFound(data.product);
        
        // Show toast
        toast({
          title: 'Product Added',
          description: `${data.product.name} has been added to the cart.`,
        });
      }
    } catch (error) {
      console.error('Error scanning barcode:', error);
      if (errorBeep.current) errorBeep.current.play();
      setErrorMessage('Error scanning barcode. Please try again.');
      setShowError(true);
    } finally {
      setIsScanning(false);
      setBarcode('');
      if (inputRef.current) {
        inputRef.current.value = '';
        inputRef.current.focus();
      }
    }
  };
  
  // Handle input change
  const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBarcode(e.target.value);
  };
  
  // Handle Enter key in input field
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScan();
    }
  };
  
  return (
    <>
      <div className="relative">
        <div className={`flex gap-2 transition-all duration-300 ${showSuccess ? 'bg-green-50 border-green-300' : ''}`}>
          <div className="relative flex-1">
            <Barcode className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              ref={inputRef}
              type="text"
              value={barcode}
              onChange={handleBarcodeChange}
              onKeyPress={handleKeyPress}
              placeholder="Scan barcode or type it here..."
              className="pl-9"
              disabled={disabled || isScanning}
              autoFocus
              autoComplete="off"
            />
            {barcode && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                onClick={() => {
                  setBarcode('');
                  if (inputRef.current) {
                    inputRef.current.value = '';
                    inputRef.current.focus();
                  }
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <Button
            onClick={handleScan}
            disabled={!barcode.trim() || disabled || isScanning}
          >
            {isScanning ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              'Scan'
            )}
          </Button>
        </div>
        
        {/* Success indicator */}
        {showSuccess && (
          <div className="absolute top-0 right-0 mt-2 mr-2">
            <div className="flex items-center justify-center rounded-full bg-green-500 p-1">
              <Check className="h-3 w-3 text-white" />
            </div>
          </div>
        )}
      </div>
      
      {/* Error Dialog */}
      <AlertDialog open={showError} onOpenChange={setShowError}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Barcode Not Found</AlertDialogTitle>
            <AlertDialogDescription>
              {errorMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button 
              onClick={() => {
                setShowError(false);
                if (inputRef.current) {
                  inputRef.current.focus();
                }
              }}
            >
              OK
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}