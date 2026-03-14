// src/server/middleware.ts
import type { Context } from '../../deps.ts';
import type { MiddlewareFunctionResponse } from './types.ts';

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

export function requestValidator(_schema: unknown): MiddlewareFunctionResponse {
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

export function requestTimeout(ms: number): MiddlewareFunctionResponse {
    return async (c: Context, next: () => Promise<void>) => {
        let timeoutId: number = 0;

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
