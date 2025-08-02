import React, { useState, useEffect, useRef } from &apos;react&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from &apos;@/components/ui/alert-dialog&apos;;
import { Barcode, X, Check } from &apos;lucide-react&apos;;
import { useToast } from &apos;@/hooks/use-toast&apos;;
import { useQuery } from &apos;@tanstack/react-query&apos;;
import { apiRequest } from &apos;@/lib/queryClient&apos;;
import { useMobile } from &apos;@/hooks/use-mobile&apos;;

interface BarcodeResponse {
  product?: {
    _id: number;
    _name: string;
    _barcode: string;
    _price: string;
    description?: string;
    categoryId?: number;
    imageUrl?: string;
  };
  error?: string;
}

interface BarcodeScannerProps {
  onProductFound: (_product: any) => void;
  disabled?: boolean;
}

export default function BarcodeScanner({ onProductFound, disabled = false }: BarcodeScannerProps) {
  const [barcode, setBarcode] = useState(&apos;&apos;);
  const [isScanning, setIsScanning] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState(&apos;&apos;);
  const [showSuccess, setShowSuccess] = useState(false);
  const [foundProduct, setFoundProduct] = useState<any>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { isMobile } = useMobile() || { _isMobile: false };

  // Set up beep sound for successful scan
  const successBeep = useRef<HTMLAudioElement | null>(null);
  const errorBeep = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio elements
    successBeep.current = new Audio(&apos;/assets/sounds/success-beep.mp3&apos;);
    errorBeep.current = new Audio(&apos;/assets/sounds/error-beep.mp3&apos;);

    // If the audio files don&apos;t exist, create fallback sounds
    successBeep.current.addEventListener(&apos;error&apos;, () => {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      successBeep.current = createBeepSound(ctx, 1000, 0.1);
    });

    errorBeep.current.addEventListener(&apos;error&apos;, () => {
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
    const handleKeyDown = (_e: KeyboardEvent) => {
      // Only handle key events when the scanner is active
      if (disabled) return;

      // Prevent default for Enter key to avoid form submissions
      if (e.key === &apos;Enter&apos;) {
        e.preventDefault();
      }

      // If the target is already our input field, no need to redirect
      if (e.target === inputRef.current) return;

      // If the key event should be captured for our scanner (alphanumeric or Enter)
      if (
        (e.key.length === 1 && /[\w\d-]/.test(e.key)) ||
        e.key === &apos;Enter&apos; ||
        e.key === &apos;Backspace&apos;
      ) {
        // Redirect focus to our input
        if (inputRef.current) {
          inputRef.current.focus();

          // For alphanumeric keys, simulate input
          if (e.key.length === 1) {
            const currentValue = inputRef.current.value || &apos;&apos;;
            inputRef.current.value = currentValue + e.key;
            setBarcode(currentValue + e.key);
          }

          // For Enter, trigger scan
          if (e.key === &apos;Enter&apos;) {
            handleScan();
          }

          // For Backspace, handle deletion
          if (e.key === &apos;Backspace&apos;) {
            const currentValue = inputRef.current.value || &apos;&apos;;
            inputRef.current.value = currentValue.slice(0, -1);
            setBarcode(currentValue.slice(0, -1));
          }
        }
      }
    };

    document.addEventListener(&apos;keydown&apos;, handleKeyDown);

    return () => {
      clearInterval(focusInterval);
      document.removeEventListener(&apos;keydown&apos;, handleKeyDown);
    };
  }, [disabled, isMobile]);

  // Create a beep sound programmatically (fallback)
  const createBeepSound = (
    _context: AudioContext,
    _frequency: number,
    _duration: number
  ): HTMLAudioElement => {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.type = &apos;sine&apos;;
    oscillator.frequency.value = frequency;
    gainNode.gain.value = 0.5;

    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + duration);

    // Create a fake HTMLAudioElement with a play method
    return {
      _play: () => {
        // Create a new sound each time
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = &apos;sine&apos;;
        osc.frequency.value = frequency;
        gain.gain.value = 0.5;

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
      }
    } as any;
  };

  // Handle barcode submission
  const handleScan = async() => {
    if (!barcode.trim() || disabled) return;

    setIsScanning(true);

    try {
      // Look up the product by barcode
      const data = await apiRequest(&apos;GET&apos;, `/api/products/barcode/${encodeURIComponent(barcode)}`);

      if (data.status === 400 && data.isExpired) {
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
        setErrorMessage(data.error || &apos;Product not found. Please check the barcode and try again.&apos;);
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
          _title: &apos;Product Added&apos;,
          _description: `${data.product.name} has been added to the cart.`
        });
      }
    } catch (error) {
      console.error(&apos;Error scanning _barcode:&apos;, error);
      if (errorBeep.current) errorBeep.current.play();
      setErrorMessage(&apos;Error scanning barcode. Please try again.&apos;);
      setShowError(true);
    } finally {
      setIsScanning(false);
      setBarcode(&apos;&apos;);
      if (inputRef.current) {
        inputRef.current.value = &apos;&apos;;
        inputRef.current.focus();
      }
    }
  };

  // Handle input change
  const handleBarcodeChange = (_e: React.ChangeEvent<HTMLInputElement>) => {
    setBarcode(e.target.value);
  };

  // Handle Enter key in input field
  const handleKeyPress = (_e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === &apos;Enter&apos;) {
      e.preventDefault();
      handleScan();
    }
  };

  return (
    <>
      <div className=&quot;relative&quot;>
        <div className={`flex gap-2 transition-all duration-300 ${showSuccess ? &apos;bg-green-50 border-green-300&apos; : &apos;&apos;}`}>
          <div className=&quot;relative flex-1&quot;>
            <Barcode className=&quot;absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4&quot; />
            <Input
              ref={inputRef}
              type=&quot;text&quot;
              value={barcode}
              onChange={handleBarcodeChange}
              onKeyPress={handleKeyPress}
              placeholder=&quot;Scan barcode or type it here...&quot;
              className=&quot;pl-9&quot;
              disabled={disabled || isScanning}
              autoFocus
              autoComplete=&quot;off&quot;
            />
            {barcode && (
              <Button
                variant=&quot;ghost&quot;
                size=&quot;icon&quot;
                className=&quot;absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6&quot;
                onClick={() => {
                  setBarcode(&apos;&apos;);
                  if (inputRef.current) {
                    inputRef.current.value = &apos;&apos;;
                    inputRef.current.focus();
                  }
                }}
              >
                <X className=&quot;h-3 w-3&quot; />
              </Button>
            )}
          </div>
          <Button
            onClick={handleScan}
            disabled={!barcode.trim() || disabled || isScanning}
          >
            {isScanning ? (
              <div className=&quot;h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent&quot; />
            ) : (
              &apos;Scan&apos;
            )}
          </Button>
        </div>

        {/* Success indicator */}
        {showSuccess && (
          <div className=&quot;absolute top-0 right-0 mt-2 mr-2&quot;>
            <div className=&quot;flex items-center justify-center rounded-full bg-green-500 p-1&quot;>
              <Check className=&quot;h-3 w-3 text-white&quot; />
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
