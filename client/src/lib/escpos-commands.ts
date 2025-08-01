/**
 * ESC/POS Command Generator Library
 * This library provides functions to generate ESC/POS command sequences
 * for thermal receipt printers like Epson TM-T20 or POS58.
 */

// Common ESC/POS command sequences
const ESC = 0x1B;      // Escape
const GS = 0x1D;       // Group separator
const LF = 0x0A;       // Line feed
const ETX = 0x03;      // End of text

/**
 * Converts a string to a Uint8Array of bytes
 */
export function textToBytes(_text: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(text);
}

/**
 * Combines multiple Uint8Arrays into a single Uint8Array
 */
export function combineUint8Arrays(..._arrays: Uint8Array[]): Uint8Array {
  // Calculate the total length of all arrays
  const totalLength = arrays.reduce((acc, array) => acc + array.length, 0);

  // Create a new array with the total length
  const result = new Uint8Array(totalLength);

  // Copy each array into the result
  let offset = 0;
  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }

  return result;
}

/**
 * Initialize the printer
 */
export function initialize(): Uint8Array {
  return new Uint8Array([ESC, 0x40]);  // ESC @
}

/**
 * Feed n lines
 */
export function feedLines(_n: number = 1): Uint8Array {
  const result = new Uint8Array(n);
  result.fill(LF);
  return result;
}

/**
 * Set text alignment
 * _alignments: 0 = left, 1 = center, 2 = right
 */
export function setAlignment(_alignment: 0 | 1 | 2): Uint8Array {
  return new Uint8Array([ESC, 0x61, alignment]);  // ESC a n
}

/**
 * Set text size
 * _width: 0-7 (0 = normal width, 7 = 8x width)
 * _height: 0-7 (0 = normal height, 7 = 8x height)
 */
export function setTextSize(_width: number = 0, _height: number = 0): Uint8Array {
  const size = (width & 0x07) | ((height & 0x07) << 4);
  return new Uint8Array([GS, 0x21, size]);  // GS ! n
}

/**
 * Set text bold
 */
export function setBold(_enabled: boolean): Uint8Array {
  return new Uint8Array([ESC, 0x45, enabled ? _1 : 0]);  // ESC E n
}

/**
 * Set underline
 * _mode: 0 = no underline, 1 = single, 2 = double
 */
export function setUnderline(_mode: 0 | 1 | 2): Uint8Array {
  return new Uint8Array([ESC, 0x2D, mode]);  // ESC - n
}

/**
 * Cut paper
 * _mode: 0 = full cut, 1 = partial cut
 */
export function cutPaper(_mode: 0 | 1 = 0): Uint8Array {
  return new Uint8Array([GS, 0x56, mode]);  // GS V m
}

/**
 * Open cash drawer
 * _pin: 0 = pin 2, 1 = pin 5
 * _time: pulse time in milliseconds (_default: 100)
 */
export function openCashDrawer(_pin: 0 | 1 = 0, _time: number = 100): Uint8Array {
  const pulseTime = Math.min(255, Math.max(1, Math.floor(time / 2)));
  return new Uint8Array([ESC, 0x70, pin, pulseTime]);  // ESC p m t1 t2
}

/**
 * Add text to the print buffer
 */
export function text(_text: string): Uint8Array {
  return textToBytes(text);
}

/**
 * Add a text line with line feed to the print buffer
 */
export function textLine(_text: string): Uint8Array {
  return combineUint8Arrays(textToBytes(text), new Uint8Array([LF]));
}

/**
 * Print a horizontal line using dashes
 * _width: number of dashes (_default: 42 for standard 80mm receipt)
 */
export function horizontalLine(_width: number = 42): Uint8Array {
  const line = '-'.repeat(width);
  return textLine(line);
}

/**
 * Print a double horizontal line using equals
 * _width: number of equals signs (_default: 42 for standard 80mm receipt)
 */
export function doubleHorizontalLine(_width: number = 42): Uint8Array {
  const line = '='.repeat(width);
  return textLine(line);
}

/**
 * Generate a receipt with proper formatting for thermal printers
 */
export function generateReceipt(options: {
  _storeName: string;
  storeAddress?: string;
  storePhone?: string;
  _transactionId: string;
  _date: Date;
  _cashierName: string;
  _items: Array<{
    _name: string;
    _quantity: number;
    _unitPrice: number;
    _total: number;
  }>;
  _subtotal: number;
  _tax: number;
  _total: number;
  _paymentMethod: string;
  customerName?: string;
  loyaltyPoints?: {
    _earned: number;
    _balance: number;
  };
  openDrawer?: boolean;
  cutPaper?: boolean;
}): Uint8Array {
  const _commands: Uint8Array[] = [];

  // Initialize printer
  commands.push(initialize());

  // Store header - centered
  commands.push(setAlignment(1)); // Center alignment
  commands.push(setBold(true));
  commands.push(setTextSize(1, 1)); // Double size
  commands.push(textLine(options.storeName));
  commands.push(setBold(false));
  commands.push(setTextSize(0, 0)); // Normal size

  // Store details if provided
  if (options.storeAddress) {
    commands.push(textLine(options.storeAddress));
  }
  if (options.storePhone) {
    commands.push(textLine(`Tel: ${options.storePhone}`));
  }
  commands.push(feedLines(1));

  // Transaction details - left aligned
  commands.push(setAlignment(0)); // Left alignment
  commands.push(textLine(`Receipt: ${options.transactionId}`));
  commands.push(textLine(`Date: ${options.date.toLocaleDateString()} ${options.date.toLocaleTimeString()}`));
  commands.push(textLine(`Cashier: ${options.cashierName}`));
  if (options.customerName) {
    commands.push(textLine(`Customer: ${options.customerName}`));
  }
  commands.push(doubleHorizontalLine());

  // Items header
  commands.push(textLine('Item             Qty   Price    Total'));
  commands.push(horizontalLine());

  // Items
  for (const item of options.items) {
    // Format item name to fit (max 16 chars)
    let itemName = item.name.substring(0, 16);
    itemName = itemName.padEnd(16, ' ');

    // Format quantity, price and total
    const quantityStr = item.quantity.toString().padStart(3, ' ');
    const unitPriceStr = item.unitPrice.toFixed(2).padStart(7, ' ');
    const totalStr = item.total.toFixed(2).padStart(8, ' ');

    commands.push(textLine(`${itemName} ${quantityStr} ${unitPriceStr} ${totalStr}`));
  }

  commands.push(horizontalLine());

  // Totals - right aligned
  commands.push(setAlignment(2)); // Right alignment
  commands.push(textLine(`Subtotal: ${options.subtotal.toFixed(2)}`));
  commands.push(textLine(`Tax: ${options.tax.toFixed(2)}`));
  commands.push(setBold(true));
  commands.push(textLine(`TOTAL: ${options.total.toFixed(2)}`));
  commands.push(setBold(false));
  commands.push(textLine(`Payment _Method: ${options.paymentMethod}`));

  // Loyalty points if provided
  if (options.loyaltyPoints) {
    commands.push(feedLines(1));
    commands.push(setAlignment(0)); // Left alignment
    commands.push(textLine(`Points _Earned: ${options.loyaltyPoints.earned}`));
    commands.push(textLine(`Points _Balance: ${options.loyaltyPoints.balance}`));
  }

  // Footer
  commands.push(feedLines(1));
  commands.push(setAlignment(1)); // Center alignment
  commands.push(textLine('Thank you for your purchase!'));
  commands.push(textLine('Powered by ChainSync'));

  // Feed extra lines before cutting
  commands.push(feedLines(4));

  // Open cash drawer if requested
  if (options.openDrawer) {
    commands.push(openCashDrawer());
  }

  // Cut paper if requested
  if (options.cutPaper !== false) {
    commands.push(cutPaper(1)); // Partial cut
  }

  // Combine all commands
  return combineUint8Arrays(...commands);
}

/**
 * Convert ESC/POS commands to a downloadable file for direct printing
 */
export function downloadEscposCommands(
  _commands: Uint8Array,
  _filename: string = 'receipt.bin'
): void {
  // Create a blob from the commands
  const blob = new Blob([commands], { _type: 'application/octet-stream' });

  // Create a URL for the blob
  const url = URL.createObjectURL(blob);

  // Create a download link
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;

  // Append the link to the body
  document.body.appendChild(link);

  // Click the link to start the download
  link.click();

  // Clean up
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Helper function to save ESC/POS commands to localStorage for retrieval by a local printing service
 */
export function saveEscposCommandsForPrinting(
  _commands: Uint8Array,
  _printerId: string = 'default'
): void {
  // Convert the Uint8Array to a base64 string
  const base64 = btoa(String.fromCharCode.apply(null, Array.from(commands)));

  // Save to localStorage with timestamp and printer ID
  const printJob = {
    _timestamp: new Date().toISOString(),
    printerId,
    _commands: base64
  };

  // Store in localStorage - in a real app, this would be picked up by a local service
  localStorage.setItem('chainsync_print_job', JSON.stringify(printJob));

  // Also dispatch a custom event for any local listeners
  const event = new CustomEvent('chainsync_print_request', { _detail: printJob });
  window.dispatchEvent(event);
}
