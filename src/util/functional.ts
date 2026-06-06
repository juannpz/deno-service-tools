import type { Result } from './result.util.ts';

/**
 * Composes multiple unary functions from left to right.
 *
 * @template A The initial input type.
 * @template R The final output type.
 * @param fns - An array of functions to compose (applied left-to-right).
 * @returns A function that pipes a value through all functions sequentially.
 *
 * @example
 * ```ts
 * const addOne = (x: number) => x + 1;
 * const double = (x: number) => x * 2;
 * const piped = pipe(addOne, double);
 * piped(3); // => 8
 * ```
 */
export function pipe<TArgs extends unknown[], R>(
    ...fns: [
        (...args: TArgs) => unknown,
        ...Array<(arg: unknown) => unknown>,
        (arg: unknown) => R,
    ]
): (...args: TArgs) => R {
    return (...args: TArgs): R => {
        let result: unknown = (fns[0] as (...args: TArgs) => unknown)(...args);
        for (let i = 1; i < fns.length; i++) {
            result = (fns[i] as (arg: unknown) => unknown)(result);
        }
        return result as R;
    };
}

/**
 * Composes multiple unary functions from right to left.
 *
 * @template TArgs The initial argument types.
 * @template R The final output type.
 * @param fns - An array of functions to compose (applied right-to-left).
 * @returns A function that applies the composed functions to its arguments.
 *
 * @example
 * ```ts
 * const addOne = (x: number) => x + 1;
 * const double = (x: number) => x * 2;
 * const composed = compose(addOne, double);
 * composed(3); // => 7 (addOne(double(3)))
 * ```
 */
export function compose<TArgs extends unknown[], R>(
    ...fns: [
        (...args: TArgs) => unknown,
        ...Array<(arg: unknown) => unknown>,
        (arg: unknown) => R,
    ]
): (...args: TArgs) => R {
    return (...args: TArgs): R => {
        let result: unknown =
            (fns[fns.length - 1] as (...args: TArgs) => unknown)(...args);
        for (let i = fns.length - 2; i >= 0; i--) {
            result = (fns[i] as (arg: unknown) => unknown)(result);
        }
        return result as R;
    };
}

/**
 * Performs a side effect on a value without mutating it, then returns the original.
 *
 * @template T The value type.
 * @param fn - A function that receives the value for side effects (e.g., logging).
 * @returns A function that takes a value, applies `fn`, and returns the value.
 *
 * @example
 * ```ts
 * const logged = tap(console.log);
 * logged({ a: 1 }); // logs { a: 1 }, returns { a: 1 }
 * ```
 */
export function tap<T>(fn: (value: T) => void): (value: T) => T {
    return (value: T): T => {
        fn(value);
        return value;
    };
}

/**
 * Type guard that checks if a `Result` is an `OkResult`.
 *
 * @template T The value type of the OkResult.
 * @param result - The result to check.
 * @returns `true` if the result is successful.
 *
 * @example
 * ```ts
 * const result: Result<number> = someOperation();
 * if (isOk(result)) {
 *     console.log(result.value * 2); // TS knows result is OkResult<number>
 * }
 * ```
 */
export function isOk<T>(
    result: Result<T>,
): result is { ok: true; value: T } {
    return result.ok === true;
}

/**
 * Type guard that checks if a `Result` is an `ErrResult`.
 *
 * @template T The value type (unused in ErrResult, but required for type compatibility).
 * @param result - The result to check.
 * @returns `true` if the result is a failure.
 *
 * @example
 * ```ts
 * if (isErr(result)) {
 *     console.error(result.message);
 * }
 * ```
 */
export function isErr<T>(
    result: Result<T>,
): result is { ok: false; message: string; error?: unknown } {
    return result.ok === false;
}

/**
 * Unwraps a successful `Result`, throwing if it is an error.
 *
 * @template T The value type.
 * @param result - The result to unwrap.
 * @returns The contained value.
 * @throws If the result is a failure, throws with the error message.
 *
 * @example
 * ```ts
 * const value = unwrap(someOperation()); // throws on error
 * ```
 */
export function unwrap<T>(result: Result<T>): T {
    if (result.ok) {
        return result.value;
    }
    throw new Error(result.message);
}

/**
 * Unwraps a `Result`, returning a default value on error.
 *
 * @template T The value type.
 * @param result - The result to unwrap.
 * @param defaultValue - The value to return if the result is a failure.
 * @returns The contained value, or the default.
 *
 * @example
 * ```ts
 * const value = unwrapOr(fetchResult, []); // returns [] on error
 * ```
 */
export function unwrapOr<T>(result: Result<T>, defaultValue: T): T {
    return result.ok ? result.value : defaultValue;
}

/**
 * Maps a function over a successful `Result`.
 *
 * @template T The input value type.
 * @template U The output value type.
 * @param result - The result to map over.
 * @param fn - The mapping function applied to the value if successful.
 * @returns A new `Result` with the mapped value, or the original error.
 *
 * @example
 * ```ts
 * const result = mapResult(parseNumber('42'), n => n * 2);
 * ```
 */
export function mapResult<T, U>(
    result: Result<T>,
    fn: (value: T) => U,
): Result<U> {
    if (result.ok) {
        return { ok: true, value: fn(result.value) };
    }
    return result;
}

/**
 * Chains a function that returns a `Result` onto an existing `Result` (flatMap/bind).
 *
 * @template T The input value type.
 * @template U The output value type.
 * @param result - The result to chain.
 * @param fn - The function applied to the value if successful, returning a new Result.
 * @returns The new `Result`, or the original error.
 *
 * @example
 * ```ts
 * const result = andThen(validateInput(data), processData);
 * ```
 */
export function andThen<T, U>(
    result: Result<T>,
    fn: (value: T) => Result<U>,
): Result<U> {
    if (result.ok) {
        return fn(result.value);
    }
    return result;
}

/**
 * Creates a memoized version of a function. Results are cached by argument identity.
 *
 * @template TArgs The argument types.
 * @template TReturn The return type.
 * @param fn - The function to memoize.
 * @returns A memoized version of `fn`.
 *
 * @example
 * ```ts
 * const fib = memoize((n: number): number => n <= 1 ? n : fib(n - 1) + fib(n - 2));
 * ```
 */
export function memoize<TArgs extends unknown[], TReturn>(
    fn: (...args: TArgs) => TReturn,
): (...args: TArgs) => TReturn {
    const cache = new Map<string, TReturn>();
    return (...args: TArgs): TReturn => {
        const key = JSON.stringify(args);
        if (cache.has(key)) {
            return cache.get(key)!;
        }
        const result = fn(...args);
        cache.set(key, result);
        return result;
    };
}

/**
 * Executes an array of async operations with a concurrency limit.
 *
 * @template T The result type of each operation.
 * @param limit - Maximum number of concurrent operations.
 * @param operations - Array of async functions to execute.
 * @returns A promise resolving to an array of results (in order).
 *
 * @example
 * ```ts
 * const results = await pool(3, [
 *     () => fetch('/api/1'),
 *     () => fetch('/api/2'),
 *     () => fetch('/api/3'),
 *     () => fetch('/api/4'),
 * ]);
 * ```
 */
export async function pool<T>(
    limit: number,
    operations: Array<() => Promise<T>>,
): Promise<Result<T>[]> {
    const results: Promise<Result<T>>[] = [];
    const executing: Promise<void>[] = [];

    for (const op of operations) {
        const promise = op()
            .then((value) => ({ ok: true, value } as Result<T>))
            .catch((error) => ({
                ok: false,
                message: error instanceof Error
                    ? error.message
                    : 'Unknown error',
                error,
            } as Result<T>));

        results.push(promise);

        if (limit <= operations.length) {
            const execution = promise.then(() => {
                const index = executing.indexOf(execution);
                if (index > -1) executing.splice(index, 1);
            });
            executing.push(execution);

            if (executing.length >= limit) {
                await Promise.race(executing);
            }
        }
    }

    return Promise.all(results);
}
