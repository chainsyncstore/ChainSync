import { Printer } from 'lucide-react';
import React, { useRef } from 'react';

import { Button } from '@/components/ui/button';
import { formatCurrency, formatDateTime } from '@/lib/utils';

// Type definitions for receipt data
interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface ReceiptData {
  receiptNumber: string;
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  date: Date;
  cashierName: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  loyaltyPoints?: {
    earned: number;
    balance: number;
  };
  customerName?: string;
}

// Component that renders a printable receipt
export const ReceiptPrint: React.FC<{
  data: ReceiptData;
  onClose?: () => void;
}> = ({ data, onClose }) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = receiptRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print receipts');
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
    printWindow.onload = function () {
      printWindow.focus();
      printWindow.print();
      printWindow.onafterprint = function () {
        printWindow.close();
      };
    };
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="print-receipt" ref={receiptRef}>
        <div className="receipt-content">
          {/* Header */}
          <div className="receipt-header">
            <div className="receipt-logo">
              <svg
                className="logo-svg"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 5C4 4.44772 4.44772 4 5 4H19C19.5523 4 20 4.44772 20 5V7C20 7.55228 19.5523 8 19 8H5C4.44772 8 4 7.55228 4 7V5Z"
                  fill="currentColor"
                />
                <path
                  d="M4 11C4 10.4477 4.44772 10 5 10H19C19.5523 10 20 10.4477 20 11V13C20 13.5523 19.5523 14 19 14H5C4.44772 14 4 13.5523 4 13V11Z"
                  fill="currentColor"
                />
                <path
                  d="M5 16C4.44772 16 4 16.4477 4 17V19C4 19.5523 4.44772 20 5 20H19C19.5523 20 20 19.5523 20 19V17C20 16.4477 19.5523 16 19 16H5Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <div className="receipt-store-name">{data.storeName}</div>
            {data.storeAddress && <div className="receipt-store-address">{data.storeAddress}</div>}
            {data.storePhone && <div className="receipt-store-phone">{data.storePhone}</div>}
            <div className="receipt-divider">================================</div>
            <div className="receipt-info">
              <div>Receipt #: {data.receiptNumber}</div>
              <div>Date: {formatDateTime(data.date)}</div>
              <div>Cashier: {data.cashierName}</div>
              {data.customerName && <div>Customer: {data.customerName}</div>}
            </div>
            <div className="receipt-divider">================================</div>
          </div>

          {/* Items */}
          <div className="receipt-items">
            <div className="receipt-item receipt-item-header">
              <div className="item-name">Item</div>
              <div className="item-qty">Qty</div>
              <div className="item-price">Price</div>
              <div className="item-total">Total</div>
            </div>

            <div className="receipt-divider">--------------------------------</div>

            {data.items.map((item, index) => (
              <div className="receipt-item" key={index}>
                <div className="item-name">{item.name}</div>
                <div className="item-qty">{item.quantity}</div>
                <div className="item-price">{formatCurrency(item.unitPrice)}</div>
                <div className="item-total">{formatCurrency(item.subtotal)}</div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="receipt-divider">--------------------------------</div>
          <div className="receipt-totals">
            <div className="total-row">
              <div className="total-label">Subtotal:</div>
              <div className="total-value">{formatCurrency(data.subtotal)}</div>
            </div>
            <div className="total-row">
              <div className="total-label">Tax:</div>
              <div className="total-value">{formatCurrency(data.tax)}</div>
            </div>
            <div className="total-row total-row-main">
              <div className="total-label">TOTAL:</div>
              <div className="total-value">{formatCurrency(data.total)}</div>
            </div>
            <div className="receipt-divider">--------------------------------</div>
            <div className="payment-method">Payment Method: {data.paymentMethod}</div>
          </div>

          {/* Loyalty Points */}
          {data.loyaltyPoints && (
            <>
              <div className="receipt-divider">--------------------------------</div>
              <div className="loyalty-points">
                <div>Points Earned: {data.loyaltyPoints.earned}</div>
                <div>Points Balance: {data.loyaltyPoints.balance}</div>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="receipt-divider">================================</div>
          <div className="receipt-footer">
            <p>Thank you for shopping at {data.storeName}!</p>
            <p>Powered by ChainSync</p>
          </div>
        </div>
      </div>

      <div className="print-actions">
        <Button onClick={handlePrint} className="print-button">
          <Printer className="w-4 h-4 mr-2" />
          Print Receipt
        </Button>
        {onClose && (
          <Button variant="outline" onClick={onClose} className="close-button">
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
      size: 80mm auto;
      margin: 0;
    }
    
    body {
      margin: 0;
      padding: 0;
      font-family: 'Courier New', monospace;
      font-size: 10pt;
      width: 80mm;
    }
    
    .print-actions {
      display: none;
    }
  }
  
  /* Receipt styling */
  .print-receipt {
    font-family: 'Courier New', monospace;
    font-size: 10pt;
    width: 76mm;
    max-width: 100%;
    background-color: white;
    padding: 5mm 2mm;
    box-sizing: border-box;
    margin: 0 auto;
    display: block;
  }
  
  .receipt-content {
    width: 100%;
    text-align: center;
  }
  
  .receipt-header {
    text-align: center;
    margin-bottom: 10px;
  }
  
  .logo-svg {
    width: 24px;
    height: 24px;
    margin: 0 auto 5px;
  }
  
  .receipt-store-name {
    font-size: 12pt;
    font-weight: bold;
    margin-bottom: 2px;
  }
  
  .receipt-store-address, .receipt-store-phone {
    font-size: 9pt;
    margin-bottom: 2px;
  }
  
  .receipt-info {
    text-align: left;
    margin: 5px 0;
    font-size: 9pt;
  }
  
  .receipt-divider {
    margin: 5px 0;
    font-size: 9pt;
  }
  
  .receipt-items {
    width: 100%;
    text-align: left;
  }
  
  .receipt-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 2px;
    font-size: 9pt;
  }
  
  .receipt-item-header {
    font-weight: bold;
  }
  
  .item-name {
    flex: 2;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .item-qty {
    flex: 0.5;
    text-align: center;
  }
  
  .item-price {
    flex: 0.75;
    text-align: right;
  }
  
  .item-total {
    flex: 0.75;
    text-align: right;
  }
  
  .receipt-totals {
    text-align: right;
    margin-top: 5px;
  }
  
  .total-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 2px;
  }
  
  .total-row-main {
    font-weight: bold;
    font-size: 11pt;
  }
  
  .total-label {
    text-align: left;
  }
  
  .total-value {
    margin-left: 10px;
  }
  
  .payment-method {
    font-size: 9pt;
    margin-top: 5px;
    text-align: left;
  }
  
  .loyalty-points {
    font-size: 9pt;
    text-align: left;
    margin: 5px 0;
  }
  
  .receipt-footer {
    text-align: center;
    margin-top: 10px;
    font-size: 9pt;
  }
  
  .receipt-footer p {
    margin: 2px 0;
  }
  
  /* For screen display only */
  @media screen {
    .print-receipt {
      border: 1px dashed #ccc;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .print-actions {
      display: flex;
      gap: 10px;
      justify-content: center;
      margin-top: 10px;
    }
  }
`;

export default ReceiptPrint;
