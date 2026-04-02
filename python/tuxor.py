"""
TUXOR v1.0 — Operator-Based Dual-Hash Authentication Algorithm
Reference implementation in Python

Author: Bernardo Sanchez Gutierrez <tuxor.max@gmail.com>
License: GPL-3.0
"""

import hashlib
import hmac

VALID_OPERATORS = ['+', '-', '*', '%', '^', '&', '|', '<', '>', '#']
BLOCK_SIZE = 16
BLOCK_COUNT = 4
MOD_64 = 2 ** 64


def sha256(message: str) -> str:
    return hashlib.sha256(message.encode('utf-8')).hexdigest()


def parse(input_str: str) -> dict:
    """Parse an input string: extract prefix/suffix operators and clean text."""
    chars = list(input_str)
    include = False

    # Detect inclusion modifier @ at start or end
    if chars and chars[0] == '@':
        include = True
        chars = chars[1:]
    elif chars and chars[-1] == '@':
        include = True
        chars = chars[:-1]

    start = 0
    end = len(chars) - 1
    prefix = []
    suffix = []

    while start <= end and chars[start] in VALID_OPERATORS:
        prefix.append(chars[start])
        start += 1

    while end >= start and chars[end] in VALID_OPERATORS:
        suffix.append(chars[end])
        end -= 1

    suffix.reverse()

    # With @: operators stay in clean text (full string without @)
    # Without @: operators are removed from clean text
    if include:
        clean = ''.join(chars)
    else:
        clean = ''.join(chars[start:end + 1])

    return {
        'prefix': prefix,
        'suffix': suffix,
        'operators': prefix + suffix,
        'clean': clean,
        'include': include,
    }


def _hex_to_int(hex_str: str) -> int:
    return int(hex_str, 16)


def _int_to_hex(num: int, pad_length: int) -> str:
    hex_str = format(num % MOD_64, 'x')
    return hex_str.zfill(pad_length)[-pad_length:]


def _rotate_left_64(value: int, shift: int) -> int:
    shift = shift % 64
    if shift == 0:
        return value
    value = value % MOD_64
    return ((value << shift) | (value >> (64 - shift))) % MOD_64


def _rotate_right_64(value: int, shift: int) -> int:
    shift = shift % 64
    if shift == 0:
        return value
    return _rotate_left_64(value, 64 - shift)


def _apply_op(op: str, I: int, S: int, hex_I: str, hex_S: str) -> int:
    if op == '+':
        return (I + S) % MOD_64
    elif op == '-':
        return (I - S + MOD_64) % MOD_64
    elif op == '*':
        return (I * S) % MOD_64
    elif op == '%':
        return I % S if S != 0 else I % 1
    elif op == '^':
        return I ^ S
    elif op == '&':
        return I & S
    elif op == '|':
        return I | S
    elif op == '<':
        return _rotate_left_64(I, S % 64)
    elif op == '>':
        return _rotate_right_64(I, S % 64)
    elif op == '#':
        rehash = sha256(hex_I + hex_S)
        return _hex_to_int(rehash[:BLOCK_SIZE])
    else:
        raise ValueError(f"Invalid operator: {op}")


def compute(identity: str, secret: str) -> str:
    """Compute the tuxor from identity and secret."""
    id_parsed = parse(identity)
    sec_parsed = parse(secret)

    if not id_parsed['operators'] and not sec_parsed['operators']:
        raise ValueError('At least one input must contain operators')

    if id_parsed['clean'] == '' or sec_parsed['clean'] == '':
        raise ValueError('Clean text must be at least 1 character')

    operators = (
        id_parsed['prefix'] +
        id_parsed['suffix'] +
        sec_parsed['prefix'] +
        sec_parsed['suffix']
    )

    if not operators:
        raise ValueError('No operators found in inputs')

    hash_i = sha256(id_parsed['clean'])
    hash_s = sha256(sec_parsed['clean'])

    blocks_i = [hash_i[i * BLOCK_SIZE:(i + 1) * BLOCK_SIZE] for i in range(BLOCK_COUNT)]
    blocks_s = [hash_s[i * BLOCK_SIZE:(i + 1) * BLOCK_SIZE] for i in range(BLOCK_COUNT)]

    results = []
    op_count = len(operators)
    for n in range(BLOCK_COUNT):
        op = operators[n % op_count]
        I = _hex_to_int(blocks_i[n])
        S = _hex_to_int(blocks_s[n])
        R = _apply_op(op, I, S, blocks_i[n], blocks_s[n])
        results.append(_int_to_hex(R, BLOCK_SIZE))

    return sha256(''.join(results))


def verify(identity: str, secret: str, stored_tuxor: str) -> bool:
    """Verify a tuxor against stored value (timing-safe comparison)."""
    computed = compute(identity, secret)
    return hmac.compare_digest(computed, stored_tuxor)


def validate(input_str: str) -> bool:
    """Validate that an input string contains at least one operator."""
    parsed = parse(input_str)
    return len(parsed['operators']) > 0 and parsed['clean'] != ''


if __name__ == '__main__':
    # Test vector from spec
    identity = '+tuxor'
    secret = '*algorithm#'

    print(f'Identity: {identity}')
    print(f'Secret:   {secret}')
    print()

    id_parsed = parse(identity)
    sec_parsed = parse(secret)
    print(f'Identity parsed: {id_parsed}')
    print(f'Secret parsed:   {sec_parsed}')
    print()

    operators = id_parsed['prefix'] + id_parsed['suffix'] + sec_parsed['prefix'] + sec_parsed['suffix']
    print(f'Operators: {operators}')
    print()

    print(f'SHA-256("{id_parsed["clean"]}") = {sha256(id_parsed["clean"])}')
    print(f'SHA-256("{sec_parsed["clean"]}") = {sha256(sec_parsed["clean"])}')
    print()

    result = compute(identity, secret)
    print(f'Tuxor: {result}')
    print()

    print(f'Verify (correct):  {verify(identity, secret, result)}')
    print(f'Verify (wrong):    {verify(identity, "*wrong#", result)}')
