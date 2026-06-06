/**
 * JWT §4.1: The following Claim Names are registered in the IANA
 * "JSON Web Token Claims" registry.
 * None of the claims defined below are intended to be mandatory, but rather
 * provide a starting point for a set of useful, interoperable claims.
 */
export interface Payload {
    iss?: string;
    sub?: string;
    aud?: string[] | string;
    exp?: number;
    nbf?: number;
    iat?: number;
    jti?: string;
    [key: string]: unknown;
}

/**
 * JWS §4.1.1: The "alg" value is a case-sensitive ASCII string containing
 * a StringOrURI value. This Header Parameter MUST be present.
 */
export interface Header {
    alg: Algorithm;
    typ?: string;
    cty?: string;
    crit?: string[];
    [key: string]: unknown;
}

/**
 * JWA RFC 7518: Supported cryptographic algorithms for JWT signing.
 */
export type Algorithm =
    | 'HS256'
    | 'HS384'
    | 'HS512'
    | 'PS256'
    | 'PS384'
    | 'PS512'
    | 'RS256'
    | 'RS384'
    | 'RS512'
    | 'ES256'
    | 'ES384'
    | 'none';

/**
 * Options for JWT verification.
 *
 * Provides leeway for clock skew, audience validation, and custom predicate
 * functions that must all pass for the JWT to be considered valid.
 */
export type VerifyOptions = {
    /** Leeway in seconds for the `exp` claim. Default: `1`. */
    expLeeway?: number;
    /** Leeway in seconds for the `nbf` claim. Default: `1`. */
    nbfLeeway?: number;
    /** Skip `exp` claim validation when `true`. */
    ignoreExp?: boolean;
    /** Skip `nbf` claim validation when `true`. */
    ignoreNbf?: boolean;
    /**
     * Expected audience. Must match the `aud` claim.
     * Can be a string, array of strings, or a RegExp.
     */
    audience?: string | string[] | RegExp;
    /**
     * Custom validation predicates. All must return `true` for the JWT to pass.
     */
    predicates?: (<P extends Payload>(payload: P) => boolean)[];
};
