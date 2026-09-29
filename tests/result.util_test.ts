import { assertEquals } from 'jsr:@std/assert@^1';
import { ResUtil } from '../src/util/result.util.ts';

Deno.test('ResUtil.Succeed returns an OkResult', () => {
    const result = ResUtil.Succeed({ id: 1 });
    assertEquals(result, { ok: true, value: { id: 1 } });
});

Deno.test('ResUtil.Fail keeps legacy shape (no code/errorCode keys)', () => {
    const withError = ResUtil.Fail('boom', new Error('cause'));
    assertEquals(withError.ok, false);
    assertEquals(withError.message, 'boom');
    assertEquals(withError.error instanceof Error, true);
    assertEquals('code' in withError, false);
    assertEquals('errorCode' in withError, false);
});

Deno.test('ResUtil.Fail attaches code and errorCode via options', () => {
    const result = ResUtil.Fail('no permiso', undefined, {
        code: 403,
        errorCode: 'FORBIDDEN',
    });
    assertEquals(result.ok, false);
    assertEquals(result.message, 'no permiso');
    assertEquals(result.code, 403);
    assertEquals(result.errorCode, 'FORBIDDEN');
});

Deno.test('ResUtil.FailWith is a convenience for the no-error case', () => {
    const result = ResUtil.FailWith('no permiso', {
        code: 403,
        errorCode: 'FORBIDDEN',
    });
    assertEquals(result.ok, false);
    assertEquals(result.message, 'no permiso');
    assertEquals(result.code, 403);
    assertEquals(result.errorCode, 'FORBIDDEN');
});

Deno.test('ResUtil.FailWith can still carry the original error', () => {
    const cause = new Error('root cause');
    const result = ResUtil.FailWith('unavailable', {
        code: 503,
        errorCode: 'UPSTREAM_UNAVAILABLE',
    }, cause);
    assertEquals(result.error, cause);
    assertEquals(result.code, 503);
    assertEquals(result.errorCode, 'UPSTREAM_UNAVAILABLE');
});
