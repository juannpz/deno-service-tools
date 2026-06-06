import type { ContentfulStatusCode, Hono } from '../../deps.ts';
import type { Context } from '../../deps.ts';
import type {
    ContextVariables,
    MiddlewareFunction,
    ParamConfig,
    RouteBuilder,
    ValidationResult,
} from './types.ts';
import type { HttpMethod } from '../types/http.types.ts';

function isErrorWithStatus(error: unknown): error is { status: number } {
    return (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        typeof (error as { status: unknown }).status === 'number'
    );
}

/**
 * Typed route definition using the builder pattern.
 *
 * The `Route` class provides a fluent API for declaring HTTP endpoints with
 * compile-time type inference across path parameters, query parameters, request
 * bodies, and headers. Generic type parameters accumulate as methods are chained,
 * so the final `.handler()` callback receives a fully typed context object.
 *
 * @template P - Accumulated type of path parameters.
 * @template Q - Accumulated type of query parameters.
 * @template B - Expected request body type.
 * @template H - Accumulated type of header parameters.
 * @template V - Hono context variables type.
 *
 * @example
 * ```ts
 * Router.get('/users/:id')
 *     .pathParam('id')
 *     .queryParam('page')
 *     .handler(({ c, params, query }) => {
 *         // params.id is string, query.page is string
 *         return c.json({ user: params.id, page: query.page });
 *     });
 * ```
 */
export class Route<
    P extends Record<string, unknown> = Record<string, string>,
    Q extends Record<string, unknown> = Record<string, unknown>,
    B extends Record<string, unknown> = Record<string, unknown>,
    H extends Record<string, unknown> = Record<string, string>,
    V extends ContextVariables = ContextVariables,
> {
    private _builder: RouteBuilder<P, Q, B, H, V> = {
        path: '',
        method: 'GET',
        pathParams: [],
        queryParams: [],
        headerParams: [],
        handler: () => new Response('Not implemented'),
    };
    private _middlewares: MiddlewareFunction[] = [];
    private _description = '';
    private _bodyValidator?: (body: unknown) => ValidationResult;
    private _tags: string[] = [];

    /**
     * Creates a new route definition for the given path.
     *
     * @param path - The URL path pattern (e.g. `'/users/:id'`).
     */
    constructor(path: string) {
        this._builder.path = path;
    }

    /**
     * Sets the HTTP method for this route.
     *
     * @param method - One of `'GET'`, `'POST'`, `'PUT'`, `'DELETE'`, or `'PATCH'`.
     * @returns The route instance for chaining.
     */
    public method(method: HttpMethod): this {
        this._builder.method = method;
        return this;
    }

    /**
     * Sets the route method to GET.
     * @returns The route instance for chaining.
     */
    public get(): this {
        return this.method('GET');
    }

    /**
     * Sets the route method to POST.
     * @returns The route instance for chaining.
     */
    public post(): this {
        return this.method('POST');
    }

    /**
     * Sets the route method to PUT.
     * @returns The route instance for chaining.
     */
    public put(): this {
        return this.method('PUT');
    }

    /**
     * Sets the route method to DELETE.
     * @returns The route instance for chaining.
     */
    public delete(): this {
        return this.method('DELETE');
    }

    /**
     * Sets the route method to PATCH.
     * @returns The route instance for chaining.
     */
    public patch(): this {
        return this.method('PATCH');
    }

    /**
     * Declares a path parameter for this route.
     *
     * The route's generic type `P` is extended with the new key-value pair,
     * so the handler context receives the parameter fully typed.
     *
     * @template K - The parameter name (literal string type).
     * @template V - The parameter value type after transformation.
     * @param name - The parameter name as it appears in the path (e.g. `'id'` for `'/users/:id'`).
     * @param options - Optional validator, transform, required flag, and default value.
     * @returns The route instance with the updated `P` type for chaining.
     */
    public pathParam<K extends string, V>(
        name: K,
        options: Omit<ParamConfig<V>, 'name' | 'type'> = {},
    ): Route<P & Record<K, V>, Q, B, H> {
        this._builder.pathParams.push({
            name,
            type: 'path',
            ...options,
        });
        return this as unknown as Route<P & Record<K, V>, Q, B, H>;
    }

    /**
     * Declares a query parameter for this route.
     *
     * The route's generic type `Q` is extended with the new key-value pair.
     *
     * @template K - The query parameter name (literal string type).
     * @template V - The parameter value type after transformation.
     * @param name - The query parameter name.
     * @param options - Optional validator, transform, required flag, and default value.
     * @returns The route instance with the updated `Q` type for chaining.
     */
    public queryParam<K extends string, V>(
        name: K,
        options: Omit<ParamConfig<V>, 'name' | 'type'> = {},
    ): Route<P, Q & Record<K, V>, B, H> {
        this._builder.queryParams.push({
            name,
            type: 'query',
            ...options,
        });
        return this as unknown as Route<P, Q & Record<K, V>, B, H>;
    }

    /**
     * Declares the expected request body type.
     *
     * This updates the route's generic type `B` so the handler context
     * receives the body with the specified type.
     *
     * @template T - The expected body type.
     * @returns The route instance with the updated `B` type for chaining.
     */
    public body<T extends Record<string, unknown>>(): Route<P, Q, T, H> {
        return this as unknown as Route<P, Q, T, H>;
    }

    /**
     * Declares a header parameter for this route.
     *
     * The route's generic type `H` is extended with the new key-value pair.
     *
     * @template K - The header name (literal string type).
     * @template V - The header value type after transformation.
     * @param name - The HTTP header name (case-insensitive).
     * @param options - Optional validator, transform, required flag, and default value.
     * @returns The route instance with the updated `H` type for chaining.
     */
    public headerParam<K extends string, V>(
        name: K,
        options: Omit<ParamConfig<V>, 'name' | 'type'> = {},
    ): Route<P, Q, B, H & Record<K, V>> {
        this._builder.headerParams.push({
            name,
            type: 'header',
            ...options,
        });
        return this as unknown as Route<P, Q, B, H & Record<K, V>>;
    }

    /**
     * Sets a human-readable description for this route.
     * Useful for documentation generation and OpenAPI integration.
     *
     * @param description - The route description text.
     * @returns The route instance for chaining.
     */
    public describe(description: string): this {
        this._description = description;
        return this;
    }

    /**
     * Adds OpenAPI-style tags to this route for grouping in documentation.
     *
     * @param tags - One or more tag strings.
     * @returns The route instance for chaining.
     */
    public tag(...tags: string[]): this {
        this._tags.push(...tags);
        return this;
    }

    /**
     * Attaches a custom middleware function to this route.
     * Middleware is executed in order before the handler.
     *
     * @param middlewareFn - The middleware function.
     * @returns The route instance for chaining.
     */
    public useMiddleware(middlewareFn: MiddlewareFunction): this {
        this._middlewares.push(middlewareFn);
        return this;
    }

    /**
     * Attaches a body validation function to this route.
     * The validator is invoked after parsing the JSON body and before the handler.
     *
     * @template T - The expected body type for the validator.
     * @param validator - A function that receives the parsed body and returns a `ValidationResult`.
     * @returns The route instance for chaining.
     */
    public validateBody<T>(validator: (body: T) => ValidationResult): this {
        this._bodyValidator = validator as (body: unknown) => ValidationResult;
        return this;
    }

    /**
     * Adds a `Cache-Control` header middleware to this route.
     *
     * @param maxAge - Cache duration in seconds.
     * @returns The route instance for chaining.
     */
    public cache(maxAge: number): this {
        return this.useMiddleware(async (c, next) => {
            await next();
            c.header('Cache-Control', `max-age=${maxAge}`);
        });
    }

    /**
     * Adds a placeholder rate-limiting middleware to this route.
     * Currently logs a message; replace with a real rate limiter in production.
     *
     * @param options - Rate limit configuration.
     * @param options.limit - Maximum number of requests.
     * @param options.window - Time window in seconds.
     * @returns The route instance for chaining.
     */
    public rateLimit(options: { limit: number; window: number }): this {
        return this.useMiddleware(async (_c, next) => {
            console.log(
                `Rate limiting: ${options.limit} requests per ${options.window}s`,
            );
            await next();
        });
    }

    /**
     * Adds an authentication middleware that checks for an `Authorization` header.
     *
     * @param strategy - Identifier for the auth strategy (logged, not enforced). Default: `'default'`.
     * @returns The route instance for chaining.
     */
    public authenticate(strategy: string = 'default'): this {
        return this.useMiddleware(async (c, next) => {
            const authHeader = c.req.header('Authorization');
            if (!authHeader) {
                return c.json(
                    { error: 'Authentication required' },
                    401 as ContentfulStatusCode,
                );
            }
            console.log(`Using auth strategy: ${strategy}`);
            await next();
        });
    }

    /**
     * Sets the route handler function.
     *
     * The handler receives a structured context with all declared parameters
     * (path, query, body, headers) and the Hono context object.
     *
     * @param fn - The handler function.
     * @returns The route instance for chaining.
     */
    public handler(
        fn: (context: {
            /** The Hono request context with access to `c.get`/`c.set`, `c.req`, `c.json`, etc. */
            c: Context<{ Variables: V }>;
            /** Fully typed path parameters declared via `pathParam()`. */
            params: P;
            /** Fully typed query parameters declared via `queryParam()`. */
            query: Q;
            /** The parsed request body typed via `body()`. */
            body: B;
            /** Fully typed header parameters declared via `headerParam()`. */
            headers: H;
        }) => Response | Promise<Response>,
    ): this {
        this._builder.handler = fn as (
            context: {
                c: Context<{ Variables: V }>;
                params: P;
                query: Q;
                body: B;
                headers: H;
            },
        ) => Response | Promise<Response>;
        return this;
    }

    /**
     * Changes the context variables type for this route.
     *
     * Use this when the route expects different variables than the default
     * (e.g., after authentication middleware has set user info).
     *
     * @template NewV - The new context variables type.
     * @returns The route instance with the updated `V` type.
     */
    public withVariables<NewV extends ContextVariables>(): Route<
        P,
        Q,
        B,
        H,
        NewV
    > {
        return this as unknown as Route<P, Q, B, H, NewV>;
    }

    /**
     * Registers this route on a Hono application instance.
     *
     * This method is called internally by `ServerBuilder.addRoute()`.
     * It wires up parameter extraction, validation, transformation,
     * middleware execution, and error handling.
     *
     * @template AppV - The Hono app's context variables type.
     * @param app - The Hono app instance to register on.
     */
    public register<AppV extends V>(app: Hono<{ Variables: AppV }>): void {
        const routeHandler = async (c: Context<{ Variables: AppV }>) => {
            const params = {} as P;
            for (const param of this._builder.pathParams) {
                const value = c.req.param(param.name);
                if (param.validator && !param.validator(value)) {
                    return c.json(
                        { error: `Invalid path parameter: ${param.name}` },
                        400 as ContentfulStatusCode,
                    );
                }
                const transformedValue = param.transform
                    ? param.transform(value)
                    : value;
                Object.assign(params, { [param.name]: transformedValue });
            }

            const query = {} as Q;
            const url = new URL(c.req.url);
            for (const param of this._builder.queryParams) {
                const value = url.searchParams.get(param.name);

                if (param.required && (value === null || value === '')) {
                    return c.json({
                        error:
                            `Missing required query parameter: ${param.name}`,
                    }, 400 as ContentfulStatusCode);
                }

                if (
                    value !== null && param.validator && !param.validator(value)
                ) {
                    return c.json(
                        { error: `Invalid query parameter: ${param.name}` },
                        400 as ContentfulStatusCode,
                    );
                }

                const transformedValue = value !== null && param.transform
                    ? param.transform(value)
                    : (value !== null ? value : param.defaultValue);

                Object.assign(query, { [param.name]: transformedValue });
            }

            let body = {} as B;
            try {
                const contentLength = c.req.header('content-length');
                const contentType = c.req.header('content-type');

                if (
                    contentLength && contentLength !== '0' &&
                    contentType?.includes('application/json')
                ) {
                    body = await c.req.json();

                    if (this._bodyValidator) {
                        const validation = this._bodyValidator(body);
                        if (!validation.valid) {
                            const errorMessage = validation.message ||
                                'Invalid request body format';
                            return c.json(
                                { error: errorMessage },
                                400 as ContentfulStatusCode,
                            );
                        }
                    }
                }
            } catch (_e) {
                console.error(_e);

                return c.json(
                    { error: 'Invalid JSON body' },
                    400 as ContentfulStatusCode,
                );
            }

            const headers = {} as H;
            for (const param of this._builder.headerParams) {
                const value = c.req.header(param.name);

                if (param.required && !value) {
                    return c.json(
                        { error: `Missing required header: ${param.name}` },
                        400 as ContentfulStatusCode,
                    );
                }

                if (value && param.validator && !param.validator(value)) {
                    return c.json(
                        { error: `Invalid header: ${param.name}` },
                        400 as ContentfulStatusCode,
                    );
                }

                const transformedValue = value && param.transform
                    ? param.transform(value)
                    : (value || param.defaultValue);

                Object.assign(headers, { [param.name]: transformedValue });
            }

            try {
                return await this._builder.handler({
                    c: c as unknown as Context<{ Variables: V }>,
                    params,
                    query,
                    body,
                    headers,
                });
            } catch (error) {
                console.error('Route handler error:', error);
                if (error instanceof Response) {
                    return error;
                }
                const status = isErrorWithStatus(error) ? error.status : 500;
                const message = error instanceof Error
                    ? error.message
                    : 'Internal server error';
                return c.json(
                    { error: message },
                    status as ContentfulStatusCode,
                );
            }
        };

        const registerRoute = (method: string) => {
            const handlers = [...this._middlewares, routeHandler] as const;

            switch (method) {
                case 'GET':
                    app.get(this._builder.path, ...handlers);
                    break;
                case 'POST':
                    app.post(this._builder.path, ...handlers);
                    break;
                case 'PUT':
                    app.put(this._builder.path, ...handlers);
                    break;
                case 'DELETE':
                    app.delete(this._builder.path, ...handlers);
                    break;
                case 'PATCH':
                    app.patch(this._builder.path, ...handlers);
                    break;
            }
        };

        registerRoute(this._builder.method);
    }

    /**
     * Gets the human-readable description of this route.
     * @returns The route description, or an empty string if none was set.
     */
    public get description(): string {
        return this._description;
    }
}

/**
 * Creates a new `Route` instance for the given path.
 * The HTTP method defaults to `GET`; chain `.post()`, `.put()`, etc. to change it.
 *
 * @param path - The URL path pattern (e.g. `'/users/:id'`).
 * @returns A new `Route` instance ready for chaining.
 *
 * @example
 * ```ts
 * route('/health')
 *     .get()
 *     .handler(() => new Response('OK'));
 * ```
 */
export function route(path: string): Route {
    return new Route(path);
}

/**
 * Pre-configured route factory object with static methods for each HTTP method.
 *
 * Each method returns a `Route` instance with the corresponding HTTP method
 * already set, so you can skip calling `.get()`, `.post()`, etc.
 *
 * @example
 * ```ts
 * Router.get('/users')
 *     .queryParam('limit')
 *     .handler(({ query }) => c.json({ limit: query.limit }));
 *
 * Router.post('/users')
 *     .body<UserCreateBody>()
 *     .handler(({ body }) => c.json({ created: body.name }));
 * ```
 */
export const Router = {
    /**
     * Creates a GET route for the given path.
     *
     * @template V - Hono context variables type.
     * @param path - The URL path pattern.
     * @returns A `Route` instance with method set to `'GET'`.
     */
    get: <V extends ContextVariables = ContextVariables>(
        path: string,
    ): Route<
        Record<string, string>,
        Record<string, unknown>,
        Record<string, unknown>,
        Record<string, string>,
        V
    > => new Route<
        Record<string, string>,
        Record<string, unknown>,
        Record<string, unknown>,
        Record<string, string>,
        V
    >(path).get(),

    /**
     * Creates a POST route for the given path.
     *
     * @template V - Hono context variables type.
     * @param path - The URL path pattern.
     * @returns A `Route` instance with method set to `'POST'`.
     */
    post: <V extends ContextVariables = ContextVariables>(
        path: string,
    ): Route<
        Record<string, string>,
        Record<string, unknown>,
        Record<string, unknown>,
        Record<string, string>,
        V
    > => new Route<
        Record<string, string>,
        Record<string, unknown>,
        Record<string, unknown>,
        Record<string, string>,
        V
    >(path).post(),

    /**
     * Creates a PUT route for the given path.
     *
     * @template V - Hono context variables type.
     * @param path - The URL path pattern.
     * @returns A `Route` instance with method set to `'PUT'`.
     */
    put: <V extends ContextVariables = ContextVariables>(
        path: string,
    ): Route<
        Record<string, string>,
        Record<string, unknown>,
        Record<string, unknown>,
        Record<string, string>,
        V
    > => new Route<
        Record<string, string>,
        Record<string, unknown>,
        Record<string, unknown>,
        Record<string, string>,
        V
    >(path).put(),

    /**
     * Creates a PATCH route for the given path.
     *
     * @template V - Hono context variables type.
     * @param path - The URL path pattern.
     * @returns A `Route` instance with method set to `'PATCH'`.
     */
    patch: <V extends ContextVariables = ContextVariables>(
        path: string,
    ): Route<
        Record<string, string>,
        Record<string, unknown>,
        Record<string, unknown>,
        Record<string, string>,
        V
    > => new Route<
        Record<string, string>,
        Record<string, unknown>,
        Record<string, unknown>,
        Record<string, string>,
        V
    >(path).patch(),

    /**
     * Creates a DELETE route for the given path.
     *
     * @template V - Hono context variables type.
     * @param path - The URL path pattern.
     * @returns A `Route` instance with method set to `'DELETE'`.
     */
    delete: <V extends ContextVariables = ContextVariables>(
        path: string,
    ): Route<
        Record<string, string>,
        Record<string, unknown>,
        Record<string, unknown>,
        Record<string, string>,
        V
    > => new Route<
        Record<string, string>,
        Record<string, unknown>,
        Record<string, unknown>,
        Record<string, string>,
        V
    >(path).delete(),
};
