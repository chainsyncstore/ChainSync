declare module 'flutterwave-node-v3' {
  class Flutterwave {
    constructor(_publicKey: string, _secretKey: string);
    
    _Transfer: {
      initiate(params: {
        _account_bank: string;
        _account_number: string;
        _amount: number;
        _narration: string;
        _currency: string;
        _reference: string;
      }): Promise<{
        _status: string;
        _message: string;
        data?: {
          _id: number;
          _account_number: string;
          _bank_code: string;
          _full_name: string;
          _amount: number;
          _currency: string;
          _reference: string;
          _status: string;
          _debit_currency: string;
        }
      }>;
    };
    
    Subscription: {
      list(): Promise<{
        _status: string;
        _message: string;
        _data: Array<{
          _id: number;
          _amount: number;
          customer: {
            _id: number;
            _name: string;
            _email: string;
          };
          _plan: string;
          _status: string;
        }>;
      }>;
      
      activate(params: { _id: number }): Promise<{
        _status: string;
        _message: string;
        data: {
          _id: number;
          _status: string;
        };
      }>;
      
      cancel(params: { _id: number }): Promise<{
        _status: string;
        _message: string;
        data: {
          _id: number;
          _status: string;
        };
      }>;
    };
    
    Charge: {
      card(params: {
        _card_number: string;
        _cvv: string;
        _expiry_month: string;
        _expiry_year: string;
        _amount: number;
        _currency: string;
        _email: string;
        _tx_ref: string;
      }): Promise<{
        _status: string;
        _message: string;
        data?: {
          _id: number;
          _tx_ref: string;
          _amount: number;
          _currency: string;
          _charged_amount: number;
          _status: string;
        };
      }>;
    };
  }
  
  export = Flutterwave;
}