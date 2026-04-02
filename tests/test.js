/**
 * TUXOR v1.0 — Tests (JavaScript / Node.js)
 */

const { compute, verify, validate, parse } = require('../javascript/tuxor.cjs.js');

let passed = 0;
let failed = 0;

async function test(name, fn) {
    try {
        await fn();
        console.log(`  PASS  ${name}`);
        passed++;
    } catch (e) {
        console.log(`  FAIL  ${name}`);
        console.log(`        ${e.message}`);
        failed++;
    }
}

function assertEq(expected, actual, msg = '') {
    if (expected !== actual) {
        throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}${msg ? ` — ${msg}` : ''}`);
    }
}

(async () => {
    console.log('TUXOR v1.0 — JavaScript Tests');
    console.log('='.repeat(50));

    // Parse
    console.log('\nParse');

    await test('prefix only', async () => {
        const r = parse('+juan');
        assertEq('+', r.prefix[0]);
        assertEq(0, r.suffix.length);
        assertEq('juan', r.clean);
    });

    await test('suffix only', async () => {
        const r = parse('juan*');
        assertEq(0, r.prefix.length);
        assertEq('*', r.suffix[0]);
        assertEq('juan', r.clean);
    });

    await test('prefix and suffix', async () => {
        const r = parse('+juan*');
        assertEq('+', r.prefix[0]);
        assertEq('*', r.suffix[0]);
        assertEq('juan', r.clean);
    });

    await test('multiple operators', async () => {
        const r = parse('+-juan*>');
        assertEq(2, r.prefix.length);
        assertEq(2, r.suffix.length);
        assertEq('juan', r.clean);
    });

    await test('all 10 operators recognized', async () => {
        for (const op of ['+', '-', '*', '%', '^', '&', '|', '<', '>', '#']) {
            const r = parse(op + 'test');
            assertEq(op, r.prefix[0], `Operator ${op}`);
        }
    });

    await test('@ at start — include prefix only', async () => {
        const r = parse('@+miusuario*');
        assertEq('+', r.prefix[0]);
        assertEq('*', r.suffix[0]);
        assertEq('+miusuario', r.clean);
        assertEq('prefix', r.include);
    });

    await test('@ at end — include suffix only', async () => {
        const r = parse('+miusuario*@');
        assertEq('+', r.prefix[0]);
        assertEq('*', r.suffix[0]);
        assertEq('miusuario*', r.clean);
        assertEq('suffix', r.include);
    });

    await test('@@ at start — include all', async () => {
        assertEq('+miusuario*', parse('@@+miusuario*').clean);
        assertEq('all', parse('@@+miusuario*').include);
    });

    await test('@@ at end — include all', async () => {
        assertEq('+miusuario*', parse('+miusuario*@@').clean);
        assertEq('all', parse('+miusuario*@@').include);
    });

    await test('without @ — ops excluded', async () => {
        assertEq('miusuario', parse('+miusuario*').clean);
        assertEq('none', parse('+miusuario*').include);
    });

    await test('4 variants produce 4 different tuxors', async () => {
        const tNone   = await compute('+user*', '+pass');
        const tPrefix = await compute('@+user*', '+pass');
        const tSuffix = await compute('+user*@', '+pass');
        const tAll    = await compute('@@+user*', '+pass');
        const unique = new Set([tNone, tPrefix, tSuffix, tAll]);
        if (unique.size !== 4) throw new Error('4 variants must produce 4 different tuxors');
    });

    await test('@@ at start same as @@ at end', async () => {
        const t1 = await compute('@@+user*', '+pass');
        const t2 = await compute('+user*@@', '+pass');
        assertEq(t1, t2);
    });

    await test('no operators', async () => {
        const r = parse('juan');
        assertEq(0, r.operators.length);
        assertEq('juan', r.clean);
    });

    await test('operator in middle stays', async () => {
        const r = parse('ju+an');
        assertEq('ju+an', r.clean);
    });

    // Validate
    console.log('\nValidate');

    await test('valid with prefix', async () => assertEq(true, validate('+test')));
    await test('valid with suffix', async () => assertEq(true, validate('test^')));
    await test('invalid no operators', async () => assertEq(false, validate('test')));
    await test('invalid only operators', async () => assertEq(false, validate('+-')));

    // Compute
    console.log('\nCompute');

    await test('deterministic', async () => {
        const t1 = await compute('+tuxor', '*algorithm#');
        const t2 = await compute('+tuxor', '*algorithm#');
        assertEq(t1, t2);
    });

    await test('output is 64-char hex', async () => {
        const t = await compute('+tuxor', '*algorithm#');
        assertEq(64, t.length);
        assertEq(true, /^[0-9a-f]{64}$/.test(t));
    });

    await test('different operators → different tuxor', async () => {
        const t1 = await compute('+user', '+pass');
        const t2 = await compute('-user', '+pass');
        if (t1 === t2) throw new Error('Same tuxor');
    });

    await test('different identity → different tuxor', async () => {
        const t1 = await compute('+alice', '*secret#');
        const t2 = await compute('+bob', '*secret#');
        if (t1 === t2) throw new Error('Same tuxor');
    });

    await test('different secret → different tuxor', async () => {
        const t1 = await compute('+user', '*pass1#');
        const t2 = await compute('+user', '*pass2#');
        if (t1 === t2) throw new Error('Same tuxor');
    });

    await test('operator position matters', async () => {
        const t1 = await compute('+user', '*pass');
        const t2 = await compute('*user', '+pass');
        if (t1 === t2) throw new Error('Same tuxor');
    });

    await test('throws on no operators', async () => {
        try {
            await compute('user', 'pass');
            throw new Error('Should have thrown');
        } catch (e) {
            if (e.message === 'Should have thrown') throw e;
        }
    });

    await test('throws on empty clean text', async () => {
        try {
            await compute('+-', '*#');
            throw new Error('Should have thrown');
        } catch (e) {
            if (e.message === 'Should have thrown') throw e;
        }
    });

    await test('all operators work', async () => {
        for (const op of ['+', '-', '*', '%', '^', '&', '|', '<', '>', '#']) {
            const t = await compute(op + 'user', op + 'pass');
            assertEq(64, t.length, `Operator ${op}`);
        }
    });

    // Verify
    console.log('\nVerify');

    await test('verify correct', async () => {
        const t = await compute('+tuxor', '*algorithm#');
        assertEq(true, await verify('+tuxor', '*algorithm#', t));
    });

    await test('verify wrong secret', async () => {
        const t = await compute('+tuxor', '*algorithm#');
        assertEq(false, await verify('+tuxor', '*wrong#', t));
    });

    await test('verify wrong operator', async () => {
        const t = await compute('+tuxor', '*algorithm#');
        assertEq(false, await verify('-tuxor', '*algorithm#', t));
    });

    // Test vector
    console.log('\nTest Vector');
    const tv = await compute('+tuxor', '*algorithm#');
    console.log(`  Tuxor('+tuxor', '*algorithm#') = ${tv}`);

    console.log('\n' + '='.repeat(50));
    console.log(`Results: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
})();
