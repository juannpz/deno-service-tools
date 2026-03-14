// result.util.ts

/**
 * Represents a successful result of an operation.
 * @template T The type of the successful value.
 */
export interface OkResult<T> {
    /** Indicates that the operation was successful. */
    ok: true;
    /** The value produced by the successful operation. */
    value: T;
}

/**
 * Represents a failed result of an operation.
 */
export interface ErrResult {
    /** Indicates that the operation failed. */
    ok: false;
    /** A human-readable message describing the error. */
    message: string;
    /** The original error object or value, if available. */
    error?: unknown;
}

/**
 * A generic container for the result of an operation that can either succeed or fail.
 * This type is a union of `OkResult<T>` and `ErrResult`.
 * @template T The type of the successful value.
 */
export type Result<T> = OkResult<T> | ErrResult;

/**
 * Interface for the `ResUtil` utility object.
 */
interface ResUtil {
    /**
     * Creates an `OkResult` object representing a successful operation.
     * @template T The type of the value.
     * @param value The resulting value of the operation.
     * @returns An `OkResult<T>` object.
     */
    Succeed: <T>(value: T) => OkResult<T>;
    /**
     * Creates an `ErrResult` object representing a failed operation.
     * @param message A descriptive error message.
     * @param error The original captured error (optional, but recommended).
     * @returns An `ErrResult` object.
     */
    Fail: (message: string, error?: unknown) => ErrResult;
}

/**
 * A utility for creating `Result` objects (success or failure).
 * It serves as a generic wrapper for the outcome of any operation,
 * promoting a clear and predictable error handling pattern.
 */
export const ResUtil: ResUtil = {
    /**
     * Creates an `OkResult` object representing a successful operation.
     * @template T The type of the value.
     * @param value The resulting value of the operation.
     * @returns An `OkResult<T>` object.
     */
    Succeed<T>(value: T): OkResult<T> {
        return { ok: true, value };
    },

    /**
     * Creates an `ErrResult` object representing a failed operation.
     * @param message A descriptive error message.
     * @param error The original captured error (optional, but recommended for debugging).
     * @returns An `ErrResult` object.
     */
    Fail(message: string, error?: unknown): ErrResult {
        return { ok: false, message, error };
    },
};
