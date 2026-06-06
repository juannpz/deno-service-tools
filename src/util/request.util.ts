import type { ContentfulStatusCode } from '../../deps.ts';
import { type Result, ResUtil } from './result.util.ts';

/**
 * Successful API response wrapper.
 *
 * @template T The type of the response data.
 */
export type SuccessApiResponse<T> = {
    /** Indicates the API call was successful. Always `true`. */
    success: true;
    /** The response data payload. */
    data: T;
    /** Optional extra metadata or context. */
    extra?: unknown;
};

/**
 * Failed API response wrapper.
 */
export type FailureApiResponse = {
    /** Indicates the API call failed. Always `false`. */
    success: false;
    /** Human-readable error message. */
    message: string;
    /** Detailed error information (e.g., stack trace, validation errors). */
    detail?: string;
    /** HTTP status code for the error. */
    code: ContentfulStatusCode;
    /** Optional extra metadata or context. */
    extra?: unknown;
};

/**
 * Discriminated union representing either a successful or failed API response.
 *
 * @template T The type of the response data when successful.
 */
export type ApiResponse<T> = SuccessApiResponse<T> | FailureApiResponse;

/**
 * Represents an HTTP error with the response status and parsed details.
 *
 * This class wraps a non-2xx HTTP response so the error can be propagated
 * through the `Result` layer without losing status code or body information.
 */
export class HttpFetchError extends Error {
    /**
     * Creates a new `HttpFetchError`.
     *
     * @param status - The HTTP status code (e.g. 404, 500).
     * @param statusText - The HTTP status text (e.g. `'Not Found'`).
     * @param details - The parsed response body or error details.
     */
    constructor(
        public status: number,
        public statusText: string,
        public details: unknown,
    ) {
        super(`HTTP Error ${status}: ${statusText}`);
        this.name = 'HttpFetchError';
    }
}

/**
 * Wraps a `fetch` promise in a try/catch and returns a `Result<T>`.
 *
 * This function handles network errors, non-2xx HTTP responses (by parsing the
 * error body when possible), and JSON parsing errors — all returned as `ErrResult`.
 * Successful responses with valid JSON are returned as `OkResult<T>`.
 *
 * @template T The expected JSON response type.
 * @param fetchPromise - A promise resolving to a `Response` (e.g. from `fetch()`).
 * @returns A `Promise<Result<T>>` containing either the parsed data or an error description.
 *
 * @example
 * ```ts
 * const result = await safeFetch<User>(
 *     fetch('https://api.example.com/users/1'),
 * );
 * if (result.ok) {
 *     console.log(result.value.name);
 * } else {
 *     console.error(result.message);
 * }
 * ```
 */
export async function safeFetch<T>(
    fetchPromise: Promise<Response>,
): Promise<Result<T>> {
    try {
        const response = await fetchPromise;

        if (!response.ok) {
            let errorMessage = `Request failed with status ${response.status}`;
            let errorDetails: unknown = response;

            try {
                const clonedResponse = response.clone();
                const errorBody = await clonedResponse.json() as Record<
                    string,
                    unknown
                >;

                if (errorBody && typeof errorBody === 'object') {
                    if (typeof errorBody.error === 'string') {
                        errorMessage = errorBody.error;
                    } else if (typeof errorBody.message === 'string') {
                        errorMessage = errorBody.message;
                    }

                    if (errorBody.detail !== undefined) {
                        errorDetails = errorBody.detail;
                    } else if (
                        errorBody.error !== undefined &&
                        typeof errorBody.error !== 'string'
                    ) {
                        errorDetails = errorBody.error;
                    } else {
                        errorDetails = errorBody;
                    }
                }
            } catch (_) {
                // Body could not be parsed as JSON; keep errorDetails as the Response.
            }

            return ResUtil.Fail(
                errorMessage,
                new HttpFetchError(
                    response.status,
                    response.statusText,
                    errorDetails,
                ),
            );
        }

        try {
            const data = await response.json() as T;
            return ResUtil.Succeed(data);
        } catch (parsingError) {
            return ResUtil.Fail(
                'Failed to parse JSON response',
                parsingError,
            );
        }
    } catch (networkError) {
        return ResUtil.Fail(
            'A network or unexpected error occurred',
            networkError,
        );
    }
}

/**
 * Overload for buildRequestResponse: failed result case.
 * Returns a `FailureApiResponse`.
 *
 * @param result - An `ErrResult`-shaped object.
 * @param extra - Optional extra metadata.
 * @returns A `FailureApiResponse` object.
 */
export function buildRequestResponse(
    result: { ok: false; message: string; error?: unknown },
    extra?: unknown,
): FailureApiResponse;

/**
 * Overload for buildRequestResponse: successful result case.
 * Returns a `SuccessApiResponse<T>`.
 *
 * @template T The data type.
 * @param result - An `OkResult<T>`-shaped object.
 * @param extra - Optional extra metadata.
 * @returns A `SuccessApiResponse<T>` object.
 */
export function buildRequestResponse<T>(
    result: { ok: true; value: T },
    extra?: unknown,
): SuccessApiResponse<T>;

/**
 * Overload for buildRequestResponse: generic `Result<T>` case.
 * Returns the appropriate `ApiResponse<T>` based on `result.ok`.
 *
 * @template T The data type.
 * @param result - A `Result<T>` object.
 * @param extra - Optional extra metadata.
 * @returns An `ApiResponse<T>` object (success or failure).
 */
export function buildRequestResponse<T>(
    result: Result<T>,
    extra?: unknown,
): ApiResponse<T>;

/**
 * Converts a `Result<T>` into an `ApiResponse<T>` suitable for HTTP responses.
 *
 * This function introspects the error inside `ErrResult` and extracts
 * meaningful status codes and detail messages:
 *
 * - `HttpFetchError` → uses the original HTTP status and detail
 * - `Response` → uses `response.status` and `response.statusText`
 * - `Error` → maps to status 500 with the error message
 * - String or object → maps to status 500 with stringified detail
 * - Unknown → maps to status 500 with no detail
 *
 * @template T The data type for successful responses.
 * @param result - The `Result<T>` to convert.
 * @param extra - Optional extra metadata to include in the response.
 * @returns An `ApiResponse<T>` with `success: true` and data, or `success: false` with error info.
 *
 * @example
 * ```ts
 * const fetchResult = await safeFetch<User>(fetch('/users/1'));
 * const apiResponse = buildRequestResponse(fetchResult, { requestId: 'abc' });
 * return Response.json(apiResponse, { status: apiResponse.success ? 200 : apiResponse.code });
 * ```
 */
export function buildRequestResponse<T>(
    result: Result<T>,
    extra?: unknown,
): ApiResponse<T> {
    if (result.ok) {
        return {
            success: true,
            data: result.value,
            extra,
        };
    }

    const { message, error } = result;

    if (error instanceof HttpFetchError) {
        return {
            success: false,
            message,
            detail: typeof error.details === 'string'
                ? error.details
                : (error.details instanceof Response
                    ? error.details.statusText
                    : JSON.stringify(error.details)),
            code: error.status as ContentfulStatusCode,
            extra,
        };
    }

    if (error instanceof Response) {
        return {
            success: false,
            message,
            detail: error.statusText,
            code: error.status as ContentfulStatusCode,
            extra,
        };
    }

    if (error instanceof Error) {
        return {
            success: false,
            message,
            detail: error.message,
            code: 500,
            extra,
        };
    }

    if (error) {
        return {
            success: false,
            message,
            detail: typeof error === 'string' ? error : JSON.stringify(error),
            code: 500,
            extra,
        };
    }

    return {
        success: false,
        message,
        code: 500,
        extra,
    };
}

/**
 * Builds a URL by dynamically injecting query parameters.
 *
 * Automatically filters out `undefined` and `null` values, but preserves
 * booleans (`false`) and numeric values (`0`).
 *
 * @param baseUrl - The base URL (e.g. `'http://api.local/v1/crud/product'`).
 * @param params - An object containing the query parameter key-value pairs.
 *   Values of `undefined` or `null` are omitted from the URL.
 * @returns A `URL` instance ready to be used with `.toString()` or passed to `fetch()`.
 *
 * @example
 * ```ts
 * const url = buildTargetUrl('http://api.local/v1/products', {
 *     is_active: false,
 *     name: 'Coca',
 *     category: null,
 * });
 * url.toString(); // "http://api.local/v1/products?is_active=false&name=Coca"
 * ```
 */
export function buildTargetUrl(
    baseUrl: string,
    params: Record<string, unknown> = {},
): URL {
    const url = new URL(baseUrl);

    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
            url.searchParams.append(key, String(value));
        }
    }

    return url;
}
