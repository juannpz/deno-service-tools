export function checkEnv<T>(config: T): T {
    const missingKeys: string[] = [];

    for (const groupKey in config) {
        const group = config[groupKey];

        if (group) {
            Object.entries(group).forEach(([key, value]) => {
                if (!value)
                    missingKeys.push(key);
            });
        }
    }

    if (missingKeys.length > 0)
        throw new Error(`Missing required environment variables: ${missingKeys.join(', ')}`);

    return config;
}