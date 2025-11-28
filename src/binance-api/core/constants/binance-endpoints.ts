export const BINANCE_ENDPOINTS = {
    // Public endpoints
    TICKER_PRICE: '/api/v3/ticker/price',
    TICKER_24HR: '/api/v3/ticker/24hr',
    EXCHANGE_INFO: '/api/v3/exchangeInfo',
    PRICE: '/api/v3/klines',

    // Private endpoints (require signature)
    ACCOUNT_INFO: '/api/v3/account',

    // Savings endpoints (require signature)
    FIAT_ORDERS: '/sapi/v1/fiat/payments',

    // External URLs
    BACKUP_PRICE_URL: `https://api.coingecko.com/api/v3/simple/price`

} as const;

export const CRYPTO_METADATA = {
    BTC: { name: 'Bitcoin', color: '#F7931A' },
    ETH: { name: 'Ethereum', color: '#627EEA' },
    SOL: { name: 'Solana', color: '#F3BA2F' },
    XRP: { name: 'Ripple', color: '#0033AD' },
    USDT: { name: 'Tether', color: '#26A17B' },
} as const;