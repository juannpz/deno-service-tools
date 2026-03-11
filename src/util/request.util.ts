import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ResUtil, type Result } from "./result.util.ts";

// --- API Response Final Types Definition ---

/**
 * Represents a successful API response.
 * @template T The type of the data payload.
 */
type SuccessApiResponse<T> = {
    /** Indicates that the request was successful. */
    success: true;
    /** The data payload of the response. */
    data: T;
    /** Optional extra data that can be included in the response. */
    extra?: unknown;
};

/**
 * Represents a failed API response.
 */
type FailureApiResponse = {
    /** Indicates that the request failed. */
    success: false;
    /** A human-readable message explaining the error. */
    message: string;
    /** Optional additional details about the error. */
    detail?: string;
    /** The HTTP status code associated with the error. */
    code: ContentfulStatusCode;
    /** Optional extra data that can be included in the response. */
    extra?: unknown;
};

/**
 * Defines the standard structure for all API responses.
 * It can be either a `SuccessApiResponse` or a `FailureApiResponse`.
 * @template T The type of the data payload for a successful response.
 */
export type ApiResponse<T> = SuccessApiResponse<T> | FailureApiResponse;


// --- Function #1: Execute the request and return a `Result` ---

/**
 * Wraps a `fetch` promise to safely handle success, network errors,
 * and response errors (e.g., 404, 500). This function abstracts the
 * try-catch logic and standardizes error handling.
 *
 * @template T The expected type of the JSON response data.
 * @param fetchPromise The `fetch` promise to execute.
 * @returns A `Promise<Result<T>>` which encapsulates either the successful data or the error.
 */
export async function safeFetch<T>(fetchPromise: Promise<Response>): Promise<Result<T>> {
    try {
        const response = await fetchPromise;

        if (!response.ok) {
            let errorMessage = `Request failed with status ${response.status}`;

            try {
                const clonedResponse = response.clone();
                const errorBody = await clonedResponse.json();

                if (errorBody && typeof errorBody === 'object') {
                    if ('error' in errorBody && typeof errorBody.error === 'string') {
                        errorMessage = errorBody.error;
                    } else if ('message' in errorBody && typeof errorBody.message === 'string') {
                        errorMessage = errorBody.message;
                    }
                }
            } catch (_) {
                // ignored.
            }

            return ResUtil.Fail(errorMessage, response);
        }

        try {
            const data = await response.json() as T;
            return ResUtil.Succeed(data);
        } catch (parsingError) {
            return ResUtil.Fail("Failed to parse JSON response", parsingError);
        }

    } catch (networkError) {
        return ResUtil.Fail("A network or unexpected error occurred", networkError);
    }
}


// --- Function #2: Build the final API response from a `Result` ---

/**
 * Transforms a `Result<T>` object into the standard JSON API response format.
 * This function centralizes the logic for creating consistent success and error responses.
 *
 * @template T The type of the data in the `Result`.
 * @param result The `Result<T>` object obtained from `safeFetch` or another operation.
 * @param extra Optional additional data to include in the final response.
 * @returns An `ApiResponse<T>` object ready to be sent to the client.
 */
export function buildRequestResponse<T>(result: Result<T>, extra?: unknown): ApiResponse<T> {
    if (result.ok) {
        return {
            success: true,
            data: result.value,
            extra,
        };
    }

    const { message, error } = result;

    // Case 1: The error is a `Response` object from a failed fetch (e.g., 404).
    if (error instanceof Response) {
        return {
            success: false,
            message,
            detail: error.statusText,
            code: error.status as ContentfulStatusCode,
            extra,
        };
    }

    // Case 2: The error is a standard `Error` instance.
    if (error instanceof Error) {
        return {
            success: false,
            message,
            detail: error.message,
            code: 500, // We cannot know the HTTP code, so we assume an internal server error.
            extra,
        };
    }

    // Case 3: Unknown error.
    return {
        success: false,
        message,
        code: 500,
        extra,
    };
}
