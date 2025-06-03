import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Printer, Save, AlertCircle, HelpCircle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import * as escpos from '@/lib/escpos-commands';

interface ThermalPrinterProps {
  transaction: any;
  onClose?: () => void;
}

export function ThermalPrinter({ transaction, onClose }: ThermalPrinterProps) {
  const [printerStatus, setPrinterStatus] = useState<'checking' | 'available' | 'not-available'>('checking');
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [openDrawer, setOpenDrawer] = useState(true);
  const [paperCut, setPaperCut] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);
  
  // Check printer availability when component mounts
  useEffect(() => {
    checkPrinterAvailability();
  }, []);
  
  // Function to check if Web USB API is available and if printers are connected
  const checkPrinterAvailability = async () => {
    if (typeof navigator.usb === 'undefined') {
      setPrinterStatus('not-available');
      return;
    }
    
    try {
      // In a real implementation, we would check for connected printers here
      // Since we don't have driver access in the browser, we'll simulate it
      // Simulate some available printers
      setAvailablePrinters(['POS58 Thermal Printer', 'Epson TM-T20']);
      setSelectedPrinter('POS58 Thermal Printer');
      setPrinterStatus('available');
    } catch (error) {
      console.error('Error checking printer availability:', error);
      setPrinterStatus('not-available');
    }
  };
  
  // Generate receipt data for the ESC/POS commands
  const generateReceiptData = () => {
    // Format the items for the receipt
    const items = transaction.items.map((item: any) => ({
      name: item.name || item.product?.name || 'Unknown Product',
      quantity: item.quantity,
      unitPrice: parseFloat(item.unitPrice),
      total: parseFloat(item.subtotal)
    }));
    
    // Generate the receipt options
    const receiptOptions = {
      storeName: transaction.store?.name || 'ChainSync Store',
      storeAddress: transaction.store?.address || '',
      storePhone: transaction.store?.phone || '',
      transactionId: transaction.transactionId,
      date: new Date(transaction.createdAt),
      cashierName: transaction.cashier?.fullName || 'Cashier',
      items,
      subtotal: parseFloat(transaction.subtotal),
      tax: parseFloat(transaction.tax),
      total: parseFloat(transaction.total),
      paymentMethod: transaction.paymentMethod,
      customerName: transaction.customer?.fullName,
      loyaltyPoints: transaction.pointsEarned ? {
        earned: transaction.pointsEarned,
        balance: transaction.loyaltyMember?.points || transaction.pointsEarned
      } : undefined,
      openDrawer,
      cutPaper: paperCut,
    };
    
    return receiptOptions;
  };
  
  // Send print job to the selected printer
  const printReceipt = () => {
    try {
      const receiptOptions = generateReceiptData();
      const commands = escpos.generateReceipt(receiptOptions);
      
      // Since direct USB access requires special permissions and native integration,
      // we'll provide options for saving the commands or using a local print service
      
      // For Web USB enabled browsers, provide instructions on installing a local print service
      setShowInstructions(true);
      
      // Save the print commands for the local print service to pick up
      escpos.saveEscposCommandsForPrinting(commands, selectedPrinter);
      
      // Optionally, allow downloading the raw commands for manual printing
      // escpos.downloadEscposCommands(commands, `receipt-${transaction.transactionId}.bin`);
      
      return true;
    } catch (error) {
      console.error('Error printing receipt:', error);
      return false;
    }
  };
  
  // Download raw ESC/POS commands for manual printing
  const downloadRawCommands = () => {
    try {
      const receiptOptions = generateReceiptData();
      const commands = escpos.generateReceipt(receiptOptions);
      escpos.downloadEscposCommands(commands, `receipt-${transaction.transactionId}.bin`);
    } catch (error) {
      console.error('Error generating receipt commands:', error);
    }
  };
  
  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Thermal Printer</CardTitle>
        <CardDescription>Print receipt to thermal printer</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {printerStatus === 'checking' && (
          <div className="flex items-center justify-center p-4">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <span className="ml-2">Checking for printers...</span>
          </div>
        )}
        
        {printerStatus === 'not-available' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Printer Not Available</AlertTitle>
            <AlertDescription>
              Web USB is not supported in your browser or no thermal printers are connected.
              You can download the receipt commands to print manually.
            </AlertDescription>
          </Alert>
        )}
        
        {printerStatus === 'available' && (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="printer">Select Printer</Label>
                <Select value={selectedPrinter} onValueChange={setSelectedPrinter}>
                  <SelectTrigger id="printer">
                    <SelectValue placeholder="Select printer" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePrinters.map((printer) => (
                      <SelectItem key={printer} value={printer}>
                        {printer}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Label htmlFor="open-drawer">Open Cash Drawer</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Automatically open the cash drawer after printing</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Switch 
                  id="open-drawer" 
                  checked={openDrawer} 
                  onCheckedChange={setOpenDrawer} 
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Label htmlFor="paper-cut">Cut Paper</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Automatically cut the receipt paper after printing</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Switch 
                  id="paper-cut" 
                  checked={paperCut} 
                  onCheckedChange={setPaperCut} 
                />
              </div>
            </div>
          </>
        )}
      </CardContent>
      
      <CardFooter className="flex flex-col sm:flex-row gap-2">
        <Button 
          variant="outline" 
          onClick={downloadRawCommands}
          className="w-full sm:w-auto"
        >
          <Save className="mr-2 h-4 w-4" />
          Download Print File
        </Button>
        
        <Button 
          onClick={printReceipt}
          className="w-full sm:w-auto"
          disabled={printerStatus === 'checking'}
        >
          <Printer className="mr-2 h-4 w-4" />
          Print Receipt
        </Button>
        
        {onClose && (
          <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto">
            Close
          </Button>
        )}
      </CardFooter>
      
      {/* Instructions dialog */}
      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Printing Instructions</DialogTitle>
            <DialogDescription>
              To print directly to a thermal printer, you need to set up a local printing service.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <p>There are a few ways to send the receipt to your thermal printer:</p>
            
            <ol className="list-decimal ml-6 space-y-2">
              <li>
                <strong>ChainSync Print Service:</strong> Install our dedicated print service 
                that runs in the background and automatically sends print jobs to your printer.
                <Button 
                  variant="link" 
                  className="p-0 h-auto"
                  onClick={() => {
                    // Download link would go here in a real implementation
                    alert('Print service download would be available here in production.');
                  }}
                >
                  Download Print Service
                </Button>
              </li>
              
              <li>
                <strong>Manual Method:</strong> Download the receipt file and send it directly 
                to your printer using a command like:
                <pre className="bg-muted p-2 rounded-md text-xs mt-1 overflow-x-auto">
                  {`copy receipt.bin /b LPT1:`}
                </pre>
                or
                <pre className="bg-muted p-2 rounded-md text-xs mt-1 overflow-x-auto">
                  {`cat receipt.bin > /dev/usb/lp0`}
                </pre>
              </li>
            </ol>
            
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Receipt Data Saved</AlertTitle>
              <AlertDescription>
                The receipt data has been saved and is ready for printing.
                If you have the ChainSync Print Service installed, it should automatically
                detect and print this receipt.
              </AlertDescription>
            </Alert>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setShowInstructions(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default ThermalPrinter;
