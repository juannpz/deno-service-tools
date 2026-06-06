import type { Context } from '../../deps.ts';
import type { MiddlewareFunctionResponse } from './types.ts';

/**
 * Global error handler middleware.
 *
 * Catches unhandled errors thrown by downstream handlers or middleware,
 * logs them to the console, and returns a JSON error response with status 500.
 *
 * @returns A middleware function that wraps the next handler in a try/catch.
 *
 * @example
 * ```ts
 * server.middleware(errorHandler());
 * ```
 */
export function errorHandler(): MiddlewareFunctionResponse {
    return async (c: Context, next: () => Promise<void>) => {
        try {
            await next();
        } catch (err) {
            console.error(err);
            return c.json({
                success: false,
                message: err instanceof Error
                    ? err.message
                    : 'Internal Server Error',
            }, 500);
        }
    };
}

/**
 * Request body validation middleware.
 *
 * Validates that POST, PUT, and PATCH requests contain a valid JSON body.
 * If the body is not parseable as JSON or is not a non-null object,
 * returns a 400 error response.
 *
 * **Note:** The `schema` parameter is reserved for future integration with
 * runtime validation libraries (e.g., Zod). Currently, only structural JSON
 * validity is checked.
 *
 * @param _schema - Reserved for future schema-based validation.
 * @returns A middleware function that validates the request body.
 *
 * @example
 * ```ts
 * server.middleware(requestValidator());
 * ```
 */
export function requestValidator(
    _schema?: unknown,
): MiddlewareFunctionResponse {
    return async (c: Context, next: () => Promise<void>) => {
        if (
            c.req.method === 'POST' || c.req.method === 'PUT' ||
            c.req.method === 'PATCH'
        ) {
            try {
                const body = await c.req.json();
                if (typeof body !== 'object' || body === null) {
                    return c.json({
                        success: false,
                        message: 'Invalid request body',
                    }, 400);
                }
            } catch (_e) {
                return c.json({
                    success: false,
                    message: 'Invalid JSON in request body',
                }, 400);
            }
        }
        await next();
    };
}

/**
 * Request timeout middleware.
 *
 * Rejects requests that take longer than `ms` milliseconds to process,
 * returning a 408 Request Timeout JSON response.
 *
 * @param ms - Maximum request duration in milliseconds.
 * @returns A middleware function that enforces the timeout.
 *
 * @example
 * ```ts
 * server.middleware(requestTimeout(5000));
 * ```
 */
export function requestTimeout(ms: number): MiddlewareFunctionResponse {
    return async (c: Context, next: () => Promise<void>) => {
        let timeoutId: ReturnType<typeof setTimeout> | undefined = undefined;

        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error(`Request timeout after ${ms}ms`));
            }, ms);
        });

        try {
            await Promise.race([next(), timeoutPromise]);
        } catch (err) {
            if (
                err instanceof Error && err.message.includes('Request timeout')
            ) {
                return c.json({
                    success: false,
                    message: 'Request timed out',
                }, 408);
            }
            throw err;
        } finally {
            clearTimeout(timeoutId);
        }
    };
}
