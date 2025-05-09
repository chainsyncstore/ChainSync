import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function PaymentTesting() {
  const [amount, setAmount] = useState("20000"); // Default amount (₦20,000)
  const [planId, setPlanId] = useState("basic");
  const { toast } = useToast();
  
  const generateReference = () => {
    return 'CHAINSYNC_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  };
  
  const [reference, setReference] = useState(generateReference());
  
  const refreshReference = () => {
    setReference(generateReference());
  };
  
  const openSimulation = () => {
    if (!amount || isNaN(parseFloat(amount))) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }
    
    // Open the payment simulation in a new window
    window.open(`/payment-simulation?reference=${reference}&amount=${amount}&plan=${planId}`, "_blank");
  };
  
  return (
    <div className="container py-10 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Payment Testing</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Payment Simulation</CardTitle>
          <CardDescription>
            Simulate payment for testing purposes. This is only available in development.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="reference">Reference</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    id="reference" 
                    value={reference} 
                    onChange={(e) => setReference(e.target.value)}
                    className="flex-1"
                  />
                  <Button variant="outline" onClick={refreshReference} type="button">
                    Refresh
                  </Button>
                </div>
              </div>
              
              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input 
                  id="amount" 
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="plan">Subscription Plan</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger id="plan">
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic Plan - ₦20,000/month</SelectItem>
                  <SelectItem value="pro">Pro Plan - ₦100,000/month</SelectItem>
                  <SelectItem value="enterprise">Enterprise Plan - Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button className="mt-4" onClick={openSimulation}>
              Simulate Payment
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}