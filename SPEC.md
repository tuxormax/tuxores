# TUXOR v1.0 — Operator-Based Dual-Hash Authentication Algorithm

## Abstract

TUXOR is an authentication algorithm that combines two hashed inputs (identity and secret) using user-defined arithmetic and bitwise operators. The operator symbols are embedded within the inputs themselves, making the operation selection part of the secret. Only the final computed value (the **tuxor**) is stored — neither the identity nor the secret are persisted.

---

## 1. Definitions

| Term | Description |
|------|-------------|
| **Identity** | The first input string (e.g., a username). Must contain at least one operator symbol. |
| **Secret** | The second input string (e.g., a password). Must contain at least one operator symbol. |
| **Operator** | A symbol from the valid set that defines a mathematical or bitwise operation. |
| **Tuxor** | The final 64-character hexadecimal hash — the only value stored. |
| **Block** | A 16-character hexadecimal substring representing a 64-bit unsigned integer. |

---

## 2. Valid Operators

The following 10 symbols are recognized as operators:

| Symbol | Operation | Type | Description |
|--------|-----------|------|-------------|
| `+` | Addition | Arithmetic | `(I + S) mod 2⁶⁴` |
| `-` | Subtraction | Arithmetic | `(I - S + 2⁶⁴) mod 2⁶⁴` |
| `*` | Multiplication | Arithmetic | `(I × S) mod 2⁶⁴` |
| `%` | Modulo | Arithmetic | `I mod S` (if S = 0, use S = 1) |
| `^` | XOR | Bitwise | `I ⊕ S` |
| `&` | AND | Bitwise | `I ∧ S` |
| `|` | OR | Bitwise | `I ∨ S` |
| `<` | Left Rotate | Shift | Rotate I left by `(S mod 64)` bits |
| `>` | Right Rotate | Shift | Rotate I right by `(S mod 64)` bits |
| `#` | Re-Hash | Special | `hex_to_int( SHA-256(I ∥ S) [0..15] )` |

---

## 3. Input Requirements

Both **identity** and **secret** MUST contain at least one valid operator symbol, placed at the beginning and/or end of the string.

```
Format:  [operators_prefix] clean_text [operators_suffix]

Valid examples:
  +juan              → prefix: [+],    suffix: [],     clean: "juan"
  *juan-             → prefix: [*],    suffix: [-],    clean: "juan"
  +*juan             → prefix: [+,*],  suffix: [],     clean: "juan"
  ^MiClave#          → prefix: [^],    suffix: [#],    clean: "MiClave"
  +-MiClave*>        → prefix: [+,-],  suffix: [*,>],  clean: "MiClave"

Invalid examples:
  juan               → no operators (REJECTED)
  ju+an              → operator in middle (treated as no operator — REJECTED)
```

**Minimum clean text length:** 1 character after removing operators.

---

## 4. Algorithm

### Step 1 — PARSE

Extract operator symbols from the beginning and end of both inputs.

```
parse("+-juan*>") → {
  prefix_ops: ['+', '-'],
  suffix_ops: ['*', '>'],
  clean: "juan"
}
```

Build the **operator chain** by concatenating all extracted operators in order:

```
operators = identity.prefix + identity.suffix + secret.prefix + secret.suffix
```

The operator chain MUST contain at least 1 operator (guaranteed by input requirements).

### Step 2 — HASH

Compute SHA-256 of each cleaned input:

```
H_i = SHA-256( clean_identity )    → 64 hex characters
H_s = SHA-256( clean_secret )      → 64 hex characters
```

### Step 3 — SPLIT

Divide each hash into 4 blocks of 16 hexadecimal characters each:

```
H_i = [ I₀, I₁, I₂, I₃ ]    (each 16 hex chars = 64-bit integer)
H_s = [ S₀, S₁, S₂, S₃ ]
```

### Step 4 — OPERATE

Apply operators cyclically to each block pair:

```
For n = 0 to 3:
  op = operators[ n mod len(operators) ]
  R_n = apply(op, I_n, S_n)
```

Where `apply(op, I, S)` performs the operation defined in Section 2.

All arithmetic operations are performed modulo 2⁶⁴ to keep results within 64-bit range.

### Step 5 — COMBINE

Convert each result back to a 16-character zero-padded hexadecimal string. Concatenate all results and compute the final hash:

```
tuxor = SHA-256( hex(R₀) ∥ hex(R₁) ∥ hex(R₂) ∥ hex(R₃) )
```

The output is a 64-character hexadecimal string.

---

## 5. Storage

Only the **tuxor** value is stored in the database or authentication system.

```sql
CREATE TABLE users (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100),          -- display name (not used for auth)
  identity   VARCHAR(100),          -- stored for display/logs (not used for auth)
  recovery   VARCHAR(255),          -- email or phone for account recovery
  tuxor      CHAR(64) NOT NULL,     -- the ONLY authentication field
  token      VARCHAR(64),           -- recovery token (nullable)
  token_exp  TIMESTAMP,             -- token expiration (nullable)
  created    TIMESTAMP DEFAULT NOW()
);
```

**The identity and secret are NEVER stored.** Neither in plain text nor hashed individually.

---

## 6. Verification

```
1. User provides: identity + secret (both with operators)
2. System computes: tuxor = TUXOR(identity, secret)
3. System queries: SELECT * FROM users WHERE tuxor = ?
4. Match found → authenticated
5. No match → rejected
```

---

## 7. Account Recovery

Since the tuxor is non-reversible and no individual credential is stored, account recovery requires a full credential reset.

### Recovery Contact

Each user registers a **recovery** field that can be either an email address or a phone number. The system auto-detects the type:

```
recovery = "user@example.com"   → type: email
recovery = "+5214421234567"     → type: phone
recovery = "4421234567"         → type: phone (digits only)
```

**Detection rule:** if the value contains `@` → email. If it contains only digits, `+`, `-`, spaces, or parentheses → phone. Otherwise → reject.

### Recovery Flow

```
1. User requests recovery by entering their recovery contact
2. System detects type (email or phone) and sends:
   - Email → time-limited link with token
   - Phone → SMS/WhatsApp with verification code
3. User verifies token/code
4. User sets NEW identity + NEW secret (both with operators)
5. System computes and stores the new tuxor
6. Previous tuxor is replaced
```

### Storage

```sql
CREATE TABLE users (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100),
  recovery   VARCHAR(255),          -- email or phone number
  tuxor      CHAR(64) NOT NULL,
  token      VARCHAR(64),           -- recovery token (nullable)
  token_exp  TIMESTAMP,             -- token expiration (nullable)
  created    TIMESTAMP DEFAULT NOW()
);
```

---

## 8. Security Properties

| Property | Description |
|----------|-------------|
| **Non-reversible** | The tuxor cannot be decomposed into its original inputs |
| **Three-factor knowledge** | Attacker must guess: identity + secret + operators |
| **No credential storage** | Database compromise reveals no usernames or passwords |
| **Operator entropy** | 10 symbols × multiple positions add ~13-20 bits of entropy |
| **Collision resistance** | Inherits from SHA-256 (256-bit output) |
| **Deterministic** | Same inputs always produce the same tuxor |

### Entropy Analysis

```
Operators per position:  10 possible symbols
Positions:               4  (identity prefix/suffix, secret prefix/suffix)
Symbols per position:    1-3 (practical range)
Operator combinations:   10¹ to 10¹² depending on usage
Additional entropy:      ~3.3 to ~40 bits
```

---

## 9. Recommendations

1. **Minimum operator count:** Require at least 2 operators total across both inputs
2. **Avoid patterns:** Do not use the same operator in all positions
3. **Clean text strength:** The clean identity and secret should follow standard password complexity guidelines
4. **Rate limiting:** Implement brute-force protection at the application level
5. **Transport security:** Always transmit inputs over TLS/HTTPS
6. **Optional hardening:** Apply bcrypt or Argon2 to the final tuxor before storage for additional brute-force resistance

---

## 10. Test Vector

```
Identity: "+tuxor"
Secret:   "*algorithm#"

Step 1 — PARSE:
  identity:  prefix=[+],  suffix=[],   clean="tuxor"
  secret:    prefix=[*],  suffix=[#],  clean="algorithm"
  operators: [+, *, #]

Step 2 — HASH:
  H_i = SHA-256("tuxor")
      = 431523429f11b85eb4e3a0bec9cf3a3149bbd5e5a5dd1d3dbc1f7a1b13fd82ba
  H_s = SHA-256("algorithm")
      = b77a78ec8e4b1bb41a8cedd037354e84d8b2e1e71f6e1e71050fe37c73e397b0

Step 3 — SPLIT:
  I = [431523429f11b85e, b4e3a0bec9cf3a31, 49bbd5e5a5dd1d3d, bc1f7a1b13fd82ba]
  S = [b77a78ec8e4b1bb4, 1a8cedd037354e84, d8b2e1e71f6e1e71, 050fe37c73e397b0]

Step 4 — OPERATE (cycle: +, *, #):
  R₀ = I₀ + S₀           (operator: +)
  R₁ = I₁ * S₁           (operator: *)
  R₂ = rehash(I₂, S₂)    (operator: #)
  R₃ = I₃ + S₃           (operator: + — cycles back)

Step 5 — COMBINE:
  tuxor = SHA-256( hex(R₀) ∥ hex(R₁) ∥ hex(R₂) ∥ hex(R₃) )

Expected output:
  663b623d1f5f78b197cfe54fbdbb47dcb679c8842e0bb138d90e001aaa50fdb8
```

**Note:** Implementations MUST produce `663b623d1f5f78b197cfe54fbdbb47dcb679c8842e0bb138d90e001aaa50fdb8` for this test vector to be considered conformant.

---

## 11. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-02 | Initial specification |

---

**Author:** Bernardo Sanchez Gutierrez
**License:** GPL-3.0
