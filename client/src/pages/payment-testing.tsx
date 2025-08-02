import { useState } from &apos;react&apos;;
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from &apos;@/components/ui/card&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { Label } from &apos;@/components/ui/label&apos;;
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from &apos;@/components/ui/select&apos;;
import { useToast } from &apos;@/hooks/use-toast&apos;;

export default function PaymentTesting() {
  const [amount, setAmount] = useState(&apos;20000&apos;); // Default amount (₦20,000)
  const [planId, setPlanId] = useState(&apos;basic&apos;);
  const { toast } = useToast();

  const generateReference = () => {
    return &apos;CHAINSYNC_&apos; + Date.now() + &apos;_&apos; + Math.floor(Math.random() * 1000);
  };

  const [reference, setReference] = useState(generateReference());

  const refreshReference = () => {
    setReference(generateReference());
  };

  const openSimulation = () => {
    if (!amount || isNaN(parseFloat(amount))) {
      toast({
        _title: &apos;Invalid amount&apos;,
        _description: &apos;Please enter a valid amount&apos;,
        _variant: &apos;destructive&apos;
      });
      return;
    }

    // Open the payment simulation in a new window
    window.open(`/payment-simulation?reference=${reference}&amount=${amount}&plan=${planId}`, &apos;_blank&apos;);
  };

  return (
    <div className=&quot;container py-10 max-w-4xl&quot;>
      <h1 className=&quot;text-2xl font-bold mb-6&quot;>Payment Testing</h1>

      <Card>
        <CardHeader>
          <CardTitle>Payment Simulation</CardTitle>
          <CardDescription>
            Simulate payment for testing purposes. This is only available in development.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className=&quot;grid gap-4&quot;>
            <div className=&quot;grid grid-cols-2 gap-4&quot;>
              <div>
                <Label htmlFor=&quot;reference&quot;>Reference</Label>
                <div className=&quot;flex items-center gap-2&quot;>
                  <Input
                    id=&quot;reference&quot;
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className=&quot;flex-1&quot;
                  />
                  <Button variant=&quot;outline&quot; onClick={refreshReference} type=&quot;button&quot;>
                    Refresh
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor=&quot;amount&quot;>Amount</Label>
                <Input
                  id=&quot;amount&quot;
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder=&quot;Enter amount&quot;
                />
              </div>
            </div>

            <div>
              <Label htmlFor=&quot;plan&quot;>Subscription Plan</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger id=&quot;plan&quot;>
                  <SelectValue placeholder=&quot;Select a plan&quot; />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=&quot;basic&quot;>Basic Plan - ₦20,000/month</SelectItem>
                  <SelectItem value=&quot;pro&quot;>Pro Plan - ₦100,000/month</SelectItem>
                  <SelectItem value=&quot;enterprise&quot;>Enterprise Plan - Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button className=&quot;mt-4&quot; onClick={openSimulation}>
              Simulate Payment
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
