import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { type Result, ResUtil } from './result.util.ts';

// --- API Response Final Types Definition ---

export type SuccessApiResponse<T> = {
    success: true;
    data: T;
    extra?: unknown;
};

export type FailureApiResponse = {
    success: false;
    message: string;
    detail?: string;
    code: ContentfulStatusCode;
    extra?: unknown;
};

export type ApiResponse<T> = SuccessApiResponse<T> | FailureApiResponse;

// --- Function #1: Execute the request and return a `Result` ---

export async function safeFetch<T>(
    fetchPromise: Promise<Response>,
): Promise<Result<T>> {
    try {
        const response = await fetchPromise;

        if (!response.ok) {
            let errorMessage = `Request failed with status ${response.status}`;
            // Mantenemos el response por defecto para que el Case 1 siga funcionando si no hay JSON
            let errorDetails: unknown = response;

            try {
                const clonedResponse = response.clone();
                const errorBody = await clonedResponse.json() as Record<
                    string,
                    unknown
                >;

                if (errorBody && typeof errorBody === 'object') {
                    // Rescatamos el mensaje
                    if (typeof errorBody.error === 'string') {
                        errorMessage = errorBody.error;
                    } else if (typeof errorBody.message === 'string') {
                        errorMessage = errorBody.message;
                    }

                    // ¡EL CAMBIO CLAVE! Rescatamos el detalle JSON del otro microservicio o API externa
                    if (errorBody.detail !== undefined) {
                        errorDetails = errorBody.detail;
                    } else if (
                        errorBody.error !== undefined &&
                        typeof errorBody.error !== 'string'
                    ) {
                        errorDetails = errorBody.error;
                    } else {
                        errorDetails = errorBody;
                    }
                }
            } catch (_) {
                // ignored.
            }

            // Enviamos el detalle extraído, ya no forzamos el objeto Response crudo
            return ResUtil.Fail(errorMessage, errorDetails);
        }

        try {
            const data = await response.json() as T;
            return ResUtil.Succeed(data);
        } catch (parsingError) {
            return ResUtil.Fail('Failed to parse JSON response', parsingError);
        }
    } catch (networkError) {
        return ResUtil.Fail(
            'A network or unexpected error occurred',
            networkError,
        );
    }
}

// --- Function #2: Build the final API response from a `Result` ---

// 1. Sobrecarga para el caso fallido:
// Quitamos el <T> porque un error no devuelve datos. TS hace match perfecto por la forma.
export function buildRequestResponse(
    result: { ok: false; message: string; error?: unknown },
    extra?: unknown,
): FailureApiResponse;

// 2. Sobrecarga para el caso exitoso:
// Aquí sí necesitamos <T> para pasárselo a SuccessApiResponse.
export function buildRequestResponse<T>(
    result: { ok: true; value: T },
    extra?: unknown,
): SuccessApiResponse<T>;

// 3. Sobrecarga genérica: (El comodín)
// Para cuando pasas el Result crudo sin verificar previamente.
export function buildRequestResponse<T>(
    result: Result<T>,
    extra?: unknown,
): ApiResponse<T>;

export function buildRequestResponse<T>(
    result: Result<T>,
    extra?: unknown,
): ApiResponse<T> {
    if (result.ok) {
        return {
            success: true,
            data: result.value,
            extra,
        };
    }

    const { message, error } = result;

    // Case 1: The error is a `Response` object from a failed fetch (e.g., 404, sin JSON body).
    if (error instanceof Response) {
        return {
            success: false,
            message,
            detail: error.statusText,
            code: error.status as ContentfulStatusCode,
            extra,
        };
    }

    // Case 2: The error is a standard `Error` instance.
    if (error instanceof Error) {
        return {
            success: false,
            message,
            detail: error.message,
            code: 500,
            extra,
        };
    }

    // Case 3: The error is a parsed plain object/string from another microservice
    if (error) {
        return {
            success: false,
            message,
            detail: typeof error === 'string' ? error : JSON.stringify(error),
            code: 500,
            extra,
        };
    }

    // Case 4: Unknown error.
    return {
        success: false,
        message,
        code: 500,
        extra,
    };
}

/**
 * Builds a URL by dynamically injecting query parameters.
 * Automatically filters out `undefined` or `null` values, but preserves
 * booleans (`false`) and numeric values (`0`).
 * * @param baseUrl The base URL (e.g., "http://api.local/v1/crud/product").
 * @param params An object containing the parameters (e.g., { is_active: false, name: "Coca" }).
 * @returns A URL instance ready to be used with .toString().
 */
export function buildTargetUrl(
    baseUrl: string,
    params: Record<string, unknown> = {},
): URL {
    const url = new URL(baseUrl);

    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
            url.searchParams.append(key, String(value));
        }
    }

    return url;
}
