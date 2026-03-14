import {
    create,
    decode,
    type Header,
    type Payload,
    verify,
} from '../../vendor/deno.land/x/djwt@v3.0.2/mod.ts';
import { type Result, ResUtil } from '../util/result.util.ts';

export interface IGenerateKeyConfig {
    format: Exclude<KeyFormat, 'jwk'>;
    algorithm:
        | AlgorithmIdentifier
        | HmacImportParams
        | RsaHashedImportParams
        | EcKeyImportParams;
    extractable: boolean;
    keyUsages: KeyUsage[];
}

export class JWTManager {
    private static signature: string | null = null;
    private static textEncoder = new TextEncoder();

    private constructor() {}

    public static init(signature: string): void {
        JWTManager.signature = signature;
    }

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

            const decodedToken = await verify<T>(
                token.replaceAll('Bearer ', ''),
                generateKeyResult.value,
            );

            return ResUtil.Succeed(decodedToken);
        } catch (error) {
            return ResUtil.Fail('Failed to verify token', error);
        }
    }

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

            const jwt = await create(
                configHeader,
                payload,
                generateKeyResult.value,
            );

            return ResUtil.Succeed(jwt);
        } catch (error) {
            return ResUtil.Fail('Failed to generate token', error);
        }
    }

    /**
     * Decodifica un JWT para extraer su payload SIN validar la firma.
     * Útil para leer metadatos (como 'exp') de tokens en los que ya confiamos.
     */
    public static decodePayload<T extends Payload>(token: string): Result<T> {
        try {
            // Limpiamos el Bearer por si acaso, igual que en verify
            const cleanToken = token.replaceAll('Bearer ', '');

            // djwt.decode retorna una tupla: [header, payload, signature]
            const [_, payload] = decode(cleanToken);

            return ResUtil.Succeed(payload as T);
        } catch (error) {
            return ResUtil.Fail('Failed to decode token structure', error);
        }
    }

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
