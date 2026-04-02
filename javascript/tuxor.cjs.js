/**
 * TUXOR v1.0 — Operator-Based Dual-Hash Authentication Algorithm
 * Reference implementation in JavaScript (CommonJS for Node.js)
 *
 * @author Bernardo Sanchez Gutierrez <tuxor.max@gmail.com>
 * @license GPL-3.0
 */

const crypto = require('crypto');

const VALID_OPERATORS = ['+', '-', '*', '%', '^', '&', '|', '<', '>', '#'];
const BLOCK_SIZE = 16;
const BLOCK_COUNT = 4;
const MOD_64 = 2n ** 64n;

function sha256(message) {
    return crypto.createHash('sha256').update(message).digest('hex');
}

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

function hexToBigInt(hex) {
    return BigInt('0x' + hex);
}

function bigIntToHex(num, padLength) {
    let hex = (num % MOD_64).toString(16);
    if (hex.length > padLength) hex = hex.slice(-padLength);
    return hex.padStart(padLength, '0');
}

function rotateLeft64(value, n) {
    const shift = Number(n % 64n);
    if (shift === 0) return value;
    value = value % MOD_64;
    return ((value << BigInt(shift)) | (value >> BigInt(64 - shift))) % MOD_64;
}

function rotateRight64(value, n) {
    const shift = Number(n % 64n);
    if (shift === 0) return value;
    return rotateLeft64(value, BigInt(64 - shift));
}

function applyOp(op, I, S, hexI, hexS) {
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
            const rehash = sha256(hexI + hexS);
            return hexToBigInt(rehash.substring(0, BLOCK_SIZE));
        }
        default:
            throw new Error(`Invalid operator: ${op}`);
    }
}

function compute(identity, secret) {
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

    const hashI = sha256(idParsed.clean);
    const hashS = sha256(secParsed.clean);

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
        const R = applyOp(op, I, S, blocksI[n], blocksS[n]);
        results.push(bigIntToHex(R, BLOCK_SIZE));
    }

    return sha256(results.join(''));
}

function verify(identity, secret, storedTuxor) {
    const computed = compute(identity, secret);
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(storedTuxor));
}

function validate(input) {
    const parsed = parse(input);
    return parsed.operators.length > 0 && parsed.clean !== '';
}

module.exports = { compute, verify, validate, parse };
