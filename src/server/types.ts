import type {
    ContentfulStatusCode,
    Context,
    InvalidJSONValue,
    JSONParsed,
    JSONValue,
    SimplifyDeepArray,
    TypedResponse,
} from '../../deps.ts';
import type { HttpMethodExtended } from '../types/http.types.ts';

/**
 * Middleware function signature compatible with Hono's middleware system.
 *
 * A middleware function receives the request context and a `next` function
 * that calls the next handler in the chain. Return a `Response` to short-circuit,
 * or `void`/`undefined` to continue after `next()` completes.
 *
 * @param c - The Hono request context.
 * @param next - Function to call the next middleware/handler in the chain.
 * @returns A `Response` to short-circuit, or `void`/`Promise<void>` to continue.
 */
export type MiddlewareFunction = (
    c: Context,
    next: () => Promise<void | Response>,
) => Promise<void | Response>;

/**
 * Typed JSON response return type for Hono `c.json()` calls.
 * Encodes the response shape into the type system for end-to-end type safety.
 *
 * @template T The JSON body type.
 * @template U The HTTP status code.
 */
export type JSONRespondReturn<
    T extends JSONValue | SimplifyDeepArray<unknown> | InvalidJSONValue,
    U extends ContentfulStatusCode,
> =
    & Response
    & TypedResponse<
        SimplifyDeepArray<T> extends JSONValue
            ? JSONValue extends SimplifyDeepArray<T> ? never : JSONParsed<T>
            : never,
        U,
        'json'
    >;

/**
 * Return type for middleware functions that return error-like JSON responses.
 * Produces `{ success: false, message: string }` with status codes 400, 408, or 500.
 */
export type MiddlewareFunctionResponse = (
    c: Context,
    next: () => Promise<void>,
) => Promise<
    JSONRespondReturn<{
        success: false;
        message: string;
    }, 400 | 408 | 500> | undefined
>;

export type { Context };

/**
 * Configuration object for the `ServerBuilder` class.
 *
 * Controls the server's network binding, CORS, logging, TLS, and other behavior.
 * All properties are optional when passed to `createServer()` or the `ServerBuilder`
 * constructor; sensible defaults are applied for missing fields.
 */
export interface ServerConfig {
    /** Port number to listen on. Default: `3000`. */
    port: number;
    /** Hostname or IP address to bind to. Default: `'0.0.0.0'`. */
    hostname: string;
    /**
     * CORS configuration.
     * - `false` — disabled (default).
     * - `true` — enabled with default permissive settings.
     * - An object — passed directly to the `cors()` middleware for custom options.
     */
    cors: boolean | object;
    /** Whether to enable Hono's built-in request logger. Default: `true`. */
    logger: boolean;
    /** Array of custom middleware functions to apply globally. */
    middleware?: Array<
        (c: Context, next: () => Promise<void>) => Promise<void>
    >;
    /** TLS/HTTPS configuration. */
    https?: {
        /** Path to the TLS certificate file. */
        cert: string;
        /** Path to the TLS private key file. */
        key: string;
    };
    /** Request timeout in milliseconds. Requests exceeding this are rejected. */
    requestTimeout?: number;
    /** Maximum allowed request body size in bytes. */
    maxBodySize?: number;
    /** Custom global error handler. Receives the error and context. */
    errorHandler?: (err: Error, c: Context) => Response | Promise<Response>;
    /** Extensibility: allow arbitrary extra keys for future use. */
    [key: string]: unknown;
}

/**
 * Describes a registered route with its path, HTTP method, and handler.
 */
export interface RouteParams {
    /** URL path pattern (e.g. `'/users/:id'`). */
    path: string;
    /** HTTP method for this route. */
    method: HttpMethodExtended;
    /** The handler function that processes the request. */
    handler: (c: Context) => Response | Promise<Response>;
}

/**
 * Configuration for a single parameter (path, query, header, or body).
 *
 * @template T The runtime value type of the parameter after transformation.
 */
export interface ParamConfig<T = unknown> {
    /** The parameter name as it appears in the URL or headers. */
    name: string;
    /** Where the parameter is located: path, query, body, header, or cookie. */
    type: 'path' | 'query' | 'body' | 'header' | 'cookie';
    /** Whether the parameter is required. Missing required params return 400. */
    required?: boolean;
    /**
     * Custom validation function. Receives the raw value (string).
     * Return `true` if valid, `false` to cause a 400 error.
     */
    validator?: (value: unknown) => boolean;
    /**
     * Transformation function. Converts the raw string value to the desired type `T`.
     * @param value - The raw value (string or null).
     * @returns The transformed value of type `T`.
     */
    transform?: (value: unknown) => T;
    /** Default value used when the parameter is absent and not required. */
    defaultValue?: T;
}

/**
 * Internal shape of a built route before registration on the Hono app.
 *
 * @template PathParams - Accumulated type of path parameters.
 * @template QueryParams - Accumulated type of query parameters.
 * @template BodyType - Expected body type.
 * @template HeaderParams - Accumulated type of header parameters.
 * @template Variables - Context variables type (for Hono's `c.get`/`c.set`).
 */
export interface RouteBuilder<
    PathParams = Record<string, string>,
    QueryParams = Record<string, unknown>,
    BodyType = unknown,
    HeaderParams = Record<string, string>,
    Variables extends object = ContextVariables,
> {
    /** URL path for the route (e.g. `'/users/:id'`). */
    path: string;
    /** HTTP method as a string (e.g. `'GET'`, `'POST'`). */
    method: string;
    /** Declared path parameter configurations. */
    pathParams: ParamConfig[];
    /** Declared query parameter configurations. */
    queryParams: ParamConfig[];
    /** Optional body schema for future validation integration. */
    bodySchema?: unknown;
    /** Declared header parameter configurations. */
    headerParams: ParamConfig[];
    /**
     * The route handler function. Receives a structured context with all declared
     * parameters fully typed.
     */
    handler: (context: {
        c: Context<{ Variables: Variables }>;
        params: PathParams;
        query: QueryParams;
        body: BodyType;
        headers: HeaderParams;
    }) => Response | Promise<Response>;
}

/**
 * Base type for Hono context variables.
 *
 * Extend this when declaring typed variables to use with
 * `c.get()` and `c.set()` throughout middleware and route handlers.
 *
 * @example
 * ```ts
 * interface MyVars extends ContextVariables {
 *     userId: string;
 *     tenantId: string;
 * }
 * ```
 */
export type ContextVariables = Record<string, unknown>;

/**
 * Result of a validation function.
 * Return `{ valid: false, message: '...' }` to describe the failure reason.
 */
export type ValidationResult = {
    /** `true` if the value passed validation; `false` otherwise. */
    valid: boolean;
    /** Human-readable error message when `valid` is `false`. */
    message?: string;
};

/**
 * Re-export of the centralized `HttpMethod` type for backward compatibility.
 * Prefer importing directly from `../types/http.types.ts` in new code.
 */
export type { HttpMethod } from '../types/http.types.ts';
