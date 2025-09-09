import { Logger } from '@nestjs/common';
import { TokenResponse, RefreshTokenResponse } from '../interfaces/token.interface';

export class IolAuthHelper {
    private static readonly logger = new Logger(IolAuthHelper.name);

    /**
     * Construir parámetros para `application/x-www-form-urlencoded`
     */
    static buildParams(data: Record<string, string>): URLSearchParams {
        const params = new URLSearchParams();
        Object.entries(data).forEach(([key, value]) => params.append(key, value));
        return params;
    }

    /**
     * Validar que la respuesta del token sea válida
     */
    static validateTokenResponse(tokenData: TokenResponse | RefreshTokenResponse): void {
        if (!tokenData.access_token) {
            throw new Error('Token response missing access_token');
        }
    }

    /**
     * Guardar datos de un token en el contexto de la clase que lo use
     */
    static saveTokenData(
        tokenData: TokenResponse | RefreshTokenResponse,
        context: {
            setToken: (token: string | null) => void;
            setRefreshToken: (token: string | null) => void;
            setTokenExpiresAt: (date: Date | null) => void;
            setRefreshTokenExpiresAt: (date: Date | null) => void;
        },
    ): void {
        // Validar respuesta primero
        this.validateTokenResponse(tokenData);

        // Guardar tokens
        context.setToken(tokenData.access_token || null);
        context.setRefreshToken(tokenData.refresh_token || null);

        // Parsear fechas - IOL devuelve con nombres específicos
        const tokenExpiresAt = this.parseExpirationDate(
            (tokenData as any)['.expires'] || tokenData.expires, 
            'access_token'
        );
        const refreshTokenExpiresAt = this.parseExpirationDate(
            (tokenData as any)['.refreshexpires'] || tokenData.refreshexpires, 
            'refresh_token'
        );

        // Si no hay fechas absolutas, calcular desde expires_in
        const finalTokenExpiresAt = tokenExpiresAt || this.calculateExpirationFromSeconds(
            (tokenData as any).expires_in, 
            'access_token'
        );

        context.setTokenExpiresAt(finalTokenExpiresAt);
        context.setRefreshTokenExpiresAt(refreshTokenExpiresAt);
    }

    /**
     * Parsear fecha de expiración con mejor manejo de errores y logging
     */
    private static parseExpirationDate(dateValue: string | number | undefined, tokenType: string): Date | null {
        if (!dateValue) {
            this.logger.warn(`IOL Auth: Missing ${tokenType} expiration date`);
            return null;
        }

        try {
            let date: Date;

            if (typeof dateValue === 'number') {
                // Si es un timestamp Unix (segundos), convertir a milisegundos
                date = dateValue < 10000000000 ? new Date(dateValue * 1000) : new Date(dateValue);
            } else if (typeof dateValue === 'string') {
                date = new Date(dateValue);
            } else {
                this.logger.error(`IOL Auth: Unexpected date type for ${tokenType}:`, typeof dateValue, dateValue);
                return null;
            }
            
            // Verificar si la fecha es válida
            if (isNaN(date.getTime())) {
                this.logger.error(`IOL Auth: Invalid ${tokenType} date format:`, dateValue);
                return null;
            }

            // Verificar que la fecha no sea en el pasado (con margen de 1 minuto)
            const now = new Date();
            if (date.getTime() < (now.getTime() - 60000)) {
                this.logger.warn(`IOL Auth: ${tokenType} expiration date is in the past:`, date.toISOString());
            }

            return date;
        } catch (error) {
            this.logger.error(`IOL Auth: Error parsing ${tokenType} date:`, error, 'Value:', dateValue);
            return null;
        }
    }

    /**
     * Calcular fecha de expiración basada en expires_in (segundos)
     */
    private static calculateExpirationFromSeconds(expiresInSeconds: number | undefined, tokenType: string): Date | null {
        if (!expiresInSeconds || typeof expiresInSeconds !== 'number') {
            this.logger.warn(`IOL Auth: Missing or invalid expires_in for ${tokenType}:`, expiresInSeconds);
            return null;
        }

        try {
            const now = new Date();
            const expirationDate = new Date(now.getTime() + (expiresInSeconds * 1000));
            
            return expirationDate;
        } catch (error) {
            this.logger.error(`IOL Auth: Error calculating ${tokenType} expiration:`, error);
            return null;
        }
    }

    /**
     * Calcular tiempo restante hasta expiración en minutos
     */
    static getTimeUntilExpiration(expiresAt: Date | null): number | null {
        if (!expiresAt) return null;
        
        const now = new Date();
        const diffMs = expiresAt.getTime() - now.getTime();
        return Math.floor(diffMs / (1000 * 60)); // minutos
    }

    /**
     * Verificar si un token necesita renovación (con buffer)
     */
    static needsRefresh(expiresAt: Date | null, bufferMinutes: number = 1): boolean {
        if (!expiresAt) return true;
        
        const now = new Date();
        const bufferMs = bufferMinutes * 60 * 1000;
        return (expiresAt.getTime() - now.getTime()) <= bufferMs;
    }
}