import type { ContentfulStatusCode } from '../../deps.ts';

/**
 * Represents a successful result of an operation.
 *
 * @template T The type of the successful value.
 */
export interface OkResult<T> {
    /** Indicates that the operation was successful. Always `true`. */
    ok: true;
    /** The value produced by the successful operation. */
    value: T;
}

/**
 * Represents a failed result of an operation.
 */
export interface ErrResult {
    /** Indicates that the operation failed. Always `false`. */
    ok: false;
    /** A human-readable message describing the error. */
    message: string;
    /** The original error object or value, if available. Use for debugging/logging. */
    error?: unknown;
    /**
     * HTTP status to use when this failure is converted into an API response.
     *
     * When present, `buildRequestResponse` uses this value instead of inferring
     * the status from `error`. When absent, the previous behavior is preserved
     * (`HttpFetchError`/`Response` keep their status, anything else maps to 500).
     */
    code?: ContentfulStatusCode;
    /**
     * Stable, machine-readable error code (e.g. `"FORBIDDEN"`, `"VALIDATION"`).
     *
     * It is independent from `message`: clients can branch on a value that does
     * not change when the human-readable text is reworded or translated.
     */
    errorCode?: string;
}

/**
 * Options accepted by {@link ResUtil.Fail} and {@link ResUtil.FailWith}.
 */
export interface FailOptions {
    /** HTTP status for the failure. */
    code?: ContentfulStatusCode;
    /** Stable, machine-readable error code. */
    errorCode?: string;
}

/**
 * A generic container for the result of an operation that can either succeed or fail.
 *
 * This is a discriminated union of `OkResult<T>` and `ErrResult`. Use `result.ok`
 * to narrow the type in conditional branches.
 *
 * @template T The type of the successful value.
 *
 * @example
 * ```ts
 * function parseNumber(input: string): Result<number> {
 *     const n = Number(input);
 *     return isNaN(n) ? ResUtil.Fail('Not a number') : ResUtil.Succeed(n);
 * }
 *
 * const result = parseNumber('42');
 * if (result.ok) {
 *     console.log(result.value * 2); // 84 - type narrowed
 * } else {
 *     console.error(result.message);
 * }
 * ```
 */
export type Result<T> = OkResult<T> | ErrResult;

/**
 * Interface for the `ResUtil` utility object.
 */
interface ResUtil {
    /**
     * Creates an `OkResult` object representing a successful operation.
     *
     * @template T The type of the value.
     * @param value The resulting value of the operation.
     * @returns An `OkResult<T>` object with `ok: true` and the value.
     */
    Succeed: <T>(value: T) => OkResult<T>;

    /**
     * Creates an `ErrResult` object representing a failed operation.
     *
     * @param message A descriptive error message.
     * @param error The original captured error (optional, but recommended for debugging).
     * @param options Optional HTTP status (`code`) and stable machine-readable
     *   `errorCode`. Both are additive: omitting them preserves the legacy
     *   behavior (`buildRequestResponse` infers the status from `error`).
     * @returns An `ErrResult` object with `ok: false` and the error details.
     */
    Fail: (
        message: string,
        error?: unknown,
        options?: FailOptions,
    ) => ErrResult;

    /**
     * Convenience variant of {@link ResUtil.Fail} for the common case where no
     * underlying `error` object exists but a specific status/`errorCode` must be
     * attached to the failure.
     *
     * @param message A descriptive error message.
     * @param options The HTTP status (`code`) and/or stable `errorCode`.
     * @param error The original captured error (optional).
     * @returns An `ErrResult` object with `ok: false`.
     *
     * @example
     * ```ts
     * return ResUtil.FailWith('User lacks permission', {
     *     code: 403,
     *     errorCode: 'FORBIDDEN',
     * });
     * ```
     */
    FailWith: (
        message: string,
        options: FailOptions,
        error?: unknown,
    ) => ErrResult;
}

/**
 * A utility for creating `Result` objects (success or failure).
 *
 * It serves as a generic wrapper for the outcome of any operation,
 * promoting a clear and predictable error handling pattern inspired
 * by Rust's `Result` type.
 *
 * @example
 * ```ts
 * // Success
 * const ok = ResUtil.Succeed({ id: 1, name: 'Alice' });
 *
 * // Failure
 * const err = ResUtil.Fail('User not found', new Error('404'));
 * ```
 */
export const ResUtil: ResUtil = {
    Succeed<T>(value: T): OkResult<T> {
        return { ok: true, value };
    },

    Fail(message: string, error?: unknown, options?: FailOptions): ErrResult {
        const result: ErrResult = { ok: false, message, error };
        if (options?.code !== undefined) result.code = options.code;
        if (options?.errorCode !== undefined) {
            result.errorCode = options.errorCode;
        }
        return result;
    },

    FailWith(
        message: string,
        options: FailOptions,
        error?: unknown,
    ): ErrResult {
        return ResUtil.Fail(message, error, options);
    },
};
