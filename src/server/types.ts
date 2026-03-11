import type { ContentfulStatusCode, Context, InvalidJSONValue, JSONParsed, JSONValue, SimplifyDeepArray, TypedResponse } from "../../deps.ts";

export type MiddlewareFunction = (c: Context, next: () => Promise<void | Response>) => Promise<void | Response>;

export type JSONRespondReturn<T extends JSONValue | SimplifyDeepArray<unknown> | InvalidJSONValue, U extends ContentfulStatusCode> = Response & TypedResponse<SimplifyDeepArray<T> extends JSONValue ? JSONValue extends SimplifyDeepArray<T> ? never : JSONParsed<T> : never, U, "json">;

export type MiddlewareFunctionResponse = (c: Context, next: () => Promise<void>) => Promise<JSONRespondReturn<{
    success: false;
    message: string;
}, 400 | 408 | 500> | undefined>

export type { Context };

export interface ServerConfig {
    port: number;
    hostname: string;
    cors: boolean | object;
    logger: boolean;
    middleware?: Array<(c: Context, next: () => Promise<void>) => Promise<void>>;
    https?: {
        cert: string;
        key: string;
    };
    requestTimeout?: number;
    maxBodySize?: number;
    errorHandler?: (err: Error, c: Context) => Response | Promise<Response>;
    [key: string]: unknown;
}

export interface RouteParams {
    path: string;
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD";
    handler: (c: Context) => Response | Promise<Response>;
}

export interface ParamConfig<T = unknown> {
    name: string;
    type: "path" | "query" | "body" | "header" | "cookie";
    required?: boolean;
    validator?: (value: unknown) => boolean;
    transform?: (value: unknown) => T;
    defaultValue?: T;
}

export interface RouteBuilder <
    PathParams = Record<string, string>,
    QueryParams = Record<string, unknown>,
    BodyType = unknown,
    HeaderParams = Record < string, string>,
    Variables extends object = ContextVariables
> {
        path: string;
        method: string;
        pathParams: ParamConfig[];
        queryParams: ParamConfig[];
        bodySchema?: unknown;
        headerParams: ParamConfig[];
        handler: (context: {
            c: Context <{ Variables: Variables }>;
            params: PathParams;
            query: QueryParams;
            body: BodyType;
            headers: HeaderParams;
        }) => Response | Promise<Response>;
    }

export type ContextVariables = Record<string, unknown>;

export type ValidationResult = {
    valid: boolean;
    message?: string;
};