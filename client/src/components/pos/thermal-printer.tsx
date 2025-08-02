import React, { useState, useEffect } from &apos;react&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Alert, AlertDescription, AlertTitle } from &apos;@/components/ui/alert&apos;;
import { Separator } from &apos;@/components/ui/separator&apos;;
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from &apos;@/components/ui/select&apos;;
import { Switch } from &apos;@/components/ui/switch&apos;;
import { Label } from &apos;@/components/ui/label&apos;;
import { Printer, Save, AlertCircle, HelpCircle } from &apos;lucide-react&apos;;
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from &apos;@/components/ui/card&apos;;
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from &apos;@/components/ui/dialog&apos;;
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from &apos;@/components/ui/tooltip&apos;;
import * as escpos from &apos;@/lib/escpos-commands&apos;;
import { TransactionWithDetails } from &apos;@/types/analytics&apos;;

interface ThermalPrinterProps {
  _transaction: TransactionWithDetails;
  onClose?: () => void;
}

export function ThermalPrinter({ transaction, onClose }: ThermalPrinterProps) {
  const [printerStatus, setPrinterStatus] = useState<&apos;checking&apos; | &apos;available&apos; |
  &apos;not-available&apos;>(&apos;checking&apos;);
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>(&apos;&apos;);
  const [openDrawer, setOpenDrawer] = useState(true);
  const [paperCut, setPaperCut] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);

  // Check printer availability when component mounts
  useEffect(() => {
    checkPrinterAvailability();
  }, []);

  // Function to check if Web USB API is available and if printers are connected
  const checkPrinterAvailability = async() => {
    // @ts-ignore
    if (!navigator.usb) {
      setPrinterStatus(&apos;not-available&apos;);
      return;
    }

    try {
      // In a real implementation, we would check for connected printers here
      // Since we don&apos;t have driver access in the browser, we&apos;ll simulate it
      // Simulate some available printers
      setAvailablePrinters([&apos;POS58 Thermal Printer&apos;, &apos;Epson TM-T20&apos;]);
      setSelectedPrinter(&apos;POS58 Thermal Printer&apos;);
      setPrinterStatus(&apos;available&apos;);
    } catch (error) {
      console.error(&apos;Error checking printer _availability:&apos;, error);
      setPrinterStatus(&apos;not-available&apos;);
    }
  };

  // Generate receipt data for the ESC/POS commands
  const generateReceiptData = () => {
    // Format the items for the receipt
    const items = (transaction.items as any[]).map((_item: any) => ({
      _name: item.name || item.product?.name || &apos;Unknown Product&apos;,
      _quantity: item.quantity,
      _unitPrice: parseFloat(item.unitPrice),
      _total: parseFloat(item.subtotal)
    }));

    // Generate the receipt options
    const receiptOptions = {
      _storeName: transaction.store?.name ?? &apos;ChainSync Store&apos;,
      _storeAddress: transaction.store?.address ?? &apos;&apos;,
      _storePhone: transaction.store?.phone ?? &apos;&apos;,
      _transactionId: transaction.id.toString(),
      _date: new Date(transaction.createdAt!),
      _cashierName: transaction.cashier?.name ?? &apos;Cashier&apos;,
      items,
      _subtotal: parseFloat(transaction.subtotal),
      _tax: parseFloat(transaction.tax ?? &apos;0&apos;),
      _total: parseFloat(transaction.total),
      _paymentMethod: transaction.paymentMethod,
      _customerName: transaction.customer?.name,
      _loyaltyPoints: transaction.pointsEarned ? {
        _earned: transaction.pointsEarned,
        _balance: transaction.loyaltyMember?.points ?? transaction.pointsEarned
      } : undefined,
      openDrawer,
      _cutPaper: paperCut
    };

    return receiptOptions;
  };

  // Send print job to the selected printer
  const printReceipt = () => {
    try {
      const receiptOptions = generateReceiptData();
      const commands = escpos.generateReceipt(receiptOptions);

      // Since direct USB access requires special permissions and native integration,
      // we&apos;ll provide options for saving the commands or using a local print service

      // For Web USB enabled browsers, provide instructions on installing a local print service
      setShowInstructions(true);

      // Save the print commands for the local print service to pick up
      escpos.saveEscposCommandsForPrinting(commands, selectedPrinter);

      // Optionally, allow downloading the raw commands for manual printing
      // escpos.downloadEscposCommands(commands, `receipt-${transaction.transactionId}.bin`);

      return true;
    } catch (error) {
      console.error(&apos;Error printing _receipt:&apos;, error);
      return false;
    }
  };

  // Download raw ESC/POS commands for manual printing
  const downloadRawCommands = () => {
    try {
      const receiptOptions = generateReceiptData();
      const commands = escpos.generateReceipt(receiptOptions);
      escpos.downloadEscposCommands(commands, `receipt-${transaction.id}.bin`);
    } catch (error) {
      console.error(&apos;Error generating receipt _commands:&apos;, error);
    }
  };

  return (
    <Card className=&quot;max-w-md mx-auto&quot;>
      <CardHeader>
        <CardTitle>Thermal Printer</CardTitle>
        <CardDescription>Print receipt to thermal printer</CardDescription>
      </CardHeader>

      <CardContent className=&quot;space-y-4&quot;>
        {printerStatus === &apos;checking&apos; && (
          <div className=&quot;flex items-center justify-center p-4&quot;>
            <div className=&quot;h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent&quot; />
            <span className=&quot;ml-2&quot;>Checking for printers...</span>
          </div>
        )}

        {printerStatus === &apos;not-available&apos; && (
          <Alert variant=&quot;destructive&quot;>
            <AlertCircle className=&quot;h-4 w-4&quot; />
            <AlertTitle>Printer Not Available</AlertTitle>
            <AlertDescription>
              Web USB is not supported in your browser or no thermal printers are connected.
              You can download the receipt commands to print manually.
            </AlertDescription>
          </Alert>
        )}

        {printerStatus === &apos;available&apos; && (
          <>
            <div className=&quot;space-y-4&quot;>
              <div className=&quot;space-y-2&quot;>
                <Label htmlFor=&quot;printer&quot;>Select Printer</Label>
                <Select value={selectedPrinter} onValueChange={setSelectedPrinter}>
                  <SelectTrigger id=&quot;printer&quot;>
                    <SelectValue placeholder=&quot;Select printer&quot; />
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

              <div className=&quot;flex items-center justify-between&quot;>
                <div className=&quot;flex items-center space-x-2&quot;>
                  <Label htmlFor=&quot;open-drawer&quot;>Open Cash Drawer</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className=&quot;h-4 w-4 text-muted-foreground&quot; />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Automatically open the cash drawer after printing</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Switch
                  id=&quot;open-drawer&quot;
                  checked={openDrawer}
                  onCheckedChange={setOpenDrawer}
                />
              </div>

              <div className=&quot;flex items-center justify-between&quot;>
                <div className=&quot;flex items-center space-x-2&quot;>
                  <Label htmlFor=&quot;paper-cut&quot;>Cut Paper</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className=&quot;h-4 w-4 text-muted-foreground&quot; />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Automatically cut the receipt paper after printing</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Switch
                  id=&quot;paper-cut&quot;
                  checked={paperCut}
                  onCheckedChange={setPaperCut}
                />
              </div>
            </div>
          </>
        )}
      </CardContent>

      <CardFooter className=&quot;flex flex-col _sm:flex-row gap-2&quot;>
        <Button
          variant=&quot;outline&quot;
          onClick={downloadRawCommands}
          className=&quot;w-full _sm:w-auto&quot;
        >
          <Save className=&quot;mr-2 h-4 w-4&quot; />
          Download Print File
        </Button>

        <Button
          onClick={printReceipt}
          className=&quot;w-full _sm:w-auto&quot;
          disabled={printerStatus === &apos;checking&apos;}
        >
          <Printer className=&quot;mr-2 h-4 w-4&quot; />
          Print Receipt
        </Button>

        {onClose && (
          <Button variant=&quot;ghost&quot; onClick={onClose} className=&quot;w-full _sm:w-auto&quot;>
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

          <div className=&quot;space-y-4&quot;>
            <p>There are a few ways to send the receipt to your thermal _printer:</p>

            <ol className=&quot;list-decimal ml-6 space-y-2&quot;>
              <li>
                <strong>ChainSync Print Service:</strong> Install our dedicated print service
                that runs in the background and automatically sends print jobs to your printer.
                <Button
                  variant=&quot;link&quot;
                  className=&quot;p-0 h-auto&quot;
                  onClick={() => {
                    // Download link would go here in a real implementation
                    alert(&apos;Print service download would be available here in production.&apos;);
                  }}
                >
                  Download Print Service
                </Button>
              </li>

              <li>
                <strong>Manual _Method:</strong> Download the receipt file and send it directly
                to your printer using a command like:
                <pre className=&quot;bg-muted p-2 rounded-md text-xs mt-1 overflow-x-auto&quot;>
                  {&apos;copy receipt.bin /b LPT1:&apos;}
                </pre>
                or
                <pre className=&quot;bg-muted p-2 rounded-md text-xs mt-1 overflow-x-auto&quot;>
                  {&apos;cat receipt.bin > /dev/usb/lp0&apos;}
                </pre>
              </li>
            </ol>

            <Alert>
              <AlertCircle className=&quot;h-4 w-4&quot; />
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
