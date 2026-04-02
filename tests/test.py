"""
TUXOR v1.0 — Tests (Python)
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'python'))

from tuxor import compute, verify, validate, parse, compute_secure, verify_secure

passed = 0
failed = 0


def test(name, fn):
    global passed, failed
    try:
        fn()
        print(f"  PASS  {name}")
        passed += 1
    except Exception as e:
        print(f"  FAIL  {name}")
        print(f"        {e}")
        failed += 1


def assert_eq(expected, actual, msg=""):
    if expected != actual:
        raise Exception(f"Expected {expected!r} but got {actual!r}" + (f" — {msg}" if msg else ""))


print("TUXOR v1.0 — Python Tests")
print("=" * 50)

# Parse
print("\nParse")
test("prefix only", lambda: (
    assert_eq(['+'], parse('+juan')['prefix']),
    assert_eq('juan', parse('+juan')['clean'])
))
test("suffix only", lambda: (
    assert_eq(['*'], parse('juan*')['suffix']),
    assert_eq('juan', parse('juan*')['clean'])
))
test("prefix and suffix", lambda: (
    assert_eq(['+'], parse('+juan*')['prefix']),
    assert_eq(['*'], parse('+juan*')['suffix']),
    assert_eq('juan', parse('+juan*')['clean'])
))
test("multiple operators", lambda: (
    assert_eq(['+', '-'], parse('+-juan*>')['prefix']),
    assert_eq(['*', '>'], parse('+-juan*>')['suffix'])
))
test("all 10 operators recognized", lambda: [
    assert_eq([op], parse(op + 'test')['prefix'], f"Op {op}")
    for op in ['+', '-', '*', '%', '^', '&', '|', '<', '>', '#']
])
test("@ at start — include prefix only", lambda: (
    assert_eq(['+'], parse('@+miusuario*')['prefix']),
    assert_eq(['*'], parse('@+miusuario*')['suffix']),
    assert_eq('+miusuario', parse('@+miusuario*')['clean']),
    assert_eq('prefix', parse('@+miusuario*')['include'])
))
test("@ at end — include suffix only", lambda: (
    assert_eq(['+'], parse('+miusuario*@')['prefix']),
    assert_eq(['*'], parse('+miusuario*@')['suffix']),
    assert_eq('miusuario*', parse('+miusuario*@')['clean']),
    assert_eq('suffix', parse('+miusuario*@')['include'])
))
test("@@ at start — include all", lambda: (
    assert_eq('+miusuario*', parse('@@+miusuario*')['clean']),
    assert_eq('all', parse('@@+miusuario*')['include'])
))
test("@@ at end — include all", lambda: (
    assert_eq('+miusuario*', parse('+miusuario*@@')['clean']),
    assert_eq('all', parse('+miusuario*@@')['include'])
))
test("without @ — ops excluded", lambda: (
    assert_eq('miusuario', parse('+miusuario*')['clean']),
    assert_eq('none', parse('+miusuario*')['include'])
))


def test_4_variants():
    t_none = compute('+user*', '+pass')
    t_prefix = compute('@+user*', '+pass')
    t_suffix = compute('+user*@', '+pass')
    t_all = compute('@@+user*', '+pass')
    if len({t_none, t_prefix, t_suffix, t_all}) != 4:
        raise Exception("4 variants must produce 4 different tuxors")

test("4 variants produce 4 different tuxors", test_4_variants)
test("@@ at start same as @@ at end", lambda: assert_eq(
    compute('@@+user*', '+pass'),
    compute('+user*@@', '+pass')
))
test("no operators", lambda: assert_eq([], parse('juan')['operators']))
test("operator in middle stays", lambda: assert_eq('ju+an', parse('ju+an')['clean']))

# Validate
print("\nValidate")
test("valid with prefix", lambda: assert_eq(True, validate('+test')))
test("valid with suffix", lambda: assert_eq(True, validate('test^')))
test("invalid no operators", lambda: assert_eq(False, validate('test')))
test("invalid only operators", lambda: assert_eq(False, validate('+-')))

# Compute
print("\nCompute")
test("deterministic", lambda: assert_eq(
    compute('+tuxor', '*algorithm#'),
    compute('+tuxor', '*algorithm#')
))
test("output is 64-char hex", lambda: (
    assert_eq(64, len(compute('+tuxor', '*algorithm#'))),
    assert_eq(True, all(c in '0123456789abcdef' for c in compute('+tuxor', '*algorithm#')))
))


def test_diff_ops():
    if compute('+user', '+pass') == compute('-user', '+pass'):
        raise Exception("Same tuxor for different operators")

test("different operators produce different tuxor", test_diff_ops)


def test_diff_identity():
    if compute('+alice', '*secret#') == compute('+bob', '*secret#'):
        raise Exception("Same tuxor for different identities")

test("different identity produces different tuxor", test_diff_identity)


def test_diff_secret():
    if compute('+user', '*pass1#') == compute('+user', '*pass2#'):
        raise Exception("Same tuxor for different secrets")

test("different secret produces different tuxor", test_diff_secret)


def test_op_position():
    if compute('+user', '*pass') == compute('*user', '+pass'):
        raise Exception("Same tuxor for swapped operators")

test("operator position matters", test_op_position)


def test_throws_no_ops():
    try:
        compute('user', 'pass')
        raise Exception("Should have thrown")
    except ValueError:
        pass

test("throws on no operators", test_throws_no_ops)


def test_throws_empty():
    try:
        compute('+-', '*#')
        raise Exception("Should have thrown")
    except ValueError:
        pass

test("throws on empty clean text", test_throws_empty)


def test_all_ops():
    for op in ['+', '-', '*', '%', '^', '&', '|', '<', '>', '#']:
        t = compute(op + 'user', op + 'pass')
        assert_eq(64, len(t), f"Operator {op}")

test("all operators work", test_all_ops)

# Verify
print("\nVerify")
test("verify correct", lambda: assert_eq(True, verify('+tuxor', '*algorithm#', compute('+tuxor', '*algorithm#'))))
test("verify wrong secret", lambda: assert_eq(False, verify('+tuxor', '*wrong#', compute('+tuxor', '*algorithm#'))))
test("verify wrong operator", lambda: assert_eq(False, verify('-tuxor', '*algorithm#', compute('+tuxor', '*algorithm#'))))

# Test vector
print("\nTest Vector")
tv = compute('+tuxor', '*algorithm#')
print(f"  Tuxor('+tuxor', '*algorithm#') = {tv}")

# Secure mode
print("\nSecure Mode (scrypt)")


def test_secure_keys():
    r = compute_secure('+tuxor', '*algorithm#', cost=10)
    assert r['tuxor'], "Missing tuxor"
    assert r['salt'], "Missing salt"
    assert r['cost'] == 10, f"Expected cost 10, got {r['cost']}"
    assert_eq(32, len(r['salt']))  # 16 bytes hex

test("computeSecure returns tuxor, salt, cost", test_secure_keys)


def test_secure_diff_salt():
    r1 = compute_secure('+user', '+pass', salt='aaaa1111bbbb2222cccc3333dddd4444', cost=10)
    r2 = compute_secure('+user', '+pass', salt='1111aaaa2222bbbb3333cccc4444dddd', cost=10)
    if r1['tuxor'] == r2['tuxor']:
        raise Exception("Different salts produced same tuxor")

test("computeSecure — different salt different tuxor", test_secure_diff_salt)


def test_verify_secure_correct():
    r = compute_secure('+tuxor', '*algorithm#', cost=10)
    assert_eq(True, verify_secure('+tuxor', '*algorithm#', r['tuxor'], r['salt'], r['cost']))

test("verifySecure — correct credentials", test_verify_secure_correct)


def test_verify_secure_wrong():
    r = compute_secure('+tuxor', '*algorithm#', cost=10)
    assert_eq(False, verify_secure('+tuxor', '*wrong#', r['tuxor'], r['salt'], r['cost']))

test("verifySecure — wrong credentials", test_verify_secure_wrong)

print(f"\n{'=' * 50}")
print(f"Results: {passed} passed, {failed} failed")
sys.exit(1 if failed > 0 else 0)
