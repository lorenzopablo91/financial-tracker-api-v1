export interface ActivoValorizado {
    id: string;
    nombre: string;
    prefijo: string;
    tipo: string;
    cantidad: number;
    costoPromedioUSD: number;
    costoPromedioARS: number | null;
    tipoCambioPromedio: number | null;
    precioMercado: number;
    costoBase: number;
    valorActual: number;
    gananciaPerdida: number;
    gananciaPorc: number;
    color: string;
    icono: string;
    porcentajeComposicion: number;
}

export interface ResumenCategoria {
    name: string;
    amount: number;
    color: string;
    percentage: number;
    percentageGain: number;
    amountGain: number;
    icon: string;
    type: string;
}

// Constantes
export const TIPO_CONFIG = {
    Criptomoneda: {
        name: 'CRIPTOMONEDAS',
        color: '#FF9F40',
        icon: 'currency_bitcoin',
        type: 'crypto'
    },
    Cedear: {
        name: 'CEDEARS',
        color: '#4BC0C0',
        icon: 'attach_money',
        type: 'cedears'
    },
    Accion: {
        name: 'ACCIONES',
        color: '#9966FF',
        icon: 'bar_chart',
        type: 'stocks'
    },
    FCI: {
        name: 'FONDO COMUN INVERSION',
        color: '#36A2EB',
        icon: 'show_chart',
        type: 'fund'
    }
} as const;