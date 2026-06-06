import { decodeJwt, jwtVerify, SignJWT } from 'jose';
import type { Header, Payload } from './jwt.types.ts';
import { type Result, ResUtil } from '../util/result.util.ts';
import { BaseManager } from './BaseManager.ts';

/**
 * Configuration for generating a `CryptoKey` from a raw key string.
 *
 * Passed to `crypto.subtle.importKey()` to convert the JWT secret/signature
 * into a `CryptoKey` usable by the `jose` library.
 */
export interface IGenerateKeyConfig {
    /**
     * The format of the key data. Excludes `'jwk'` since the key is derived
     * from a raw string secret.
     */
    format: Exclude<KeyFormat, 'jwk'>;
    /**
     * The algorithm to use for the key.
     * Common values: `{ name: 'HMAC', hash: 'SHA-256' }` for symmetric keys,
     * or `{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }` for asymmetric.
     */
    algorithm:
        | AlgorithmIdentifier
        | HmacImportParams
        | RsaHashedImportParams
        | EcKeyImportParams;
    /** Whether the key can be extracted. Usually `false` for security. */
    extractable: boolean;
    /** Key usages (e.g. `['sign', 'verify']`). */
    keyUsages: KeyUsage[];
}

/**
 * Manager for JSON Web Token (JWT) operations.
 *
 * Provides static methods for generating, verifying, and decoding JWTs.
 * Uses a shared secret (set via `init()`) and the `jose` library.
 * All operations return `Result<T>` for consistent error handling.
 *
 * **Important:** Call `JWTManager.init(signature)` once at application startup
 * before using any other method.
 *
 * @example
 * ```ts
 * JWTManager.init('my-256-bit-secret-key');
 *
 * const result = await JWTManager.generate(
 *     { alg: 'HS256', typ: 'JWT' },
 *     { sub: 'user123', exp: getNumericDate(3600) },
 *     keyConfig,
 * );
 * ```
 */
export class JWTManager extends BaseManager {
    private static signature: string | null = null;
    private static textEncoder = new TextEncoder();

    private constructor() {
        super();
    }

    /**
     * Initializes the JWT manager with a secret signing key.
     * Must be called once before generating or verifying tokens.
     *
     * @param signature - The secret key string used for HMAC signing.
     *
     * @example
     * ```ts
     * JWTManager.init(Deno.env.get('JWT_SECRET')!);
     * ```
     */
    public static init(signature: string): void {
        JWTManager.signature = signature;
        BaseManager.markInitialized();
    }

    /**
     * Verifies a JWT token and returns its decoded payload.
     *
     * @template T - The expected payload type (must extend `Payload`).
     * @param token - The JWT string (may include `'Bearer '` prefix, which is stripped).
     * @param keyGenerationConfig - Configuration to generate the `CryptoKey` from the secret.
     * @returns A `Promise<Result<T>>` containing the decoded payload if valid,
     *   or an error description if verification fails.
     *
     * @example
     * ```ts
     * const result = await JWTManager.verify<{ sub: string; role: string }>(
     *     authHeader,
     *     { format: 'raw', algorithm: { name: 'HMAC', hash: 'SHA-256' }, extractable: false, keyUsages: ['verify'] },
     * );
     * if (result.ok) {
     *     console.log(result.value.sub, result.value.role);
     * }
     * ```
     */
    public static async verify<T extends Payload>(
        token: string,
        keyGenerationConfig: IGenerateKeyConfig,
    ): Promise<Result<T>> {
        if (!JWTManager.signature) {
            return ResUtil.Fail(
                'Missing JWT Manager signature. Call init() first',
            );
        }

        try {
            const generateKeyResult = await JWTManager.generateKey(
                keyGenerationConfig,
            );

            if (!generateKeyResult.ok) {
                return ResUtil.Fail(
                    generateKeyResult.message,
                    generateKeyResult.error,
                );
            }

            const { payload } = await jwtVerify(
                token.replaceAll('Bearer ', ''),
                generateKeyResult.value,
            );

            return ResUtil.Succeed(payload as T);
        } catch (error) {
            return ResUtil.Fail('Failed to verify token', error);
        }
    }

    /**
     * Generates a new JWT with the given header, payload, and key configuration.
     *
     * @template T - The payload type (must extend `Payload`).
     * @param configHeader - The JWT header (e.g. `{ alg: 'HS256', typ: 'JWT' }`).
     * @param payload - The JWT payload claims.
     * @param keyGenerationConfig - Configuration to generate the `CryptoKey` from the secret.
     * @returns A `Promise<Result<string>>` containing the signed JWT string,
     *   or an error description if generation fails.
     *
     * @example
     * ```ts
     * const result = await JWTManager.generate<{ sub: string; exp: number }>(
     *     { alg: 'HS256', typ: 'JWT' },
     *     { sub: 'user123', exp: getNumericDate(3600) },
     *     keyConfig,
     * );
     * ```
     */
    public static async generate<T extends Payload>(
        configHeader: Header,
        payload: T,
        keyGenerationConfig: IGenerateKeyConfig,
    ): Promise<Result<string>> {
        if (!JWTManager.signature) {
            return ResUtil.Fail(
                'Missing JWT Manager signature. Call init() first',
            );
        }

        try {
            const generateKeyResult = await JWTManager.generateKey(
                keyGenerationConfig,
            );

            if (!generateKeyResult.ok) {
                return ResUtil.Fail(
                    generateKeyResult.message,
                    generateKeyResult.error,
                );
            }

            const jwt = await new SignJWT({ ...payload })
                .setProtectedHeader({ ...configHeader })
                .sign(generateKeyResult.value);

            return ResUtil.Succeed(jwt);
        } catch (error) {
            return ResUtil.Fail('Failed to generate token', error);
        }
    }

    /**
     * Decodes a JWT payload **without** verifying the signature.
     *
     * Useful for reading metadata (like `exp`, `sub`, `role`) from tokens
     * that have already been verified by a gateway or when the signature
     * verification is handled elsewhere.
     *
     * @template T - The expected payload type (must extend `Payload`).
     * @param token - The JWT string (may include `'Bearer '` prefix, which is stripped).
     * @returns A `Result<T>` containing the decoded payload, or an error if the token
     *   is malformed and cannot be decoded structurally.
     *
     * @example
     * ```ts
     * const result = JWTManager.decodePayload<{ exp: number }>(token);
     * if (result.ok) {
     *     const isExpired = result.value.exp * 1000 < Date.now();
     * }
     * ```
     */
    public static decodePayload<T extends Payload>(token: string): Result<T> {
        try {
            const cleanToken = token.replaceAll('Bearer ', '');
            const payload = decodeJwt(cleanToken);
            return ResUtil.Succeed(payload as T);
        } catch (error) {
            return ResUtil.Fail('Failed to decode token structure', error);
        }
    }

    /**
     * Generates a `CryptoKey` from the stored signature using the Web Crypto API.
     *
     * @param config - Key generation configuration.
     * @returns A `Promise<Result<CryptoKey>>` containing the key, or an error.
     */
    private static async generateKey(
        config: IGenerateKeyConfig,
    ): Promise<Result<CryptoKey>> {
        if (!JWTManager.signature) {
            return ResUtil.Fail(
                'Missing JWT Manager signature. Call init() first',
            );
        }

        try {
            const keyData = JWTManager.textEncoder.encode(JWTManager.signature);

            const key = await crypto.subtle.importKey(
                config.format ?? 'raw',
                keyData,
                config.algorithm ?? { name: 'HMAC', hash: 'SHA-256' },
                config.extractable ?? false,
                config.keyUsages ?? ['sign', 'verify'],
            );

            return ResUtil.Succeed(key);
        } catch (error) {
            return ResUtil.Fail('Failed to generate key', error);
        }
    }
}
