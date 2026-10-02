import { assertEquals } from 'jsr:@std/assert@^1';
import { normalizeCorsOptions } from '../src/server/cors.util.ts';

Deno.test('normalizeCorsOptions returns undefined for boolean config', () => {
    assertEquals(normalizeCorsOptions(true), undefined);
});

Deno.test('normalizeCorsOptions maps ["*"] and [""] to wildcard string', () => {
    assertEquals(normalizeCorsOptions({ origin: ['*'] }), { origin: '*' });
    assertEquals(normalizeCorsOptions({ origin: [''] }), { origin: '*' });
    assertEquals(normalizeCorsOptions({ origin: [] }), { origin: '*' });
});

Deno.test('normalizeCorsOptions trims and filters an origin list', () => {
    assertEquals(
        normalizeCorsOptions({
            origin: [
                'https://app.kaijuplatform.com',
                ' https://fiscal.kaijuplatform.com ',
                '',
            ],
        }),
        {
            origin: [
                'https://app.kaijuplatform.com',
                'https://fiscal.kaijuplatform.com',
            ],
        },
    );
});

Deno.test('normalizeCorsOptions keeps a string origin', () => {
    assertEquals(
        normalizeCorsOptions({ origin: 'https://app.kaijuplatform.com' }),
        { origin: 'https://app.kaijuplatform.com' },
    );
});

Deno.test('normalizeCorsOptions preserves other cors options', () => {
    assertEquals(
        normalizeCorsOptions({
            origin: ['https://app.kaijuplatform.com'],
            allowHeaders: ['Authorization'],
            credentials: true,
        }),
        {
            origin: ['https://app.kaijuplatform.com'],
            allowHeaders: ['Authorization'],
            credentials: true,
        },
    );
});
