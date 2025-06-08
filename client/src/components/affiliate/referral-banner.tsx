import { useQuery } from '@tanstack/react-query';
import { CheckCircleIcon, InfoIcon } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ReferralInfo {
  isValid: boolean;
  affiliateName?: string;
  discount: number;
  duration: number;
}

export function ReferralBanner() {
  const { toast } = useToast();
  const [referralCode, setReferralCode] = useState<string | null>(null);

  // Get referral code from URL query parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('ref');
    if (code) {
      setReferralCode(code);

      // Track the click if we have a valid code
      const trackClick = async () => {
        try {
          const img = new Image();
          img.src = `/api/affiliates/track-click?code=${code}&source=${window.location.href}`;
        } catch (error) {
          console.error('Error tracking referral click:', error);
        }
      };

      trackClick();
    }
  }, []);

  // Verify referral code
  const { data: referralInfo, isLoading } = useQuery<ReferralInfo>({
    queryKey: ['/api/affiliates/verify', referralCode],
    queryFn: async () => {
      if (!referralCode) return { isValid: false, discount: 0, duration: 0 };
      const response = await apiRequest('GET', `/api/affiliates/verify?code=${referralCode}`);
      return response.json();
    },
    enabled: !!referralCode,
    refetchOnWindowFocus: false,
    retry: false,
  });

  // If no referral code or invalid code, don't show the banner
  if (!referralCode || (referralInfo && !referralInfo.isValid)) {
    return null;
  }

  // Show loading state
  if (isLoading) {
    return (
      <Card className="border-2 border-dashed border-primary/30 bg-primary/5 mb-6 animate-pulse">
        <CardContent className="p-4 flex items-center justify-center">
          <div className="w-full h-10 bg-primary/20 rounded-md"></div>
        </CardContent>
      </Card>
    );
  }

  // Show referral banner with discount information
  return (
    <Card className="border-2 border-dashed border-primary/30 bg-primary/5 mb-6">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center">
          <CheckCircleIcon className="h-5 w-5 text-primary mr-2" />
          <div>
            <div className="flex items-center">
              <p className="font-medium">10% Discount Applied!</p>
              <Badge
                variant="outline"
                className="ml-2 bg-primary/10 text-primary border-primary/20"
              >
                REFERRAL
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              You were referred by {referralInfo?.affiliateName || 'a partner'} and will receive 10%
              off for 12 months
            </p>
          </div>
        </div>
        <div className="hidden md:flex items-center text-sm text-muted-foreground">
          <InfoIcon className="h-4 w-4 mr-1" />
          <span>Discount will apply automatically</span>
        </div>
      </CardContent>
    </Card>
  );
}
