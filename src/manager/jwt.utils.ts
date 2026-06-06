import { decodeJwt, decodeProtectedHeader, jwtVerify, SignJWT } from 'jose';
import type { Header, Payload, VerifyOptions } from './jwt.types.ts';

/**
 * Converts a `Date` or a relative offset in seconds to a numeric Unix timestamp.
 *
 * - If a `Date` is passed, returns the epoch seconds.
 * - If a `number` is passed, treats it as seconds from `Date.now()` and returns
 *   the resulting epoch seconds.
 *
 * @param exp - A Date or a number of seconds from now.
 * @returns Unix timestamp in seconds (integer).
 *
 * @example
 * ```ts
 * getNumericDate(new Date('2026-06-07'));  // returns epoch seconds
 * getNumericDate(3600);                    // returns epoch seconds 1 hour from now
 * ```
 */
export function getNumericDate(exp: number | Date): number {
    return Math.round(
        (exp instanceof Date ? exp.getTime() : Date.now() + exp * 1000) / 1000,
    );
}

/**
 * Validates that the `nbf` and `exp` claims in the payload are valid timestamps
 * and are not violated given the current time and configured leeway.
 *
 * @param payload - The JWT payload with optional `exp` and `nbf` claims.
 * @param options - Verification options controlling leeway and ignore flags.
 * @throws {Error} If the claims have invalid types.
 * @throws {RangeError} If the JWT is expired or not yet valid.
 */
export function validateTimingClaims(
    payload: Payload,
    { expLeeway = 1, nbfLeeway = 1, ignoreExp, ignoreNbf }: VerifyOptions = {},
): void {
    if (
        (payload.exp !== undefined && typeof payload.exp !== 'number') ||
        (payload.nbf !== undefined && typeof payload.nbf !== 'number')
    ) {
        throw new Error(`The jwt has an invalid 'exp' or 'nbf' claim.`);
    }

    const now = Date.now() / 1000;

    if (
        typeof payload.exp === 'number' &&
        !ignoreExp &&
        payload.exp + expLeeway < now
    ) {
        throw new RangeError('The jwt is expired.');
    }

    if (
        typeof payload.nbf === 'number' &&
        !ignoreNbf &&
        payload.nbf - nbfLeeway > now
    ) {
        throw new RangeError('The jwt is used too early.');
    }
}

/**
 * Decodes a JWT into its three constituent parts without verifying the signature.
 *
 * @template PayloadType - The expected payload type.
 * @param jwt - The JWT string to decode.
 * @returns A 3-tuple of `[header, payload, signature]`.
 * @throws {Error} If the JWT serialization is invalid.
 */
export function decode<PayloadType extends Payload | unknown = unknown>(
    jwt: string,
): [unknown, PayloadType, Uint8Array] {
    try {
        const header = decodeProtectedHeader(jwt);
        const payload = decodeJwt(jwt) as PayloadType;
        const signature = new Uint8Array();
        return [header, payload, signature];
    } catch {
        throw Error('The serialization of the jwt is invalid.');
    }
}

/**
 * Validates the structure and claims of a decoded JWT.
 * Does **not** verify the digital signature.
 *
 * @param parsed - A decoded JWT tuple `[header, payload, signature]`.
 * @param options - Verification options.
 * @returns The validated `{ header, payload, signature }` object.
 * @throws {Error} If the header or payload is invalid.
 */
export function validate(
    [header, payload, signature]: [unknown, unknown, Uint8Array],
    options?: VerifyOptions,
): {
    header: Header;
    payload: Payload;
    signature: Uint8Array;
} {
    if (
        !header || typeof header !== 'object' ||
        typeof (header as Record<string, unknown>).alg !== 'string'
    ) {
        throw new Error(
            `The jwt's 'alg' header parameter value must be a string.`,
        );
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error(`The jwt claims set is not a JSON object.`);
    }

    validateTimingClaims(payload as Payload, options);

    if (options?.audience) {
        const aud = (payload as Payload).aud;
        const audience = options.audience;
        validateAudClaim(aud, audience);
    }

    return {
        header: header as Header,
        payload: payload as Payload,
        signature,
    };
}

function validateAudClaim(
    aud: unknown,
    audience: string | string[] | RegExp,
): void {
    if (aud === undefined) {
        throw new Error("The jwt has no 'aud' claim.");
    }
    let audArray: string[];
    if (typeof aud === 'string') {
        audArray = [aud];
    } else if (Array.isArray(aud) && aud.every((v) => typeof v === 'string')) {
        audArray = aud as string[];
    } else {
        throw new Error(`The jwt has an invalid 'aud' claim.`);
    }

    const audienceArrayOrRegex: string[] | RegExp = typeof audience === 'string'
        ? [audience]
        : audience;

    const matched = audArray.some((audString) =>
        Array.isArray(audienceArrayOrRegex)
            ? audienceArrayOrRegex.includes(audString)
            : audienceArrayOrRegex.test(audString)
    );

    if (!matched) {
        throw new Error(
            "The identification with the value in the 'aud' claim has failed.",
        );
    }
}

/**
 * Verifies a JWT's signature and claims, returning the validated payload.
 *
 * @template PayloadType - The expected payload type.
 * @param jwt - The JWT string to verify.
 * @param key - The `CryptoKey` to verify the signature with. Must not be `null`.
 * @param options - Optional verification options (leeway, audience, predicates).
 * @returns A promise resolving to the decoded and validated payload.
 * @throws {Error} If verification fails for any reason.
 */
export async function verify<PayloadType extends Payload>(
    jwt: string,
    key: CryptoKey | null,
    options?: VerifyOptions,
): Promise<PayloadType> {
    if (!key) {
        throw new Error(`The jwt requires a key for verification.`);
    }

    const { payload } = await jwtVerify(jwt, key, {
        clockTolerance: Math.max(
            options?.expLeeway ?? 1,
            options?.nbfLeeway ?? 1,
        ),
        ...(options?.audience
            ? { audience: options.audience as string | string[] }
            : {}),
    });

    if (options?.predicates) {
        const typedPayload = payload as Payload;
        if (
            !options.predicates.every((predicate) => predicate(typedPayload))
        ) {
            throw new Error(
                'The payload does not satisfy all passed predicates.',
            );
        }
    }

    return payload as PayloadType;
}

function isObject(input: unknown): input is Record<string, unknown> {
    return (
        input !== null &&
        typeof input === 'object' &&
        Array.isArray(input) === false
    );
}

/**
 * Creates (signs) a new JWT from the given header, payload, and key.
 *
 * @param header - The JWT header containing at least the `alg` field.
 * @param payload - The JWT payload claims.
 * @param key - The `CryptoKey` to sign with. Must not be `null`.
 * @returns A promise resolving to the compact JWT string.
 * @throws {Error} If the payload is not a valid object or signing fails.
 */
export async function create(
    header: Header,
    payload: Payload,
    key: CryptoKey | null,
): Promise<string> {
    if (isObject(payload)) {
        if (!key) {
            throw new Error(`The alg '${header.alg}' demands a key.`);
        }
        return await new SignJWT({ ...payload })
            .setProtectedHeader({ ...header })
            .sign(key);
    } else {
        throw new Error(`The jwt claims set is not a JSON object.`);
    }
}
