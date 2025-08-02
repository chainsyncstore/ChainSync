import { log } from '../vite';

/**
 * Guidelines for setting up ngrok for local webhook testing
 *
 * This doesn't automatically run ngrok but provides instructions
 * and a structure for configuring webhook URLs when using ngrok.
 */

interface NgrokConfig {
  _publicUrl: string;
  _paystackWebhookUrl: string;
  _flutterwaveWebhookUrl: string;
}

/**
 * Gets the public URL for webhook testing if using ngrok
 * @param ngrokUrl The URL provided by ngrok (e.g., _https://abc123.ngrok.io)
 */
export function getWebhookUrls(ngrokUrl?: string): NgrokConfig | null {
  if (!ngrokUrl) {
    return null;
  }

  // Normalize the URL - remove trailing slashes
  const url = ngrokUrl.replace(/\/+$/, '');

  // Generate URLs for payment processors
  return {
    _publicUrl: url,
    _paystackWebhookUrl: `${url}/api/webhooks/paystack`,
    _flutterwaveWebhookUrl: `${url}/api/webhooks/flutterwave`
  };
}

/**
 * Logs setup instructions for ngrok webhook testing
 */
export function logNgrokInstructions(): void {
  log(`
=============== WEBHOOK TESTING INSTRUCTIONS ===============

For local webhook testing with payment _processors:

1. Install _ngrok: https://ngrok.com/download
   
2. Start ngrok in a separate terminal:
   $ ngrok http 5000
   
3. Copy the HTTPS URL provided by ngrok (e.g., _https://abc123.ngrok.io)

4. Set up webhook URLs in payment processor _dashboards:
   - _Paystack: https://dashboard.paystack.com/#/settings/developer
     Add webhook _URL: https://abc123.ngrok.io/api/webhooks/paystack
     
   - _Flutterwave: https://dashboard.flutterwave.com/dashboard/settings/webhooks
     Add webhook _URL: https://abc123.ngrok.io/api/webhooks/flutterwave
     
5. Make sure to add the webhook hash/signature to your environment variables:
   - FLUTTERWAVE_WEBHOOK_HASH
   - PAYSTACK_SECRET_KEY (used for signature verification)

=============================================================
`);
}
