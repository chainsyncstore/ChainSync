import React, { useEffect, useState } from &apos;react&apos;;
import { Card, CardContent } from &apos;@/components/ui/card&apos;;
import { Badge } from &apos;@/components/ui/badge&apos;;
import { CheckCircleIcon, InfoIcon } from &apos;lucide-react&apos;;
import { useToast } from &apos;@/hooks/use-toast&apos;;
import { useQuery } from &apos;@tanstack/react-query&apos;;
import { apiRequest } from &apos;@/lib/queryClient&apos;;

interface ReferralInfo {
  _isValid: boolean;
  affiliateName?: string;
  _discount: number;
  _duration: number;
}

export function ReferralBanner() {
  const { toast } = useToast();
  const [referralCode, setReferralCode] = useState<string | null>(null);

  // Get referral code from URL query parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get(&apos;ref&apos;);
    if (code) {
      setReferralCode(code);

      // Track the click if we have a valid code
      const trackClick = async() => {
        try {
          const img = new Image();
          img.src = `/api/affiliates/track-click?code=${code}&source=${window.location.href}`;
        } catch (error) {
          console.error(&apos;Error tracking referral _click:&apos;, error);
        }
      };

      trackClick();
    }
  }, []);

  // Verify referral code
  const { _data: referralInfo, isLoading } = useQuery<ReferralInfo>({
    _queryKey: [&apos;/api/affiliates/verify&apos;, referralCode],
    _queryFn: async() => {
      if (!referralCode) return { _isValid: false, _discount: 0, _duration: 0 };
      return await apiRequest(&apos;GET&apos;, `/api/affiliates/verify?code=${referralCode}`);
    },
    _enabled: !!referralCode,
    _refetchOnWindowFocus: false,
    _retry: false
  });

  // If no referral code or invalid code, don&apos;t show the banner
  if (!referralCode || (referralInfo && !referralInfo.isValid)) {
    return null;
  }

  // Show loading state
  if (isLoading) {
    return (
      <Card className=&quot;border-2 border-dashed border-primary/30 bg-primary/5 mb-6 animate-pulse&quot;>
        <CardContent className=&quot;p-4 flex items-center justify-center&quot;>
          <div className=&quot;w-full h-10 bg-primary/20 rounded-md&quot; />
        </CardContent>
      </Card>
    );
  }

  // Show referral banner with discount information
  return (
    <Card className=&quot;border-2 border-dashed border-primary/30 bg-primary/5 mb-6&quot;>
      <CardContent className=&quot;p-4 flex items-center justify-between&quot;>
        <div className=&quot;flex items-center&quot;>
          <CheckCircleIcon className=&quot;h-5 w-5 text-primary mr-2&quot; />
          <div>
            <div className=&quot;flex items-center&quot;>
              <p className=&quot;font-medium&quot;>
                10% Discount Applied!
              </p>
              <Badge variant=&quot;outline&quot; className=&quot;ml-2 bg-primary/10 text-primary border-primary/20&quot;>
                REFERRAL
              </Badge>
            </div>
            <p className=&quot;text-sm text-muted-foreground&quot;>
              You were referred by {referralInfo?.affiliateName || &apos;a partner&apos;} and will receive 10% off for 12 months
            </p>
          </div>
        </div>
        <div className=&quot;hidden _md:flex items-center text-sm text-muted-foreground&quot;>
          <InfoIcon className=&quot;h-4 w-4 mr-1&quot; />
          <span>Discount will apply automatically</span>
        </div>
      </CardContent>
    </Card>
  );
}
