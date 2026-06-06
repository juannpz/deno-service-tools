/**
 * Validates that all required environment configuration values are present.
 *
 * Iterates over the top-level groups of a configuration object and checks
 * that every nested value is truthy. If any value is falsy (empty string,
 * `undefined`, `null`, `0`, `false`), throws an error listing all missing keys.
 *
 * **Note:** This function treats `0` and `false` as falsy, which may not be
 * desirable for all configs. Use it for string-based environment configs
 * (e.g., `{ DB: { host: 'localhost' } }`) where falsy indicates a missing value.
 *
 * @template T - The configuration object type. It should be a record of groups,
 *   each containing string or primitive values.
 * @param config - The configuration object to validate.
 * @returns The same config object (unmodified) if all values are present.
 * @throws {Error} If any value in the config is falsy, with the list of missing keys.
 *
 * @example
 * ```ts
 * const env = checkEnv({
 *     DB: { host: Deno.env.get('DB_HOST'), port: Deno.env.get('DB_PORT') },
 *     AUTH: { secret: Deno.env.get('AUTH_SECRET') },
 * });
 * // Throws if any env var is missing
 * ```
 */
export function checkEnv<T>(config: T): T {
    const missingKeys: string[] = [];

    for (const groupKey in config) {
        const group = config[groupKey];

        if (group) {
            Object.entries(group).forEach(([key, value]) => {
                if (!value) {
                    missingKeys.push(key);
                }
            });
        }
    }

    if (missingKeys.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missingKeys.join(', ')}`,
        );
    }

    return config;
}
