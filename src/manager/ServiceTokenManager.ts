import { safeFetch } from '../index.ts';
import { type Result, ResUtil } from '../util/result.util.ts';
import { JWTManager } from './JWTManager.ts';

interface ServiceAuthConfig {
    userId: string;
    role: string;
    publicKey: string;
}

/**
 * Provider class for managing and caching inter-service authentication tokens.
 * It uses Deno KV in memory mode to temporarily store tokens and automatically
 * handles cache invalidation and token refresh based on the JWT 'exp' claim.
 */
export class ServiceTokenManager {
    private static kv: Deno.Kv;
    private static sessionServiceEntrypoint: string | null = null;
    private static authConfig: ServiceAuthConfig;

    /**
     * Initializes the Deno KV store in strictly in-memory mode and sets the session service URL.
     * MUST be called once at application startup.
     *
     * @param {ServiceAuthConfig} authConfig - The service user id and role.
     * @param {string} sessionServiceEntrypoint - The base URL of the session service.
     * @returns {Promise<void>}
     */
    public static async init(
        authConfig: ServiceAuthConfig,
        sessionServiceEntrypoint: string,
    ): Promise<void> {
        this.sessionServiceEntrypoint = sessionServiceEntrypoint;

        this.authConfig = authConfig;

        if (!this.kv) {
            this.kv = await Deno.openKv(':memory:');
        }
    }

    /**
     * Retrieves an active service token from memory. If it does not exist or has expired,
     * it transparently requests a new one from the session service.
     *
     * @returns {Promise<Result<string>>} A Result containing the valid JWT string, or a failure message.
     */
    public static async getValidToken(): Promise<Result<string>> {
        // Validación de seguridad para asegurar que el desarrollador llamó a init() primero
        if (!this.sessionServiceEntrypoint || !this.kv) {
            return ResUtil.Fail(
                'ServiceTokenProvider is not initialized. Call init(entrypoint) at startup.',
            );
        }

        const tokenKey = [
            'auth',
            'service_token',
            this.authConfig.userId,
            this.authConfig.role,
        ];

        try {
            const cachedToken = await this.kv.get<string>(tokenKey);

            // Si Deno KV nos devuelve un valor, significa que NO ha expirado (gracias al TTL)
            if (cachedToken.value) {
                return ResUtil.Succeed(cachedToken.value);
            }
        } catch (error) {
            console.error('Failed to read token from Deno KV cache', error);
        }

        // Si llegamos aquí, el token expiró (KV lo borró) o nunca existió. Pedimos uno nuevo.
        const newTokenResult = await this.requestNewToken(this.authConfig);

        if (!newTokenResult.ok) {
            return ResUtil.Fail(newTokenResult.message, newTokenResult.error);
        }

        const newToken = newTokenResult.value;

        const decodeResult = JWTManager.decodePayload<{ exp?: number }>(
            newToken,
        );

        if (!decodeResult.ok) {
            console.error(`ServiceTokenManager: ${decodeResult.message}`);
            // Si no podemos leerlo, devolvemos el token sin cachear para no romper el flujo
            return ResUtil.Succeed(newToken);
        }

        const payload = decodeResult.value;

        try {
            if (payload.exp && typeof payload.exp === 'number') {
                const timeToLiveMs = (payload.exp * 1000) - Date.now() - 5000;

                if (timeToLiveMs > 0) {
                    await this.kv.set(tokenKey, newToken, {
                        expireIn: timeToLiveMs,
                    });
                }
            } else {
                console.warn(
                    "ServiceTokenManager: JWT no tiene 'exp'. Cacheando por 60 segundos por defecto.",
                );
                await this.kv.set(tokenKey, newToken, { expireIn: 60000 });
            }
        } catch (cacheError) {
            console.error('Failed to save token to Deno KV', cacheError);
        }

        return ResUtil.Succeed(newToken);
    }

    /**
     * Internal logic to fetch a new token from the session-service.
     */
    private static async requestNewToken(
        authConfig: ServiceAuthConfig,
    ): Promise<Result<string>> {
        try {
            const createSessionResult = await safeFetch<{ jwt: string }>(
                fetch(
                    `${this.sessionServiceEntrypoint}/v1/session/service/create`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            user_id: authConfig.userId,
                            role: authConfig.role,
                            public_key: authConfig.publicKey,
                        }),
                    },
                ),
            );

            if (!createSessionResult.ok) {
                console.error(createSessionResult.message);

                return createSessionResult;
            }

            return ResUtil.Succeed(createSessionResult.value.jwt);
        } catch (error) {
            return ResUtil.Fail(
                'Network or unexpected error occurred while fetching new service token',
                error,
            );
        }
    }
}
