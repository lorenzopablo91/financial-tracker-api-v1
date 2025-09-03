export const DOLAR_ENDPOINTS = {
  ['oficial']: '/v1/dolares/oficial',
  ['blue']: '/v1/dolares/blue',
  ['mep']: '/v1/dolares/bolsa',
  ['ccl']: '/v1/dolares/contadoconliqui',
  ['cripto']: '/v1/dolares/cripto',
  ['tarjeta']: '/v1/dolares/tarjeta',
} as const;

export const DOLAR_TYPES = {
  OFICIAL: 'oficial',
  BLUE: 'blue',
  MEP: 'mep',
  CCL: 'ccl',
  CRIPTO: 'cripto',
  TARJETA: 'tarjeta',
} as const;

export const DOLAR_METADATA = {
  [DOLAR_TYPES.OFICIAL]: {
    name: 'Dólar Oficial',
    description: 'Cotización oficial del Banco Central',
    color: '#28a745',
  },
  [DOLAR_TYPES.BLUE]: {
    name: 'Dólar Blue',
    description: 'Cotización del mercado paralelo',
    color: '#007bff',
  },
  [DOLAR_TYPES.MEP]: {
    name: 'Dólar MEP',
    description: 'Mercado Electrónico de Pagos',
    color: '#6f42c1',
  },
  [DOLAR_TYPES.CCL]: {
    name: 'Dólar CCL',
    description: 'Contado con Liquidación',
    color: '#fd7e14',
  },
  [DOLAR_TYPES.CRIPTO]: {
    name: 'Dólar Cripto',
    description: 'Cotización en criptomonedas',
    color: '#20c997',
  },
  [DOLAR_TYPES.TARJETA]: {
    name: 'Dólar Tarjeta',
    description: 'Para compras con tarjeta',
    color: '#dc3545',
  },
} as const;
