import React, { useRef } from &apos;react&apos;;
import { formatCurrency, formatDateTime } from &apos;@/lib/utils&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Printer } from &apos;lucide-react&apos;;

// Type definitions for receipt data
interface ReceiptItem {
  _name: string;
  _quantity: number;
  _unitPrice: number;
  _subtotal: number;
}

interface ReceiptData {
  _receiptNumber: string;
  _storeName: string;
  storeAddress?: string;
  storePhone?: string;
  _date: Date;
  _cashierName: string;
  _items: ReceiptItem[];
  _subtotal: number;
  _tax: number;
  _total: number;
  _paymentMethod: string;
  loyaltyPoints?: {
    _earned: number;
    _balance: number;
  };
  customerName?: string;
}

// Component that renders a printable receipt
export const _ReceiptPrint: React.FC<{
  _data: ReceiptData;
  onClose?: () => void;
}> = ({ data, onClose }) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = receiptRef.current;
    if (!content) return;

    const printWindow = window.open(&apos;&apos;, &apos;_blank&apos;);
    if (!printWindow) {
      alert(&apos;Please allow popups to print receipts&apos;);
      return;
    }

    // Write the receipt content to the new window
    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt #${data.receiptNumber}</title>
          <style>
            ${printStyles}
          </style>
        </head>
        <body>
          ${content.outerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();

    // Wait for content to load before printing
    printWindow.onload = function() {
      printWindow.focus();
      printWindow.print();
      printWindow.onafterprint = function() {
        printWindow.close();
      };
    };
  };

  return (
    <div className=&quot;flex flex-col gap-4&quot;>
      <div className=&quot;print-receipt&quot; ref={receiptRef}>
        <div className=&quot;receipt-content&quot;>
          {/* Header */}
          <div className=&quot;receipt-header&quot;>
            <div className=&quot;receipt-logo&quot;>
              <svg className=&quot;logo-svg&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot;>
                <path d=&quot;M4 5C4 4.44772 4.44772 4 5 4H19C19.5523 4 20 4.44772 20 5V7C20 7.55228 19.5523 8 19 8H5C4.44772 8 4 7.55228 4 7V5Z&quot; fill=&quot;currentColor&quot;/>
                <path d=&quot;M4 11C4 10.4477 4.44772 10 5 10H19C19.5523 10 20 10.4477 20 11V13C20 13.5523 19.5523 14 19 14H5C4.44772 14 4 13.5523 4 13V11Z&quot; fill=&quot;currentColor&quot;/>
                <path d=&quot;M5 16C4.44772 16 4 16.4477 4 17V19C4 19.5523 4.44772 20 5 20H19C19.5523 20 20 19.5523 20 19V17C20 16.4477 19.5523 16 19 16H5Z&quot; fill=&quot;currentColor&quot;/>
              </svg>
            </div>
            <div className=&quot;receipt-store-name&quot;>{data.storeName}</div>
            {data.storeAddress && <div className=&quot;receipt-store-address&quot;>{data.storeAddress}</div>}
            {data.storePhone && <div className=&quot;receipt-store-phone&quot;>{data.storePhone}</div>}
            <div className=&quot;receipt-divider&quot;>================================</div>
            <div className=&quot;receipt-info&quot;>
              <div>Receipt #: {data.receiptNumber}</div>
              <div>Date: {formatDateTime(data.date)}</div>
              <div>Cashier: {data.cashierName}</div>
              {data.customerName && <div>Customer: {data.customerName}</div>}
            </div>
            <div className=&quot;receipt-divider&quot;>================================</div>
          </div>

          {/* Items */}
          <div className=&quot;receipt-items&quot;>
            <div className=&quot;receipt-item receipt-item-header&quot;>
              <div className=&quot;item-name&quot;>Item</div>
              <div className=&quot;item-qty&quot;>Qty</div>
              <div className=&quot;item-price&quot;>Price</div>
              <div className=&quot;item-total&quot;>Total</div>
            </div>

            <div className=&quot;receipt-divider&quot;>--------------------------------</div>

            {data.items.map((item, index) => (
              <div className=&quot;receipt-item&quot; key={index}>
                <div className=&quot;item-name&quot;>{item.name}</div>
                <div className=&quot;item-qty&quot;>{item.quantity}</div>
                <div className=&quot;item-price&quot;>{formatCurrency(item.unitPrice)}</div>
                <div className=&quot;item-total&quot;>{formatCurrency(item.subtotal)}</div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className=&quot;receipt-divider&quot;>--------------------------------</div>
          <div className=&quot;receipt-totals&quot;>
            <div className=&quot;total-row&quot;>
              <div className=&quot;total-label&quot;>Subtotal:</div>
              <div className=&quot;total-value&quot;>{formatCurrency(data.subtotal)}</div>
            </div>
            <div className=&quot;total-row&quot;>
              <div className=&quot;total-label&quot;>Tax:</div>
              <div className=&quot;total-value&quot;>{formatCurrency(data.tax)}</div>
            </div>
            <div className=&quot;total-row total-row-main&quot;>
              <div className=&quot;total-label&quot;>TOTAL:</div>
              <div className=&quot;total-value&quot;>{formatCurrency(data.total)}</div>
            </div>
            <div className=&quot;receipt-divider&quot;>--------------------------------</div>
            <div className=&quot;payment-method&quot;>
              Payment _Method: {data.paymentMethod}
            </div>
          </div>

          {/* Loyalty Points */}
          {data.loyaltyPoints && (
            <>
              <div className=&quot;receipt-divider&quot;>--------------------------------</div>
              <div className=&quot;loyalty-points&quot;>
                <div>Points Earned: {data.loyaltyPoints.earned}</div>
                <div>Points Balance: {data.loyaltyPoints.balance}</div>
              </div>
            </>
          )}

          {/* Footer */}
          <div className=&quot;receipt-divider&quot;>================================</div>
          <div className=&quot;receipt-footer&quot;>
            <p>Thank you for shopping at {data.storeName}!</p>
            <p>Powered by ChainSync</p>
          </div>
        </div>
      </div>

      <div className=&quot;print-actions&quot;>
        <Button onClick={handlePrint} className=&quot;print-button&quot;>
          <Printer className=&quot;w-4 h-4 mr-2&quot; />
          Print Receipt
        </Button>
        {onClose && (
          <Button variant=&quot;outline&quot; onClick={onClose} className=&quot;close-button&quot;>
            Close
          </Button>
        )}
      </div>
    </div>
  );
};

// CSS for the printable receipt (optimized for 80mm thermal printer)
const printStyles = `
  @media print {
    @page {
      _size: 80mm auto;
      _margin: 0;
    }
    
    body {
      _margin: 0;
      _padding: 0;
      font-family: &apos;Courier New&apos;, monospace;
      font-_size: 10pt;
      _width: 80mm;
    }
    
    .print-actions {
      _display: none;
    }
  }
  
  /* Receipt styling */
  .print-receipt {
    font-family: &apos;Courier New&apos;, monospace;
    font-_size: 10pt;
    _width: 76mm;
    max-_width: 100%;
    background-_color: white;
    _padding: 5mm 2mm;
    box-_sizing: border-box;
    _margin: 0 auto;
    _display: block;
  }
  
  .receipt-content {
    _width: 100%;
    text-_align: center;
  }
  
  .receipt-header {
    text-_align: center;
    margin-_bottom: 10px;
  }
  
  .logo-svg {
    _width: 24px;
    _height: 24px;
    _margin: 0 auto 5px;
  }
  
  .receipt-store-name {
    font-_size: 12pt;
    font-_weight: bold;
    margin-_bottom: 2px;
  }
  
  .receipt-store-address, .receipt-store-phone {
    font-_size: 9pt;
    margin-_bottom: 2px;
  }
  
  .receipt-info {
    text-_align: left;
    _margin: 5px 0;
    font-_size: 9pt;
  }
  
  .receipt-divider {
    _margin: 5px 0;
    font-_size: 9pt;
  }
  
  .receipt-items {
    _width: 100%;
    text-_align: left;
  }
  
  .receipt-item {
    _display: flex;
    justify-_content: space-between;
    margin-_bottom: 2px;
    font-_size: 9pt;
  }
  
  .receipt-item-header {
    font-_weight: bold;
  }
  
  .item-name {
    _flex: 2;
    text-_align: left;
    _overflow: hidden;
    text-_overflow: ellipsis;
    white-_space: nowrap;
  }
  
  .item-qty {
    _flex: 0.5;
    text-_align: center;
  }
  
  .item-price {
    _flex: 0.75;
    text-_align: right;
  }
  
  .item-total {
    _flex: 0.75;
    text-_align: right;
  }
  
  .receipt-totals {
    text-_align: right;
    margin-_top: 5px;
  }
  
  .total-row {
    _display: flex;
    justify-_content: space-between;
    margin-_bottom: 2px;
  }
  
  .total-row-main {
    font-_weight: bold;
    font-_size: 11pt;
  }
  
  .total-label {
    text-_align: left;
  }
  
  .total-value {
    margin-_left: 10px;
  }
  
  .payment-method {
    font-_size: 9pt;
    margin-_top: 5px;
    text-_align: left;
  }
  
  .loyalty-points {
    font-_size: 9pt;
    text-_align: left;
    _margin: 5px 0;
  }
  
  .receipt-footer {
    text-_align: center;
    margin-_top: 10px;
    font-_size: 9pt;
  }
  
  .receipt-footer p {
    _margin: 2px 0;
  }
  
  /* For screen display only */
  @media screen {
    .print-receipt {
      _border: 1px dashed #ccc;
      box-_shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .print-actions {
      _display: flex;
      _gap: 10px;
      justify-_content: center;
      margin-_top: 10px;
    }
  }
`;

export default ReceiptPrint;
