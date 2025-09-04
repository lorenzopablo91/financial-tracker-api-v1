import { TokenResponse, RefreshTokenResponse } from '../interfaces/token.interface';

export class AuthTokenHelper {
    /**
     * Construir parámetros para `application/x-www-form-urlencoded`
     */
    static buildParams(data: Record<string, string>): URLSearchParams {
        const params = new URLSearchParams();
        Object.entries(data).forEach(([key, value]) => params.append(key, value));
        return params;
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
        context.setToken(tokenData.access_token);
        context.setRefreshToken(tokenData.refresh_token);
        context.setTokenExpiresAt(new Date(tokenData.expires));
        context.setRefreshTokenExpiresAt(new Date(tokenData.refreshexpires));
    }
}
