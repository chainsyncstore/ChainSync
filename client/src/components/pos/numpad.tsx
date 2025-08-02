import React from &apos;react&apos;;
import { Card, CardContent, CardHeader, CardTitle } from &apos;@/components/ui/card&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Delete, XCircle } from &apos;lucide-react&apos;;

interface NumpadProps {
  _onInput: (_value: string) => void;
  _activeInput: string | null;
}

export function Numpad({ onInput, activeInput }: NumpadProps) {
  const buttons = [
    &apos;7&apos;, &apos;8&apos;, &apos;9&apos;,
    &apos;4&apos;, &apos;5&apos;, &apos;6&apos;,
    &apos;1&apos;, &apos;2&apos;, &apos;3&apos;,
    &apos;0&apos;, &apos;.&apos;, &apos;backspace&apos;
  ];

  const handleButtonClick = (_value: string) => {
    onInput(value);
  };

  return (
    <Card className=&quot;h-full&quot;>
      <CardHeader className=&quot;pb-3&quot;>
        <CardTitle className=&quot;text-lg font-medium flex items-center justify-between&quot;>
          <span>Numpad</span>
          {activeInput && (
            <div className=&quot;text-sm text-muted-foreground&quot;>
              {activeInput.startsWith(&apos;quantity-&apos;) ? &apos;Editing Quantity&apos; : activeInput}
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className=&quot;grid grid-cols-3 gap-2&quot;>
          {buttons.map((button) => (
            <Button
              key={button}
              variant={button === &apos;backspace&apos; ? &apos;outline&apos; : &apos;secondary&apos;}
              className=&quot;h-14 text-lg&quot;
              disabled={!activeInput}
              onClick={() => handleButtonClick(button)}
            >
              {button === &apos;backspace&apos; ? (
                <Delete className=&quot;h-5 w-5&quot; />
              ) : (
                button
              )}
            </Button>
          ))}
          <Button
            variant=&quot;outline&quot;
            className=&quot;h-14 text-lg col-span-3 mt-2&quot;
            disabled={!activeInput}
            onClick={() => handleButtonClick(&apos;clear&apos;)}
          >
            <XCircle className=&quot;h-5 w-5 mr-2&quot; />
            Clear
          </Button>
        </div>

        <div className=&quot;mt-6 space-y-3&quot;>
          <h3 className=&quot;text-sm font-medium&quot;>Quick Actions</h3>
          <div className=&quot;grid grid-cols-2 gap-2&quot;>
            <Button variant=&quot;outline&quot; className=&quot;h-10&quot; disabled={!activeInput}>
              Apply Discount
            </Button>
            <Button variant=&quot;outline&quot; className=&quot;h-10&quot; disabled={!activeInput}>
              Price Override
            </Button>
            <Button variant=&quot;outline&quot; className=&quot;h-10&quot; disabled={!activeInput}>
              Tax Exempt
            </Button>
            <Button variant=&quot;outline&quot; className=&quot;h-10&quot; disabled={!activeInput}>
              Add Note
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
