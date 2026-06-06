/**
 * Standard HTTP methods supported by the route builder and route registration.
 * Aligns with RFC 7231 and common REST API conventions.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * Extended set of HTTP methods including OPTIONS and HEAD.
 * Used where a broader method set is needed (e.g., route parameter definitions).
 */
export type HttpMethodExtended = HttpMethod | 'OPTIONS' | 'HEAD';

/**
 * HTTP request method as a string literal union.
 * Generic alias covering all standard HTTP methods.
 */
// deno-lint-ignore ban-types
export type HttpMethodString = string & {};
