/**
 * Validates that all required environment configuration values are present.
 *
 * Iterates over the top-level groups of a configuration object and checks
 * that every nested value is present. A value is considered missing when it
 * is falsy — with one exception: a **boolean `false`** is a legitimate value
 * (e.g. `MINIO_USE_SSL=false`), so it does NOT count as missing.
 *
 * Missing (throws): `undefined`, `null`, `""`, `0`, `NaN`.
 * Present (ok): any other value, including boolean `false`.
 *
 * @template T - The configuration object type. It should be a record of groups,
 *   each containing string, number or boolean values.
 * @param config - The configuration object to validate.
 * @returns The same config object (unmodified) if all values are present.
 * @throws {Error} If any value in the config is missing, with the list of missing keys.
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
                if (!value && typeof value !== 'boolean') {
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
