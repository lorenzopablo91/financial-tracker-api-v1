import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BinanceSignedRequest } from '../../interfaces/binance-auth.interface';
import { BinanceAuthHelper } from '../../helpers/binance-auth.helper';

@Injectable()
export class BinanceAuthService {
    private readonly logger = new Logger(BinanceAuthService.name);
    private readonly apiKey: string;
    private readonly apiSecret: string;

    constructor(private readonly configService: ConfigService) {
        this.apiKey = this.configService.get<string>('BINANCE_API_KEY') || '';
        this.apiSecret = this.configService.get<string>('BINANCE_API_SECRET') || '';

        if (!this.apiKey || !this.apiSecret) {
            throw new HttpException(
                'Binance API credentials are not configured',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // Crear request firmada para endpoints que requieren autenticación
    createSignedRequest(endpoint: string, params: Record<string, any> = {}): BinanceSignedRequest {
        const timestamp = BinanceAuthHelper.getTimestamp();

        const allParams = {
            ...params,
            timestamp,
        };

        const queryString = BinanceAuthHelper.createQueryString(allParams);

        const signature = BinanceAuthHelper.createSignature(queryString, this.apiSecret);

        const finalQueryString = `${queryString}&signature=${signature}`;
        const url = `${endpoint}?${finalQueryString}`;

        const headers = {
            'X-MBX-APIKEY': this.apiKey,
            'Content-Type': 'application/json',
        };

        this.logger.debug(`Binance signed request created for: ${endpoint}`);

        return {
            url,
            headers,
            timestamp,
            signature,
        };
    }

    createPublicHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
        };
    }

    createApiKeyHeaders(): Record<string, string> {
        return {
            'X-MBX-APIKEY': this.apiKey,
            'Content-Type': 'application/json',
        };
    }

    validateCredentials(): boolean {
        return !!(this.apiKey && this.apiSecret);
    }

    getCredentialsInfo(): { hasApiKey: boolean; hasApiSecret: boolean } {
        return {
            hasApiKey: !!this.apiKey,
            hasApiSecret: !!this.apiSecret,
        };
    }
}
