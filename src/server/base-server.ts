import { cors, Hono, logger } from '../../deps.ts';
import type { Route } from './index.ts';
import type { ContextVariables, ServerConfig } from './types.ts';
import { requestTimeout } from './middleware.ts';

/**
 * High-level HTTP server builder that wraps a Hono application.
 *
 * `ServerBuilder` provides a simplified API for configuring and starting
 * an HTTP server. It handles CORS, logging, route registration, route grouping,
 * and the final `Deno.serve()` call.
 *
 * @template V - The type of context variables available via `c.get()`/`c.set()`.
 *
 * @example
 * ```ts
 * const server = createServer({ port: 8080 });
 * server.addRoute(Router.get('/hello').handler(() => new Response('ok')));
 * server.start();
 * ```
 */
export class ServerBuilder<V extends ContextVariables = ContextVariables> {
    private app: Hono<{ Variables: V }>;
    private config: ServerConfig;
    private routes: Route<
        Record<string, unknown>,
        Record<string, unknown>,
        Record<string, unknown>,
        Record<string, unknown>,
        V
    >[] = [];

    /**
     * Constructs a new `ServerBuilder` instance.
     *
     * @param config - Partial server configuration. Unspecified fields receive defaults:
     *   - `port`: `3000`
     *   - `hostname`: `'0.0.0.0'`
     *   - `cors`: `false`
     *   - `logger`: `true`
     *   - `requestTimeout`: not set (no timeout)
     */
    constructor(config: Partial<ServerConfig> = {}) {
        this.app = new Hono<{ Variables: V }>();
        this.config = {
            port: config.port || 3000,
            hostname: config.hostname || '0.0.0.0',
            cors: config.cors || false,
            logger: config.logger ?? true,
            ...config,
        };

        this.setupMiddleware();
    }

    /**
     * Conditionally applies global CORS and logger middleware based on config.
     */
    private setupMiddleware() {
        if (this.config.logger) {
            this.app.use(logger());
        }

        if (this.config.cors) {
            this.app.use(cors());
        }

        if (this.config.requestTimeout) {
            this.app.use(requestTimeout(this.config.requestTimeout));
        }
    }

    /**
     * Registers a single route on the server and stores it in the routes array.
     *
     * @param route - A `Route` instance (created via `Router.get()`, `route()`, etc.).
     * @returns The `ServerBuilder` instance for method chaining.
     *
     * @example
     * ```ts
     * server.addRoute(
     *     Router.get('/ping').handler(() => new Response('pong'))
     * );
     * ```
     */
    public addRoute(
        route: Route<
            Record<string, unknown>,
            Record<string, unknown>,
            Record<string, unknown>,
            Record<string, unknown>,
            V
        >,
    ): this {
        this.routes.push(route);
        route.register(this.app);
        return this;
    }

    /**
     * Creates a sub-router mounted at the given path prefix.
     *
     * All routes registered on the sub-app are prefixed with `path`.
     *
     * @param path - The URL prefix for the group (e.g. `'/v1/api'`).
     * @param routeBuilder - A callback that receives a fresh Hono sub-app for route registration.
     * @returns The `ServerBuilder` instance for method chaining.
     *
     * @example
     * ```ts
     * server.group('/v1/users', (app) => {
     *     Router.get('/list').handler(() => c.json({ users: [] })).register(app);
     * });
     * ```
     */
    public group(
        path: string,
        routeBuilder: (app: Hono<{ Variables: V }>) => void,
    ): this {
        const subApp = new Hono<{ Variables: V }>();
        routeBuilder(subApp);
        this.app.route(path, subApp);
        return this;
    }

    /**
     * Registers a global middleware function that runs on every request.
     *
     * @param middlewareFn - A Hono-compatible middleware function.
     * @returns The `ServerBuilder` instance for method chaining.
     *
     * @example
     * ```ts
     * server.middleware(errorHandler());
     * server.middleware(requestTimeout(10000));
     * ```
     */
    public middleware(middlewareFn: Parameters<typeof this.app.use>[0]): this {
        this.app.use(middlewareFn);
        return this;
    }

    /**
     * Returns the raw Hono application instance for advanced usage.
     * This allows direct access to the underlying Hono API if needed.
     *
     * @returns The underlying `Hono` app instance.
     */
    public getApp(): Hono<{ Variables: V }> {
        return this.app;
    }

    /**
     * Starts the HTTP server using `Deno.serve()`.
     *
     * This is a blocking call. Once started, the server listens on the
     * configured `hostname:port` and handles requests indefinitely.
     *
     * @example
     * ```ts
     * const server = createServer({ port: 3000 });
     * // ... register routes ...
     * server.start(); // blocks here
     * ```
     */
    public start() {
        console.log(
            `Server starting on http://${this.config.hostname}:${this.config.port}`,
        );

        Deno.serve({
            handler: this.app.fetch,
            port: this.config.port,
            hostname: this.config.hostname,
        });
    }
}

/**
 * Factory function that creates a new `ServerBuilder` instance.
 *
 * This is the recommended entry point for creating a server.
 *
 * @template V - The type of context variables to use globally.
 * @param config - Partial server configuration. See `ServerConfig` for all options.
 * @returns A new `ServerBuilder<V>` instance ready for route registration.
 *
 * @example
 * ```ts
 * interface MyVars extends ContextVariables {
 *     userId: string;
 * }
 *
 * const server = createServer<MyVars>({ port: 8080 });
 * server.start();
 * ```
 */
export function createServer<V extends ContextVariables = ContextVariables>(
    config?: Partial<ServerConfig>,
): ServerBuilder<V> {
    return new ServerBuilder<V>(config);
}
