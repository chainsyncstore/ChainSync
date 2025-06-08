declare module 'flutterwave-node-v3' {
  class Flutterwave {
    constructor(publicKey: string, secretKey: string);

    Transfer: {
      initiate(params: {
        account_bank: string;
        account_number: string;
        amount: number;
        narration: string;
        currency: string;
        reference: string;
      }): Promise<{
        status: string;
        message: string;
        data?: {
          id: number;
          account_number: string;
          bank_code: string;
          full_name: string;
          amount: number;
          currency: string;
          reference: string;
          status: string;
          debit_currency: string;
        };
      }>;
    };

    Subscription: {
      list(): Promise<{
        status: string;
        message: string;
        data: Array<{
          id: number;
          amount: number;
          customer: {
            id: number;
            name: string;
            email: string;
          };
          plan: string;
          status: string;
        }>;
      }>;

      activate(params: { id: number }): Promise<{
        status: string;
        message: string;
        data: {
          id: number;
          status: string;
        };
      }>;

      cancel(params: { id: number }): Promise<{
        status: string;
        message: string;
        data: {
          id: number;
          status: string;
        };
      }>;
    };

    Charge: {
      card(params: {
        card_number: string;
        cvv: string;
        expiry_month: string;
        expiry_year: string;
        amount: number;
        currency: string;
        email: string;
        tx_ref: string;
      }): Promise<{
        status: string;
        message: string;
        data?: {
          id: number;
          tx_ref: string;
          amount: number;
          currency: string;
          charged_amount: number;
          status: string;
        };
      }>;
    };
  }

  export = Flutterwave;
}
