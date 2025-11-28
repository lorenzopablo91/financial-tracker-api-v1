import { Injectable, Logger } from '@nestjs/common';
import { BanInfo, CircuitState } from '../interfaces/binance-response.interface';

@Injectable()
export class BinanceCircuitBreakerService {
    private readonly logger = new Logger(BinanceCircuitBreakerService.name);

    private state: CircuitState = CircuitState.CLOSED;
    private banInfo: BanInfo | null = null;
    private failureCount: number = 0;
    private lastFailureTime: number = 0;

    // Configuración
    private readonly FAILURE_THRESHOLD = 3; // Después de 3 fallos consecutivos, abrir circuito
    private readonly TIMEOUT_WINDOW = 60000; // 1 minuto para resetear conteo de fallos
    private readonly HALF_OPEN_RETRY_AFTER = 30000; // Intentar después de 30s si no hay ban info

    /**
     * Verifica si se puede hacer una llamada a Binance
     */
    canMakeRequest(): boolean {
        // Si hay ban explícito, verificar si expiró
        if (this.banInfo) {
            const now = Date.now();
            if (now < this.banInfo.until) {
                const remainingMs = this.banInfo.until - now;
                const remainingMin = Math.ceil(remainingMs / 60000);
                this.logger.warn(
                    `🚫 Binance bloqueado: ${this.banInfo.reason}. ` +
                    `Se desbloqueará en ~${remainingMin} minutos`
                );
                return false;
            } else {
                // Ban expiró, intentar de nuevo
                this.logger.log('✅ Ban de Binance expirado, intentando reconectar...');
                this.state = CircuitState.HALF_OPEN;
                this.banInfo = null;
                this.failureCount = 0;
                return true;
            }
        }

        // Lógica del circuito
        switch (this.state) {
            case CircuitState.CLOSED:
                return true;

            case CircuitState.OPEN:
                // Verificar si pasó suficiente tiempo para intentar de nuevo
                const timeSinceLastFailure = Date.now() - this.lastFailureTime;
                if (timeSinceLastFailure > this.HALF_OPEN_RETRY_AFTER) {
                    this.logger.log('🔄 Circuit HALF_OPEN - intentando request de prueba...');
                    this.state = CircuitState.HALF_OPEN;
                    return true;
                }
                this.logger.warn(`⚠️ Circuit OPEN - bloqueando requests a Binance`);
                return false;

            case CircuitState.HALF_OPEN:
                // Solo permitir un request de prueba
                return true;

            default:
                return true;
        }
    }

    /**
     * Registra un éxito en la llamada a Binance
     */
    recordSuccess(): void {
        if (this.state === CircuitState.HALF_OPEN) {
            this.logger.log('✅ Request exitoso - Circuit CLOSED');
            this.state = CircuitState.CLOSED;
        }
        this.failureCount = 0;
        this.lastFailureTime = 0;
    }

    /**
     * Registra un error de Binance y actualiza el estado del circuito
     */
    recordFailure(error: any): void {
        const now = Date.now();
        this.lastFailureTime = now;

        // Detectar error 429 (Rate Limit)
        if (error?.status === 429 || error?.response?.status === 429) {
            this.failureCount++;
            this.logger.error(
                `❌ Rate Limit 429 detectado (${this.failureCount}/${this.FAILURE_THRESHOLD})`
            );

            // Abrir circuito después del threshold
            if (this.failureCount >= this.FAILURE_THRESHOLD) {
                this.state = CircuitState.OPEN;
                this.logger.error('🔴 Circuit OPEN - demasiados errores 429');
            }
            return;
        }

        // Detectar error 418 (IP Banned)
        if (error?.status === 418 || error?.response?.status === 418) {
            const data = error?.data || error?.response?.data;

            // Intentar extraer el timestamp del ban
            let banUntil = now + (30 * 24 * 60 * 60 * 1000); // Default: 30 días

            if (data?.msg) {
                const match = data.msg.match(/until (\d+)/);
                if (match) {
                    banUntil = parseInt(match[1]);
                }
            }

            this.banInfo = {
                until: banUntil,
                reason: data?.msg || 'IP banned by Binance'
            };

            this.state = CircuitState.OPEN;

            const banDate = new Date(banUntil).toLocaleString('es-AR', {
                timeZone: 'America/Argentina/Buenos_Aires'
            });

            this.logger.error(
                `🔴🔴🔴 BAN 418 DETECTADO 🔴🔴🔴\n` +
                `Razón: ${this.banInfo.reason}\n` +
                `Se desbloqueará: ${banDate}`
            );
            return;
        }

        // Otros errores (timeout, network, etc)
        this.failureCount++;
        this.logger.warn(`⚠️ Error en Binance (${this.failureCount}/${this.FAILURE_THRESHOLD})`);

        // Si hay muchos errores consecutivos en poco tiempo, abrir circuito
        if (this.failureCount >= this.FAILURE_THRESHOLD) {
            this.state = CircuitState.OPEN;
            this.logger.error('🔴 Circuit OPEN - múltiples fallos consecutivos');
        }

        // Resetear conteo si pasó mucho tiempo desde el último fallo
        const timeSinceLastFailure = now - this.lastFailureTime;
        if (timeSinceLastFailure > this.TIMEOUT_WINDOW) {
            this.failureCount = 1;
        }
    }

    /**
     * Obtiene el estado actual del circuito
     */
    getState(): {
        state: CircuitState;
        banInfo: BanInfo | null;
        failureCount: number;
        isBlocked: boolean;
    } {
        return {
            state: this.state,
            banInfo: this.banInfo,
            failureCount: this.failureCount,
            isBlocked: !this.canMakeRequest()
        };
    }

    /**
     * Fuerza el reseteo del circuito (para testing o admin)
     */
    reset(): void {
        this.state = CircuitState.CLOSED;
        this.banInfo = null;
        this.failureCount = 0;
        this.lastFailureTime = 0;
        this.logger.log('🔄 Circuit Breaker reseteado manualmente');
    }
}