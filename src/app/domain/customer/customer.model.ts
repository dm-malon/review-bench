export interface Customer {
  id: number;
  name: string;
  email: string;
}

export interface Order {
  id: number;
  customerId: number;
  amount: number;
}

export interface Invoice {
  customerId: number;
  orderIds: number[];
  total: number;
}
