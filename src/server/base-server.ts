import { cors, Hono, logger } from '../../deps.ts';
import type { Route } from './index.ts';
import type { ContextVariables, ServerConfig } from './types.ts';

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

    private setupMiddleware() {
        if (this.config.logger) {
            this.app.use(logger());
        }

        if (this.config.cors) {
            this.app.use(cors());
        }
    }

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

    public group(
        path: string,
        routeBuilder: (app: Hono<{ Variables: V }>) => void,
    ): this {
        const subApp = new Hono<{ Variables: V }>();
        routeBuilder(subApp);
        this.app.route(path, subApp);
        return this;
    }

    public middleware(middlewareFn: Parameters<typeof this.app.use>[0]): this {
        this.app.use(middlewareFn);
        return this;
    }

    public getApp(): Hono<{ Variables: V }> {
        return this.app;
    }

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

export function createServer<V extends ContextVariables = ContextVariables>(
    config?: Partial<ServerConfig>,
): ServerBuilder<V> {
    return new ServerBuilder<V>(config);
}
