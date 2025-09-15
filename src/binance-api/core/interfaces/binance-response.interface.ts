export interface BinanceAccountBalance {
  asset: string;
  free: string;
  locked: string;
}

export interface BinancePriceData {
  symbol: string;
  price: string;
}

export interface BinanceApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  source: string;
  [key: string]: any;
}

export interface CryptoData {
  name: string;
  symbol: string;
  amount: number;
  priceUSD: number;
  valueUSD: number;
  color: string;
}

export interface BinanceAccountInfo {
  makerCommission: number;
  takerCommission: number;
  buyerCommission: number;
  sellerCommission: number;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  updateTime: number;
  accountType: string;
  balances: BinanceAccountBalance[];
  permissions: string[];
}

export interface BinanceServerTimeResponse {
  serverTime: number;
}

export interface BinanceTicker24hr {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  askPrice: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

export interface BinanceSpotOrders {
  orderNo: string;
  sourceAmount: string;
  fiatCurrency: string;
  obtainAmount: string;
  cryptoCurrency: string;
  totalFee: string;
  price: string;
  status: string;
  paymentMethod: string;
  createTime: number;
  updateTime: number;
}