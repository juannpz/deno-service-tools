import { safeFetch } from '../util/request.util.ts';
import { type Result, ResUtil } from '../util/result.util.ts';
import { JWTManager } from './JWTManager.ts';
import { BaseManager } from './BaseManager.ts';

/**
 * Configuration required for inter-service authentication.
 */
interface ServiceAuthConfig {
    /** Unique identifier for the service user. */
    userId: string;
    /** Tenant identifier for multi-tenant environments. */
    tenantId: string;
    /** Role to request in the session token. */
    role: string;
    /** Public key of the service (used by the session service for identification). */
    publicKey: string;
}

/**
 * Manager for caching and refreshing inter-service authentication tokens.
 *
 * Uses **Deno KV in in-memory mode** to cache JWT service tokens with automatic
 * expiration based on the token's `exp` claim. When a cached token expires or
 * does not exist, it transparently requests a new one from the session service.
 *
 * **Important:** Call `ServiceTokenManager.init(authConfig, entrypoint)` once
 * at application startup before calling `getValidToken()`.
 *
 * @example
 * ```ts
 * await ServiceTokenManager.init(
 *     { userId: 'svc-1', tenantId: 'tenant-a', role: 'admin', publicKey: '...' },
 *     'https://auth.internal',
 * );
 *
 * const result = await ServiceTokenManager.getValidToken();
 * if (result.ok) {
 *     headers.set('Authorization', `Bearer ${result.value}`);
 * }
 * ```
 */
export class ServiceTokenManager extends BaseManager {
    private static kv: Deno.Kv;
    private static sessionServiceEntrypoint: string | null = null;
    private static authConfig: ServiceAuthConfig;

    private constructor() {
        super();
    }

    /**
     * Initializes the Deno KV store (in-memory) and sets the session service URL
     * and authentication configuration.
     *
     * @param authConfig - The service user credentials and role.
     * @param sessionServiceEntrypoint - The base URL of the session service
     *   (e.g. `'https://auth.internal'`).
     *
     * @example
     * ```ts
     * await ServiceTokenManager.init(
     *     {
     *         userId: 'my-service',
     *         tenantId: 'org-123',
     *         role: 'admin',
     *         publicKey: Deno.env.get('SERVICE_PUBLIC_KEY')!,
     *     },
     *     Deno.env.get('SESSION_SERVICE_URL')!,
     * );
     * ```
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

        BaseManager.markInitialized();
    }

    /**
     * Retrieves an active service token from the cache or requests a new one.
     *
     * - If a cached token exists and is not expired, returns it immediately.
     * - If the cache is empty or expired, requests a new token from the session service,
     *   caches it with a TTL derived from the JWT `exp` claim, and returns it.
     *
     * @returns A `Promise<Result<string>>` containing the valid JWT string,
     *   or a failure message if the token could not be obtained.
     *
     * @example
     * ```ts
     * const tokenResult = await ServiceTokenManager.getValidToken();
     * if (tokenResult.ok) {
     *     const response = await fetch('https://api.internal/data', {
     *         headers: { Authorization: `Bearer ${tokenResult.value}` }
     *     });
     * }
     * ```
     */
    public static async getValidToken(): Promise<Result<string>> {
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

            if (cachedToken.value) {
                return ResUtil.Succeed(cachedToken.value);
            }
        } catch (error) {
            console.error('Failed to read token from Deno KV cache', error);
        }

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
     * Requests a new service token from the session service.
     *
     * @param authConfig - The authentication configuration for the service.
     * @returns A `Promise<Result<string>>` containing the JWT string or an error.
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
                            tenant_id: authConfig.tenantId,
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
