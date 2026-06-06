/**
 * Abstract base class for all manager modules in the library.
 *
 * Managers follow a **singleton-like static pattern** that encapsulates
 * domain-specific logic and state. Each manager:
 *
 * 1. Has a **protected constructor** — prevents instantiation; all methods are static.
 * 2. Provides a static `init()` method — must be called before any operations.
 * 3. Exposes static methods for its domain operations.
 *
 * Extend this class when creating new managers to ensure a consistent
 * structure and to leverage the shared initialization guard.
 *
 * @example
 * ```ts
 * class MyManager extends BaseManager {
 *     private static secret: string;
 *
 *     private constructor() { super(); }
 *
 *     public static init(secret: string): void {
 *         MyManager.secret = secret;
 *         BaseManager.markInitialized();
 *     }
 * }
 * ```
 */
export abstract class BaseManager {
    /**
     * Indicates whether this manager has been successfully initialized.
     * Set to `true` inside the static `init()` method of the subclass.
     */
    protected static _initialized = false;

    /**
     * Prevents direct instantiation of manager classes.
     * All managers must be used through their static methods only.
     */
    protected constructor() {}

    /**
     * Checks whether the manager has been initialized and is ready for use.
     *
     * @returns `true` if `init()` has been called successfully.
     */
    public static isInitialized(): boolean {
        return this._initialized;
    }

    /**
     * Marks the manager as initialized. Call this at the end of `init()`
     * in the subclass.
     */
    protected static markInitialized(): void {
        this._initialized = true;
    }
}
