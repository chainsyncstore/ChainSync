'use strict';
Object.defineProperty(exports, '__esModule', { _value: true });
exports.getWebhookUrls = getWebhookUrls;
exports.logNgrokInstructions = logNgrokInstructions;
const vite_1 = require('../vite');
/**
 * Gets the public URL for webhook testing if using ngrok
 * @param ngrokUrl The URL provided by ngrok (e.g., _https://abc123.ngrok.io)
 */
function getWebhookUrls(ngrokUrl) {
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
function logNgrokInstructions() {
  (0, vite_1.log)(`
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
