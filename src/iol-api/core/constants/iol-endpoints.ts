export const IOL_ENDPOINTS = {
  // Auth
  TOKEN: '/token',

  // Portfolio
  PORTFOLIO_USA: '/portafolio/estados-unidos',
  PORTFOLIO_ARG: '/portafolio/argentina',

  // Accounts
  ACCOUNTS: '/cuentas',

  // Instruments
  INSTRUMENTS: '/instrumentos',

  // Quotes
  QUOTES: '/cotizaciones',

  // Operations
  OPERATIONS: '/operaciones',

  // Market Data
  MARKET_DATA: '/mercados',

  // Cotización por símbolo
  COTIZACION: (mercado: string, simbolo: string) =>
    `/${mercado}/Titulos/${simbolo}/cotizacion`,
} as const;
