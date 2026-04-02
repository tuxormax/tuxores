/**
 * TUXOR v1.0 — Operator-Based Dual-Hash Authentication Algorithm
 * Reference implementation in JavaScript (Browser + Node.js)
 *
 * @author Bernardo Sanchez Gutierrez <tuxor.max@gmail.com>
 * @license GPL-3.0
 */

const VALID_OPERATORS = ['+', '-', '*', '%', '^', '&', '|', '<', '>', '#'];
const BLOCK_SIZE = 16;
const BLOCK_COUNT = 4;
const MOD_64 = 2n ** 64n;

/**
 * SHA-256 hash — works in both Node.js and browser
 */
async function sha256(message) {
    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // Node.js fallback
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(message).digest('hex');
}

/**
 * Parse an input string: extract prefix/suffix operators and clean text
 */
function parse(input) {
    const chars = [...input];
    let start = 0;
    let end = chars.length - 1;
    const prefix = [];
    const suffix = [];

    while (start <= end && VALID_OPERATORS.includes(chars[start])) {
        prefix.push(chars[start]);
        start++;
    }

    while (end >= start && VALID_OPERATORS.includes(chars[end])) {
        suffix.push(chars[end]);
        end--;
    }

    suffix.reverse();

    const clean = chars.slice(start, end + 1).join('');

    return {
        prefix,
        suffix,
        operators: [...prefix, ...suffix],
        clean
    };
}

/**
 * Convert 16-char hex string to BigInt
 */
function hexToBigInt(hex) {
    return BigInt('0x' + hex);
}

/**
 * Convert BigInt to 16-char zero-padded hex string
 */
function bigIntToHex(num, padLength) {
    let hex = num.toString(16);
    return hex.padStart(padLength, '0').slice(-padLength);
}

/**
 * Rotate left a 64-bit BigInt by n bits
 */
function rotateLeft64(value, n) {
    const shift = Number(n % 64n);
    if (shift === 0) return value;
    return ((value << BigInt(shift)) | (value >> BigInt(64 - shift))) % MOD_64;
}

/**
 * Rotate right a 64-bit BigInt by n bits
 */
function rotateRight64(value, n) {
    const shift = Number(n % 64n);
    if (shift === 0) return value;
    return rotateLeft64(value, BigInt(64 - shift));
}

/**
 * Apply an operator to two BigInt values
 */
async function applyOp(op, I, S, hexI, hexS) {
    switch (op) {
        case '+': return (I + S) % MOD_64;
        case '-': return (I - S + MOD_64) % MOD_64;
        case '*': return (I * S) % MOD_64;
        case '%': return S === 0n ? I % 1n : I % S;
        case '^': return I ^ S;
        case '&': return I & S;
        case '|': return I | S;
        case '<': return rotateLeft64(I, S % 64n);
        case '>': return rotateRight64(I, S % 64n);
        case '#': {
            const rehash = await sha256(hexI + hexS);
            return hexToBigInt(rehash.substring(0, BLOCK_SIZE));
        }
        default:
            throw new Error(`Invalid operator: ${op}`);
    }
}

/**
 * Compute the tuxor from identity and secret
 */
async function compute(identity, secret) {
    const idParsed = parse(identity);
    const secParsed = parse(secret);

    if (idParsed.operators.length === 0 && secParsed.operators.length === 0) {
        throw new Error('At least one input must contain operators');
    }

    if (idParsed.clean === '' || secParsed.clean === '') {
        throw new Error('Clean text must be at least 1 character');
    }

    const operators = [
        ...idParsed.prefix,
        ...idParsed.suffix,
        ...secParsed.prefix,
        ...secParsed.suffix
    ];

    if (operators.length === 0) {
        throw new Error('No operators found in inputs');
    }

    const hashI = await sha256(idParsed.clean);
    const hashS = await sha256(secParsed.clean);

    const blocksI = [];
    const blocksS = [];
    for (let i = 0; i < BLOCK_COUNT; i++) {
        blocksI.push(hashI.substring(i * BLOCK_SIZE, (i + 1) * BLOCK_SIZE));
        blocksS.push(hashS.substring(i * BLOCK_SIZE, (i + 1) * BLOCK_SIZE));
    }

    const results = [];
    const opCount = operators.length;
    for (let n = 0; n < BLOCK_COUNT; n++) {
        const op = operators[n % opCount];
        const I = hexToBigInt(blocksI[n]);
        const S = hexToBigInt(blocksS[n]);
        const R = await applyOp(op, I, S, blocksI[n], blocksS[n]);
        results.push(bigIntToHex(R, BLOCK_SIZE));
    }

    return await sha256(results.join(''));
}

/**
 * Verify a tuxor against stored value
 */
async function verify(identity, secret, storedTuxor) {
    const computed = await compute(identity, secret);
    return computed === storedTuxor;
}

/**
 * Validate that an input string contains at least one operator
 */
function validate(input) {
    const parsed = parse(input);
    return parsed.operators.length > 0 && parsed.clean !== '';
}

// Export for Node.js / ES Modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { compute, verify, validate, parse };
}

export { compute, verify, validate, parse };
