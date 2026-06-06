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
     * @returns An `ErrResult` object with `ok: false` and the error details.
     */
    Fail: (message: string, error?: unknown) => ErrResult;
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

    Fail(message: string, error?: unknown): ErrResult {
        return { ok: false, message, error };
    },
};
