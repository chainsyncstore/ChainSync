import { Delete, XCircle } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface NumpadProps {
  onInput: (value: string) => void;
  activeInput: string | null;
}

export function Numpad({ onInput, activeInput }: NumpadProps) {
  const buttons = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', 'backspace'];

  const handleButtonClick = (value: string) => {
    onInput(value);
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium flex items-center justify-between">
          <span>Numpad</span>
          {activeInput && (
            <div className="text-sm text-muted-foreground">
              {activeInput.startsWith('quantity-') ? 'Editing Quantity' : activeInput}
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          {buttons.map(button => (
            <Button
              key={button}
              variant={button === 'backspace' ? 'outline' : 'secondary'}
              className="h-14 text-lg"
              disabled={!activeInput}
              onClick={() => handleButtonClick(button)}
            >
              {button === 'backspace' ? <Delete className="h-5 w-5" /> : button}
            </Button>
          ))}
          <Button
            variant="outline"
            className="h-14 text-lg col-span-3 mt-2"
            disabled={!activeInput}
            onClick={() => handleButtonClick('clear')}
          >
            <XCircle className="h-5 w-5 mr-2" />
            Clear
          </Button>
        </div>

        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-medium">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-10" disabled={!activeInput}>
              Apply Discount
            </Button>
            <Button variant="outline" className="h-10" disabled={!activeInput}>
              Price Override
            </Button>
            <Button variant="outline" className="h-10" disabled={!activeInput}>
              Tax Exempt
            </Button>
            <Button variant="outline" className="h-10" disabled={!activeInput}>
              Add Note
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
