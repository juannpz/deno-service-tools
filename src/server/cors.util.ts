import { cors } from '../../deps.ts';

export type CorsOptions = Parameters<typeof cors>[0];

/**
 * Normaliza la config de CORS antes de pasarla al middleware `cors()` de Hono.
 *
 * Hono no interpreta `["*"]` como wildcard: con un array hace matching exacto
 * de cada origen, por lo que `["*"]` bloquearía todo y un array vacío también.
 * Reglas:
 * - `cors: true` (o no-objeto) → opciones por defecto (wildcard).
 * - array con `"*"` o vacío → `origin: "*"` (permitir todo; compatible con el
 *   comportamiento previo cuando la lista está vacía).
 * - array con orígenes → lista limpia (enforcement real).
 */
export function normalizeCorsOptions(
    corsConfig: boolean | object,
): CorsOptions {
    if (typeof corsConfig !== 'object' || corsConfig === null) {
        return undefined;
    }

    const options = {
        ...(corsConfig as Record<string, unknown>),
    } as CorsOptions;
    if (options && Array.isArray(options.origin)) {
        const origins = options.origin
            .map((origin) => String(origin).trim())
            .filter(Boolean);
        options.origin = origins.length === 0 || origins.includes('*')
            ? '*'
            : origins;
    }
    return options;
}
