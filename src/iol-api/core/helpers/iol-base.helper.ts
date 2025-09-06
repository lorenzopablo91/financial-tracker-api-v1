import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { AxiosError } from 'axios';
import { IolApiResponse } from '../interfaces/iol-response.interface';

export class IolBaseHelper {
    private static readonly logger = new Logger('IolApiHelper');

    // Manejo de errores de la API de IOL
    static handleError(error: AxiosError): never {
        this.logger.error(`IOL API Error:`, {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message,
        });

        if (error.response?.status === 401) {
            throw new HttpException('Token IOL inválido o expirado', HttpStatus.UNAUTHORIZED);
        }

        if (error.response?.status === 403) {
            throw new HttpException('Acceso prohibido a recurso IOL', HttpStatus.FORBIDDEN);
        }

        if (error.response?.status === 404) {
            throw new HttpException('Recurso IOL no encontrado', HttpStatus.NOT_FOUND);
        }

        if (error.response?.status && error.response?.status >= 500) {
            throw new HttpException('Error interno del servidor IOL', HttpStatus.BAD_GATEWAY);
        }

        throw new HttpException(
            (error.response?.data as any)?.message || 'Error al comunicarse con IOL API',
            error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
    }

    // Formato de respuestas
    static formatResponse<T>(data: T, additionalInfo?: Record<string, any>): IolApiResponse<T> {
        return {
            success: true,
            data,
            timestamp: new Date().toISOString(),
            ...additionalInfo,
        };
    }
}
