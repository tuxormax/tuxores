# TUXOR

**Operator-Based Dual-Hash Authentication Algorithm**

TUXOR is an authentication algorithm where users embed mathematical operators within their credentials. Both the identity (username) and secret (password) must contain at least one operator symbol. The system combines the hashed inputs using those operators and stores only the final result — the **tuxor**. No username or password is ever stored.

## How It Works

```
Identity:  +alice^
Secret:    *MyPassword#

1. Extract operators:  [+, ^, *, #]    (from both inputs)
2. Remove operators:   "alice", "MyPassword"
3. SHA-256 each:       hash_i, hash_s  (64 hex chars each)
4. Split into 4 blocks of 16 hex chars (64-bit integers)
5. Apply operators cyclically:
     Block 0: hash_i[0]  +  hash_s[0]
     Block 1: hash_i[1]  ^  hash_s[1]
     Block 2: hash_i[2]  *  hash_s[2]
     Block 3: hash_i[3]  #  hash_s[3]
6. Concatenate results → SHA-256 → tuxor (64 hex chars)
```

Only the tuxor is stored. On login, the system recomputes it and compares.

## Valid Operators (10)

| Symbol | Operation | Type |
|--------|-----------|------|
| `+` | Addition | Arithmetic |
| `-` | Subtraction | Arithmetic |
| `*` | Multiplication | Arithmetic |
| `%` | Modulo | Arithmetic |
| `^` | XOR | Bitwise |
| `&` | AND | Bitwise |
| `\|` | OR | Bitwise |
| `<` | Left Rotate | Shift |
| `>` | Right Rotate | Shift |
| `#` | Re-Hash | Special |

Operators go at the **beginning** and/or **end** of each input:

```
+alice        ← prefix only
alice*        ← suffix only
+alice^       ← prefix + suffix
+-alice*>     ← multiple prefix + multiple suffix
```

**Both** the identity and the secret must contain at least one operator.

## Input Requirements

- **Identity:** At least 1 operator symbol + at least 1 character of clean text
- **Secret:** At least 1 operator symbol + at least 1 character of clean text
- Operators must be at the start and/or end — not in the middle
- The clean text (without operators) is what gets hashed

## Security Properties

- **Nothing stored:** No username, no password — only the tuxor
- **Three-factor knowledge:** Attacker must guess identity + secret + operators
- **Non-reversible:** Cannot decompose a tuxor into its inputs
- **Operator entropy:** 10 symbols across multiple positions add ~13-20 bits
- **Collision resistance:** Inherits SHA-256's 256-bit security

## Account Recovery

Since the tuxor is non-reversible, recovery requires a full credential reset via a registered **recovery contact** — either an email address or phone number:

```
recovery: "user@example.com"    → email detected → sends link
recovery: "+5214421234567"      → phone detected → sends SMS/code
```

The system auto-detects the type. On recovery, the user sets entirely new credentials.

## Quick Start

### PHP

```php
require_once 'php/Tuxor.php';

// Register
$tuxor = Tuxor::compute('+alice^', '*MyPassword#');
// Store $tuxor in database

// Login
$valid = Tuxor::verify('+alice^', '*MyPassword#', $storedTuxor);

// Validate input has operators
Tuxor::validate('+alice^');  // true
Tuxor::validate('alice');    // false
```

### JavaScript

```javascript
import { compute, verify, validate } from './javascript/tuxor.js';

// Register
const tuxor = await compute('+alice^', '*MyPassword#');

// Login
const valid = await verify('+alice^', '*MyPassword#', storedTuxor);

// Validate
validate('+alice^');  // true
validate('alice');    // false
```

### Python

```python
from python.tuxor import compute, verify, validate

# Register
tuxor = compute('+alice^', '*MyPassword#')

# Login
valid = verify('+alice^', '*MyPassword#', stored_tuxor)

# Validate
validate('+alice^')  # True
validate('alice')    # False
```

## Running Tests

```bash
# PHP (requires bcmath extension)
php tests/test.php

# Python
python3 tests/test.py

# JavaScript (Node.js 16+)
node tests/test.js
```

## Specification

See [SPEC.md](SPEC.md) for the complete formal specification, including the algorithm details, operator definitions, test vectors, and security analysis.

## Recommendations

1. Apply **bcrypt** or **Argon2** to the final tuxor before storage for additional brute-force resistance
2. Implement **rate limiting** at the application level
3. Always use **TLS/HTTPS** for credential transmission
4. Require at least **2 operators** total across both inputs

## License

MIT

## Author

Bernardo Sanchez Gutierrez
