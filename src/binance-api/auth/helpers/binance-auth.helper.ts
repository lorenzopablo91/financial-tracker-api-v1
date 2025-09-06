import { createHmac } from 'crypto';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';

export class BinanceAuthHelper {
    private static readonly logger = new Logger(BinanceAuthHelper.name);

    // Crear signature HMAC SHA-256
    static createSignature(message: string, secret: string): string {
        try {
            return createHmac('sha256', secret)
                .update(message)
                .digest('hex');
        } catch (error) {
            this.logger.error('Error creating Binance signature:', error);
            throw new HttpException(
                'Error creating Binance signature',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // Obtener timestamp actual
    static getTimestamp(): number {
        return Date.now();
    }

    // Crear query string desde parámetros
    static createQueryString(params: Record<string, any>): string {
        return Object.entries(params)
            .filter(([_, value]) => value !== undefined && value !== null)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
            .join('&');
    }
}
