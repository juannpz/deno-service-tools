import { assertEquals } from 'jsr:@std/assert@^1';
import {
    buildRequestResponse,
    HttpFetchError,
} from '../src/util/request.util.ts';
import { ResUtil } from '../src/util/result.util.ts';

Deno.test('success response passes data and extra through', () => {
    const response = buildRequestResponse(ResUtil.Succeed({ id: 1 }), {
        requestId: 'abc',
    });
    assertEquals(response, {
        success: true,
        data: { id: 1 },
        extra: { requestId: 'abc' },
    });
});

Deno.test('legacy failure (Error) still maps to 500 with detail', () => {
    const response = buildRequestResponse(
        ResUtil.Fail('boom', new Error('cause')),
    );
    assertEquals(response, {
        success: false,
        message: 'boom',
        detail: 'cause',
        code: 500,
        extra: undefined,
    });
    assertEquals('errorCode' in response, false);
});

Deno.test('legacy failure (no error) still maps to 500 without detail', () => {
    const response = buildRequestResponse(ResUtil.Fail('nope'));
    assertEquals(response, {
        success: false,
        message: 'nope',
        code: 500,
        extra: undefined,
    });
});

Deno.test('explicit ErrResult.code overrides inference and surfaces errorCode', () => {
    const response = buildRequestResponse(
        ResUtil.Fail('no permiso', undefined, {
            code: 403,
            errorCode: 'FORBIDDEN',
        }),
    );
    assertEquals(response, {
        success: false,
        message: 'no permiso',
        code: 403,
        errorCode: 'FORBIDDEN',
        extra: undefined,
    });
});

Deno.test('HttpFetchError status is preserved when no explicit code', () => {
    const response = buildRequestResponse(
        ResUtil.Fail(
            'not found',
            new HttpFetchError(404, 'Not Found', 'missing'),
        ),
    );
    assertEquals(response.code, 404);
    assertEquals(response.detail, 'missing');
});

Deno.test('explicit code wins over HttpFetchError status', () => {
    const response = buildRequestResponse(
        ResUtil.Fail(
            'mapped',
            new HttpFetchError(404, 'Not Found', 'missing'),
            { code: 422, errorCode: 'UPSTREAM_REJECTED' },
        ),
    );
    assertEquals(response.code, 422);
    assertEquals(response.errorCode, 'UPSTREAM_REJECTED');
    assertEquals(response.detail, 'missing');
});

Deno.test('string error maps to 500 with the string as detail', () => {
    const response = buildRequestResponse(ResUtil.Fail('bad', 'details'));
    assertEquals(response, {
        success: false,
        message: 'bad',
        detail: 'details',
        code: 500,
        extra: undefined,
    });
});
