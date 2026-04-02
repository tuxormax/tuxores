<?php

/**
 * TUXOR v1.0 — Operator-Based Dual-Hash Authentication Algorithm
 * Reference implementation in PHP (no external extensions required)
 * Uses split 32-bit arithmetic for cross-platform consistency
 *
 * @author Bernardo Sanchez Gutierrez <tuxor.max@gmail.com>
 * @license GPL-3.0
 */

class Tuxor
{
    private const VALID_OPERATORS = ['+', '-', '*', '%', '^', '&', '|', '<', '>', '#'];
    private const BLOCK_SIZE = 16; // 16 hex chars = 8 bytes = 64 bits
    private const BLOCK_COUNT = 4;

    /**
     * Compute the tuxor from identity and secret
     */
    public static function compute(string $identity, string $secret): string
    {
        $idParsed = self::parse($identity);
        $secParsed = self::parse($secret);

        if (empty($idParsed['operators']) && empty($secParsed['operators'])) {
            throw new InvalidArgumentException('At least one input must contain operators');
        }

        if ($idParsed['clean'] === '' || $secParsed['clean'] === '') {
            throw new InvalidArgumentException('Clean text must be at least 1 character');
        }

        $operators = array_merge(
            $idParsed['prefix'],
            $idParsed['suffix'],
            $secParsed['prefix'],
            $secParsed['suffix']
        );

        if (empty($operators)) {
            throw new InvalidArgumentException('No operators found in inputs');
        }

        $hashI = hash('sha256', $idParsed['clean']);
        $hashS = hash('sha256', $secParsed['clean']);

        $blocksI = str_split($hashI, self::BLOCK_SIZE);
        $blocksS = str_split($hashS, self::BLOCK_SIZE);

        $results = [];
        $opCount = count($operators);
        for ($n = 0; $n < self::BLOCK_COUNT; $n++) {
            $op = $operators[$n % $opCount];
            // Work with [hi, lo] pairs (two 32-bit unsigned integers)
            $I = self::hexToU64($blocksI[$n]);
            $S = self::hexToU64($blocksS[$n]);
            $R = self::applyOp($op, $I, $S, $blocksI[$n], $blocksS[$n]);
            $results[] = self::u64ToHex($R);
        }

        return hash('sha256', implode('', $results));
    }

    /**
     * Verify a tuxor against stored value
     */
    public static function verify(string $identity, string $secret, string $storedTuxor): bool
    {
        return hash_equals($storedTuxor, self::compute($identity, $secret));
    }

    /**
     * Validate that an input string contains at least one operator
     */
    public static function validate(string $input): bool
    {
        $parsed = self::parse($input);
        return !empty($parsed['operators']) && $parsed['clean'] !== '';
    }

    /**
     * Parse an input string: extract prefix/suffix operators and clean text
     */
    public static function parse(string $input): array
    {
        $chars = str_split($input);
        $len = count($chars);

        // Detect inclusion modifier @ at start or end
        $include = false;
        if ($len > 0 && $chars[0] === '@') {
            $include = true;
            $chars = array_slice($chars, 1);
            $len--;
        } elseif ($len > 0 && $chars[$len - 1] === '@') {
            $include = true;
            $chars = array_slice($chars, 0, $len - 1);
            $len--;
        }

        $prefix = [];
        $suffix = [];
        $start = 0;
        $end = $len - 1;

        while ($start <= $end && in_array($chars[$start], self::VALID_OPERATORS, true)) {
            $prefix[] = $chars[$start];
            $start++;
        }

        while ($end >= $start && in_array($chars[$end], self::VALID_OPERATORS, true)) {
            $suffix[] = $chars[$end];
            $end--;
        }

        $suffix = array_reverse($suffix);

        // With @: operators stay in clean text (full string without @)
        // Without @: operators are removed from clean text
        if ($include) {
            $clean = implode('', $chars);
        } else {
            $clean = implode('', array_slice($chars, $start, $end - $start + 1));
        }

        return [
            'prefix'    => $prefix,
            'suffix'    => $suffix,
            'operators' => array_merge($prefix, $suffix),
            'clean'     => $clean,
            'include'   => $include,
        ];
    }

    // ====== U64: unsigned 64-bit as [int hi, int lo] (each 32-bit) ======

    /**
     * Convert 16-char hex to [hi, lo] pair
     */
    private static function hexToU64(string $hex): array
    {
        return [
            intval(hexdec(substr($hex, 0, 8))),
            intval(hexdec(substr($hex, 8, 8))),
        ];
    }

    /**
     * Convert [hi, lo] pair to 16-char hex
     */
    private static function u64ToHex(array $v): string
    {
        return sprintf('%08x%08x', $v[0] & 0xFFFFFFFF, $v[1] & 0xFFFFFFFF);
    }

    /**
     * Apply operator to two U64 values
     */
    private static function applyOp(string $op, array $I, array $S, string $hexI, string $hexS): array
    {
        return match ($op) {
            '+' => self::u64Add($I, $S),
            '-' => self::u64Sub($I, $S),
            '*' => self::u64Mul($I, $S),
            '%' => self::u64Mod($I, $S),
            '^' => [$I[0] ^ $S[0], $I[1] ^ $S[1]],
            '&' => [$I[0] & $S[0], $I[1] & $S[1]],
            '|' => [$I[0] | $S[0], $I[1] | $S[1]],
            '<' => self::u64RotL($I, self::u64ToInt($S) & 63),
            '>' => self::u64RotR($I, self::u64ToInt($S) & 63),
            '#' => self::hexToU64(substr(hash('sha256', $hexI . $hexS), 0, self::BLOCK_SIZE)),
            default => throw new InvalidArgumentException("Invalid operator: {$op}"),
        };
    }

    /**
     * U64 addition with mod 2^64
     */
    private static function u64Add(array $a, array $b): array
    {
        $lo = $a[1] + $b[1];
        $carry = ($lo > 0xFFFFFFFF) ? 1 : 0;
        $lo &= 0xFFFFFFFF;
        $hi = ($a[0] + $b[0] + $carry) & 0xFFFFFFFF;
        return [$hi, $lo];
    }

    /**
     * U64 subtraction with mod 2^64
     */
    private static function u64Sub(array $a, array $b): array
    {
        $lo = $a[1] - $b[1];
        $borrow = ($lo < 0) ? 1 : 0;
        $lo = $lo & 0xFFFFFFFF;
        $hi = ($a[0] - $b[0] - $borrow) & 0xFFFFFFFF;
        return [$hi, $lo];
    }

    /**
     * U64 multiplication with mod 2^64
     * (aHi*2^32 + aLo) * (bHi*2^32 + bLo) mod 2^64
     */
    private static function u64Mul(array $a, array $b): array
    {
        $aLo = $a[1]; $aHi = $a[0];
        $bLo = $b[1]; $bHi = $b[0];

        // Split each 32-bit into two 16-bit halves to avoid overflow
        $aLL = $aLo & 0xFFFF; $aLH = ($aLo >> 16) & 0xFFFF;
        $bLL = $bLo & 0xFFFF; $bLH = ($bLo >> 16) & 0xFFFF;

        // aLo * bLo (need full 64-bit result)
        $t0 = $aLL * $bLL;           // max 32 bits
        $t1 = $aLH * $bLL;           // max 32 bits
        $t2 = $aLL * $bLH;           // max 32 bits
        $t3 = $aLH * $bLH;           // max 32 bits

        $lo = $t0 & 0xFFFF;
        $mid = ($t0 >> 16) + ($t1 & 0xFFFF) + ($t2 & 0xFFFF);
        $lo = $lo | (($mid & 0xFFFF) << 16);
        $hi = ($mid >> 16) + ($t1 >> 16) + ($t2 >> 16) + $t3;

        // Cross terms that contribute to high 32 bits of 64-bit result
        $hi = ($hi + $aLo * $bHi + $aHi * $bLo) & 0xFFFFFFFF;

        return [$hi, $lo & 0xFFFFFFFF];
    }

    /**
     * U64 modulo — convert to float for simplicity (adequate for mod operation)
     */
    private static function u64Mod(array $a, array $b): array
    {
        $bVal = self::u64ToFloat($b);
        if ($bVal == 0) return [0, 0];
        $aVal = self::u64ToFloat($a);
        $result = intval(fmod($aVal, $bVal));
        return [($result >> 32) & 0xFFFFFFFF, $result & 0xFFFFFFFF];
    }

    /**
     * U64 rotate left by n bits (0-63)
     */
    private static function u64RotL(array $v, int $n): array
    {
        if ($n === 0) return $v;
        if ($n === 32) return [$v[1], $v[0]];
        if ($n < 32) {
            $hi = (($v[0] << $n) | self::urshift($v[1], 32 - $n)) & 0xFFFFFFFF;
            $lo = (($v[1] << $n) | self::urshift($v[0], 32 - $n)) & 0xFFFFFFFF;
        } else {
            $n -= 32;
            $hi = (($v[1] << $n) | self::urshift($v[0], 32 - $n)) & 0xFFFFFFFF;
            $lo = (($v[0] << $n) | self::urshift($v[1], 32 - $n)) & 0xFFFFFFFF;
        }
        return [$hi, $lo];
    }

    /**
     * U64 rotate right by n bits (0-63)
     */
    private static function u64RotR(array $v, int $n): array
    {
        if ($n === 0) return $v;
        return self::u64RotL($v, 64 - $n);
    }

    /**
     * Unsigned right shift for 32-bit values in PHP
     */
    private static function urshift(int $v, int $n): int
    {
        if ($n === 0) return $v & 0xFFFFFFFF;
        if ($n >= 32) return 0;
        return ($v >> $n) & (0x7FFFFFFF >> ($n - 1));
    }

    /**
     * Convert U64 to a small int (for shift amounts)
     */
    private static function u64ToInt(array $v): int
    {
        return $v[1];
    }

    /**
     * Convert U64 to float (for modulo — loses precision for very large values)
     */
    private static function u64ToFloat(array $v): float
    {
        return $v[0] * 4294967296.0 + $v[1];
    }
}
