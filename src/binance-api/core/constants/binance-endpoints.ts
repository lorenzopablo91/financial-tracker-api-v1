export const BINANCE_ENDPOINTS = {
    // Public endpoints
    TICKER_PRICE: '/api/v3/ticker/price',
    TICKER_24HR: '/api/v3/ticker/24hr',
    EXCHANGE_INFO: '/api/v3/exchangeInfo',

    // Private endpoints (require signature)
    ACCOUNT_INFO: '/api/v3/account',

    // Savings endpoints
    SAVINGS_BALANCE: '/sapi/v1/lending/union/account',

    // Spot endpoints
    SPOT_ACCOUNT: '/api/v3/account',
} as const;

export const CRYPTO_METADATA = {
    BTC: { name: 'Bitcoin', color: '#F7931A' },
    ETH: { name: 'Ethereum', color: '#627EEA' },
    SOL: { name: 'Solana', color: '#F3BA2F' },
    XRP: { name: 'Ripple', color: '#0033AD' },
    USDT: { name: 'Tether', color: '#26A17B' },
} as const;