/**
 * Represents a constructor type for dependency injection and factory patterns.
 * @template T The instance type produced by the constructor.
 */
export type Constructor<T = object> = new (...args: never[]) => T;

/**
 * Represents an abstract constructor type (cannot be instantiated directly).
 * @template T The instance type produced by the constructor.
 */
export type AbstractConstructor<T = object> = abstract new (
    ...args: never[]
) => T;

/**
 * Deeply marks all properties of `T` as `readonly`.
 * Handles nested objects and arrays recursively.
 *
 * @template T The type to make deeply readonly.
 */
export type DeepReadonly<T> = T extends (infer R)[] ? readonly DeepReadonly<R>[]
    : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

/**
 * Extracts the resolved value type from a `Promise<T>`.
 *
 * @template T The promise type to unwrap.
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T;

/**
 * Makes specific keys `K` required in `T`, leaving all other keys unchanged.
 *
 * @template T The base type.
 * @template K The keys to make required.
 */
export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Makes specific keys `K` optional in `T`, leaving all other keys unchanged.
 *
 * @template T The base type.
 * @template K The keys to make optional.
 */
export type OptionalKeys<T, K extends keyof T> =
    & Omit<T, K>
    & Partial<Pick<T, K>>;

/**
 * Represents a value that may be synchronously or asynchronously produced.
 *
 * @template T The value type.
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * Any function type. Used for generic function references.
 */
export type AnyFunction = (...args: unknown[]) => unknown;
