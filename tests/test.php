<?php

/**
 * TUXOR v1.0 — Tests (PHP)
 */

require_once __DIR__ . '/../php/Tuxor.php';

$passed = 0;
$failed = 0;

function test(string $name, callable $fn): void
{
    global $passed, $failed;
    try {
        $fn();
        echo "  PASS  {$name}\n";
        $passed++;
    } catch (Throwable $e) {
        echo "  FAIL  {$name}\n";
        echo "        {$e->getMessage()}\n";
        $failed++;
    }
}

function assert_eq($expected, $actual, string $msg = ''): void
{
    if ($expected !== $actual) {
        throw new Exception("Expected " . var_export($expected, true) . " but got " . var_export($actual, true) . ($msg ? " — {$msg}" : ''));
    }
}

echo "TUXOR v1.0 — PHP Tests\n";
echo str_repeat('=', 50) . "\n\n";

// --- Parse tests ---
echo "Parse\n";

test('prefix only', function () {
    $r = Tuxor::parse('+juan');
    assert_eq(['+'], $r['prefix']);
    assert_eq([], $r['suffix']);
    assert_eq('juan', $r['clean']);
});

test('suffix only', function () {
    $r = Tuxor::parse('juan*');
    assert_eq([], $r['prefix']);
    assert_eq(['*'], $r['suffix']);
    assert_eq('juan', $r['clean']);
});

test('prefix and suffix', function () {
    $r = Tuxor::parse('+juan*');
    assert_eq(['+'], $r['prefix']);
    assert_eq(['*'], $r['suffix']);
    assert_eq('juan', $r['clean']);
});

test('multiple operators', function () {
    $r = Tuxor::parse('+-juan*>');
    assert_eq(['+', '-'], $r['prefix']);
    assert_eq(['*', '>'], $r['suffix']);
    assert_eq('juan', $r['clean']);
});

test('all 10 operators recognized', function () {
    foreach (['+', '-', '*', '%', '^', '&', '|', '<', '>', '#'] as $op) {
        $r = Tuxor::parse($op . 'test');
        assert_eq([$op], $r['prefix'], "Operator {$op} not recognized");
    }
});

test('no operators', function () {
    $r = Tuxor::parse('juan');
    assert_eq([], $r['prefix']);
    assert_eq([], $r['suffix']);
    assert_eq('juan', $r['clean']);
});

test('operator in middle stays in clean', function () {
    $r = Tuxor::parse('ju+an');
    assert_eq([], $r['prefix']);
    assert_eq([], $r['suffix']);
    assert_eq('ju+an', $r['clean']);
});

echo "\n";

// --- Validate tests ---
echo "Validate\n";

test('valid with prefix', function () {
    assert_eq(true, Tuxor::validate('+test'));
});

test('valid with suffix', function () {
    assert_eq(true, Tuxor::validate('test^'));
});

test('invalid — no operators', function () {
    assert_eq(false, Tuxor::validate('test'));
});

test('invalid — only operators', function () {
    assert_eq(false, Tuxor::validate('+-'));
});

echo "\n";

// --- Compute tests ---
echo "Compute\n";

test('deterministic — same input produces same output', function () {
    $t1 = Tuxor::compute('+tuxor', '*algorithm#');
    $t2 = Tuxor::compute('+tuxor', '*algorithm#');
    assert_eq($t1, $t2);
});

test('output is 64-char hex', function () {
    $t = Tuxor::compute('+tuxor', '*algorithm#');
    assert_eq(64, strlen($t));
    assert_eq(1, preg_match('/^[0-9a-f]{64}$/', $t));
});

test('different operators produce different tuxor', function () {
    $t1 = Tuxor::compute('+user', '+pass');
    $t2 = Tuxor::compute('-user', '+pass');
    if ($t1 === $t2) throw new Exception('Different operators produced same tuxor');
});

test('different identity produces different tuxor', function () {
    $t1 = Tuxor::compute('+alice', '*secret#');
    $t2 = Tuxor::compute('+bob', '*secret#');
    if ($t1 === $t2) throw new Exception('Different identities produced same tuxor');
});

test('different secret produces different tuxor', function () {
    $t1 = Tuxor::compute('+user', '*pass1#');
    $t2 = Tuxor::compute('+user', '*pass2#');
    if ($t1 === $t2) throw new Exception('Different secrets produced same tuxor');
});

test('operator position matters', function () {
    $t1 = Tuxor::compute('+user', '*pass');
    $t2 = Tuxor::compute('*user', '+pass');
    if ($t1 === $t2) throw new Exception('Swapped operators produced same tuxor');
});

test('throws on no operators', function () {
    try {
        Tuxor::compute('user', 'pass');
        throw new Exception('Should have thrown');
    } catch (InvalidArgumentException $e) {
        // expected
    }
});

test('throws on empty clean text', function () {
    try {
        Tuxor::compute('+-', '*#');
        throw new Exception('Should have thrown');
    } catch (InvalidArgumentException $e) {
        // expected
    }
});

test('all operators work without error', function () {
    foreach (['+', '-', '*', '%', '^', '&', '|', '<', '>', '#'] as $op) {
        $t = Tuxor::compute($op . 'user', $op . 'pass');
        assert_eq(64, strlen($t), "Operator {$op} failed");
    }
});

echo "\n";

// --- Verify tests ---
echo "Verify\n";

test('verify correct credentials', function () {
    $t = Tuxor::compute('+tuxor', '*algorithm#');
    assert_eq(true, Tuxor::verify('+tuxor', '*algorithm#', $t));
});

test('verify wrong credentials', function () {
    $t = Tuxor::compute('+tuxor', '*algorithm#');
    assert_eq(false, Tuxor::verify('+tuxor', '*wrong#', $t));
});

test('verify wrong operator', function () {
    $t = Tuxor::compute('+tuxor', '*algorithm#');
    assert_eq(false, Tuxor::verify('-tuxor', '*algorithm#', $t));
});

echo "\n";

// --- Cross-language test vector ---
echo "Test Vector\n";

test('spec test vector — deterministic output', function () {
    $t = Tuxor::compute('+tuxor', '*algorithm#');
    echo "        Tuxor('+tuxor', '*algorithm#') = {$t}\n";
    // This value should match across all implementations
    assert_eq(64, strlen($t));
});

echo "\n" . str_repeat('=', 50) . "\n";
echo "Results: {$passed} passed, {$failed} failed\n";

exit($failed > 0 ? 1 : 0);
