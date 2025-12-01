import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import WebSocket from 'ws';

interface PriceUpdate {
    symbol: string;
    price: number;
}

@Injectable()
export class BinanceWebsocketService implements OnModuleDestroy {
    private readonly logger = new Logger(BinanceWebsocketService.name);
    private ws: WebSocket | null = null;
    private priceUpdates$ = new Subject<PriceUpdate>();
    private connectedSymbols = new Set<string>();
    private readonly WS_URL = 'wss://stream.binance.com:9443/ws';
    private reconnectAttempts = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 5;
    private reconnectTimeout: NodeJS.Timeout | null = null;

    /**
     * Obtiene stream de actualizaciones de precios
     */
    getPriceUpdates(): Observable<PriceUpdate> {
        return this.priceUpdates$.asObservable();
    }

    /**
     * Suscribirse a múltiples símbolos
     */
    subscribeToSymbols(symbols: string[]): Observable<Record<string, number>> {
        return new Observable(observer => {
            const prices: Record<string, number> = {};
            let receivedCount = 0;

            // Filtrar símbolos ya conectados
            const newSymbols = symbols.filter(s => !this.connectedSymbols.has(s));

            if (newSymbols.length === 0 && this.connectedSymbols.size > 0) {
                this.logger.log(`✅ Todos los símbolos ya están suscritos`);
                observer.next(prices);
                observer.complete();
                return;
            }

            // Inicializar conexión
            this.initWebSocket(
                newSymbols.length > 0 ? newSymbols : symbols,
                (): void => {
                    observer.next(prices);
                    observer.complete();
                }
            );

            // Suscribirse a actualizaciones de precios
            const subscription = this.priceUpdates$.subscribe(update => {
                if (symbols.includes(update.symbol)) {
                    prices[update.symbol] = update.price;
                    receivedCount++;

                    if (receivedCount === symbols.length) {
                        observer.next(prices);
                        observer.complete();
                    }
                }
            });

            return () => {
                subscription.unsubscribe();
            };
        });
    }

    /**
 * Obtener precios actuales (promise-based)
 */
    async getPricesOnce(symbols: string[]): Promise<Record<string, number>> {
        return new Promise((resolve, reject) => {
            const prices: Record<string, number> = {};
            let receivedCount = 0;
            const timeout = setTimeout(() => {
                reject(new Error(`Timeout esperando precios de: ${symbols.join(', ')}`));
            }, 15000);

            // Asegurarse de que el WebSocket esté conectado
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                this.initWebSocket(symbols, () => {
                    // Callback cuando WebSocket está listo
                    this.waitForPrices(symbols, prices, receivedCount, timeout, resolve, reject);
                });
            } else {
                // Si ya está conectado, agregar nuevos símbolos si es necesario
                const newSymbols = symbols.filter(s => !this.connectedSymbols.has(s));
                if (newSymbols.length > 0) {
                    const allSymbols = Array.from(this.connectedSymbols).concat(newSymbols);
                    this.ws.close();
                    this.ws = null;
                    this.initWebSocket(allSymbols, () => {
                        this.waitForPrices(symbols, prices, receivedCount, timeout, resolve, reject);
                    });
                } else {
                    // Ya están todos los símbolos, solo esperar a que se actualicen
                    this.waitForPrices(symbols, prices, receivedCount, timeout, resolve, reject);
                }
            }
        });
    }

    private waitForPrices(
        symbols: string[],
        prices: Record<string, number>,
        receivedCount: number,
        timeout: NodeJS.Timeout,
        resolve: Function,
        reject: Function
    ) {
        const subscription = this.priceUpdates$.subscribe(update => {
            if (symbols.includes(update.symbol)) {
                prices[update.symbol] = update.price;
                receivedCount++;

                this.logger.debug(
                    `📈 Precio recibido: ${update.symbol} = $${update.price} (${receivedCount}/${symbols.length})`
                );

                if (receivedCount === symbols.length) {
                    clearTimeout(timeout);
                    subscription.unsubscribe();
                    resolve(prices);
                }
            }
        });
    }

    /**
     * Obtiene stream continuo de precios
     */
    subscribeToPriceStream(symbol: string): Observable<number> {
        return new Observable(observer => {
            if (!this.connectedSymbols.has(symbol)) {
                this.addSymbolToStream(symbol);
            }

            const subscription = this.priceUpdates$.subscribe(update => {
                if (update.symbol === symbol) {
                    observer.next(update.price);
                }
            });

            return () => {
                subscription.unsubscribe();
            };
        });
    }

    private initWebSocket(symbols: string[], onReady?: () => void) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.logger.log(`✅ WebSocket ya conectado`);
            if (onReady) onReady();
            return;
        }

        const streams = symbols.map(s => `${s.toLowerCase()}usdt@ticker`).join('/');
        const wsUrl = `${this.WS_URL}/${streams}`;

        this.logger.log(`🔌 Conectando WebSocket: ${symbols.length} símbolos (${streams})`);

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.on('open', () => {
                this.logger.log(`✅ WebSocket conectado`);
                symbols.forEach(s => this.connectedSymbols.add(s));
                this.reconnectAttempts = 0;
                if (onReady) onReady();
            });

            this.ws.on('message', (data: string) => {
                this.handlePriceUpdate(data);
            });

            this.ws.on('error', (err: Error) => {
                this.logger.error(`❌ Error WebSocket: ${err.message}`);
                this.reconnect();
            });

            this.ws.on('close', () => {
                this.logger.warn(`⚠️ WebSocket desconectado`);
                this.ws = null;
                this.reconnect();
            });
        } catch (error: any) {
            this.logger.error(`❌ Error creando WebSocket: ${error.message}`);
            this.reconnect();
        }
    }

    private addSymbolToStream(symbol: string) {
        if (this.connectedSymbols.has(symbol)) return;

        this.logger.log(`➕ Agregando símbolo: ${symbol}`);
        const allSymbols = Array.from(this.connectedSymbols).concat([symbol]);

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.initWebSocket(allSymbols);
    }

    private handlePriceUpdate(data: string) {
        try {
            const parsed = JSON.parse(data);

            // Formato de respuesta del ticker stream
            const symbol = parsed.s; // ej: "BTCUSDT"
            const price = parseFloat(parsed.c); // closing price

            if (symbol && !isNaN(price)) {
                const symbolWithoutUSDT = symbol.replace('USDT', '');
                this.priceUpdates$.next({
                    symbol: symbolWithoutUSDT,
                    price
                });

                this.logger.debug(`📊 ${symbolWithoutUSDT}: $${price}`);
            }
        } catch (error: any) {
            this.logger.error(`Error procesando actualización: ${error.message}`);
        }
    }

    private reconnect() {
        if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
            this.logger.error(`❌ Máximo de intentos de reconexión alcanzado`);
            return;
        }

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }

        this.reconnectAttempts++;
        const delayMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

        this.logger.log(
            `🔄 Reconectando en ${delayMs}ms (intento ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`
        );

        this.reconnectTimeout = setTimeout(() => {
            const symbols = Array.from(this.connectedSymbols);
            if (symbols.length > 0) {
                this.initWebSocket(symbols);
            }
        }, delayMs);
    }

    private unsubscribeAll() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.connectedSymbols.clear();
    }

    onModuleDestroy() {
        this.unsubscribeAll();
        this.priceUpdates$.complete();
        this.logger.log('🛑 BinanceWebsocketService destruido');
    }
}