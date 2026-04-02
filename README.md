# TUXOR

**Operator-Based Dual-Hash Authentication Algorithm**
**Algoritmo de Autenticación Dual-Hash Basado en Operadores**

---

[English](#english) | [Español](#español)

---

## English

TUXOR is an authentication algorithm where users embed mathematical operators within their credentials. Both the identity (username) and secret (password) must contain at least one operator symbol. The system combines the hashed inputs using those operators and stores only the final result — the **tuxor**. No username or password is ever stored.

### How It Works

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

### Valid Operators (10)

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

### Inclusion Modifier `@`

The `@` symbol controls whether operators are included in the hashed text. 4 modes:

```
No @:       +alice*      → hashed: "alice"        (operators excluded)
@ start:    @+alice*     → hashed: "+alice"        (prefix included)
@ end:      +alice*@     → hashed: "alice*"        (suffix included)
@@ :        @@+alice*    → hashed: "+alice*"       (all included)
```

Each mode produces a completely different tuxor. The `@`/`@@` is consumed — an attacker can't tell which mode was used. Adds **2 bits of entropy** (4× brute-force effort).

### Input Requirements

- **Identity:** At least 1 operator symbol + at least 1 character of clean text
- **Secret:** At least 1 operator symbol + at least 1 character of clean text
- Operators must be at the start and/or end — not in the middle
- The clean text (without operators) is what gets hashed

### Security Properties

- **Nothing stored:** No username, no password — only the tuxor
- **Three-factor knowledge:** Attacker must guess identity + secret + operators
- **Non-reversible:** Cannot decompose a tuxor into its inputs
- **Operator entropy:** 10 symbols across multiple positions add ~13-20 bits
- **Collision resistance:** Inherits SHA-256's 256-bit security

### Account Recovery

Since the tuxor is non-reversible, recovery requires a full credential reset via a registered **recovery contact** — either an email address or phone number:

```
recovery: "user@example.com"    → email detected → sends link
recovery: "+5214421234567"      → phone detected → sends SMS/code
```

The system auto-detects the type. On recovery, the user sets entirely new credentials.

### Quick Start

#### PHP

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

#### JavaScript

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

#### Python

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

### Running Tests

```bash
# PHP
php tests/test.php

# Python
python3 tests/test.py

# JavaScript (Node.js 16+)
node tests/test.js
```

### Recommendations

1. Apply **bcrypt** or **Argon2** to the final tuxor before storage for additional brute-force resistance
2. Implement **rate limiting** at the application level
3. Always use **TLS/HTTPS** for credential transmission
4. Require at least **2 operators** total across both inputs

### Related Work

Several existing schemes share partial similarities with TUXOR:

| Scheme | Similarity | Key Difference |
|--------|-----------|----------------|
| **SXR** (Polpong, 2021) | Splits hash into blocks, combines with input-derived parameters | Single hash, XOR only |
| **LG** (Anbari, 2024) | Multiple logical gates (AND, OR, XOR, NAND) on credentials | Gates are fixed system parameters, not user-chosen |
| **HMAC** (RFC 2104) | Combines key + message with two hash passes | Fixed operation (XOR), single input |
| **Pepper** (OWASP) | Server-side secret combined with password | Secret is a value, not an operation |

**What makes TUXOR novel:** No published algorithm treats the combining operation itself as a user secret. In all existing schemes, the combining function is public and fixed. TUXOR's approach of embedding operator symbols within credentials as both input tokens and function selectors has no precedent in published cryptographic literature. See [SPEC.md](SPEC.md) Section 11 for full analysis.

---

## Español

TUXOR es un algoritmo de autenticación donde los usuarios insertan operadores matemáticos dentro de sus credenciales. Tanto la identidad (usuario) como el secreto (contraseña) deben contener al menos un símbolo operador. El sistema combina los hashes de ambas entradas usando esos operadores y almacena solo el resultado final — el **tuxor**. Nunca se guarda el usuario ni la contraseña.

### Cómo Funciona

```
Identidad: +alice^
Secreto:   *MiClave#

1. Extraer operadores:  [+, ^, *, #]    (de ambas entradas)
2. Remover operadores:  "alice", "MiClave"
3. SHA-256 a cada uno:  hash_i, hash_s  (64 caracteres hex cada uno)
4. Dividir en 4 bloques de 16 caracteres hex (enteros de 64 bits)
5. Aplicar operadores cíclicamente:
     Bloque 0: hash_i[0]  +  hash_s[0]
     Bloque 1: hash_i[1]  ^  hash_s[1]
     Bloque 2: hash_i[2]  *  hash_s[2]
     Bloque 3: hash_i[3]  #  hash_s[3]
6. Concatenar resultados → SHA-256 → tuxor (64 caracteres hex)
```

Solo se almacena el tuxor. Al iniciar sesión, el sistema lo recalcula y compara.

### Operadores Válidos (10)

| Símbolo | Operación | Tipo |
|---------|-----------|------|
| `+` | Suma | Aritmético |
| `-` | Resta | Aritmético |
| `*` | Multiplicación | Aritmético |
| `%` | Módulo | Aritmético |
| `^` | XOR | Bit a bit |
| `&` | AND | Bit a bit |
| `\|` | OR | Bit a bit |
| `<` | Rotación izquierda | Desplazamiento |
| `>` | Rotación derecha | Desplazamiento |
| `#` | Re-Hash | Especial |

Los operadores van al **inicio** y/o **final** de cada entrada:

```
+alice        ← solo prefijo
alice*        ← solo sufijo
+alice^       ← prefijo + sufijo
+-alice*>     ← múltiples prefijos + múltiples sufijos
```

**Tanto** la identidad como el secreto deben contener al menos un operador.

### Modificador de Inclusión `@`

El símbolo `@` controla si los operadores se incluyen en el texto hasheado. 4 modos:

```
Sin @:      +alice*      → hasheado: "alice"        (operadores excluidos)
@ inicio:   @+alice*     → hasheado: "+alice"        (prefijo incluido)
@ final:    +alice*@     → hasheado: "alice*"        (sufijo incluido)
@@ :        @@+alice*    → hasheado: "+alice*"       (todos incluidos)
```

Cada modo produce un tuxor completamente diferente. El `@`/`@@` se consume — un atacante no puede saber qué modo se usó. Agrega **2 bits de entropía** (4× esfuerzo de fuerza bruta).

### Requisitos de Entrada

- **Identidad:** Al menos 1 símbolo operador + al menos 1 carácter de texto limpio
- **Secreto:** Al menos 1 símbolo operador + al menos 1 carácter de texto limpio
- Los operadores deben estar al inicio y/o final — no en medio
- El texto limpio (sin operadores) es lo que se hashea

### Propiedades de Seguridad

- **Nada almacenado:** Ni usuario ni contraseña — solo el tuxor
- **Conocimiento de tres factores:** El atacante debe adivinar identidad + secreto + operadores
- **No reversible:** No se puede descomponer un tuxor en sus entradas originales
- **Entropía de operadores:** 10 símbolos en múltiples posiciones agregan ~13-20 bits
- **Resistencia a colisiones:** Hereda la seguridad de 256 bits de SHA-256

### Recuperación de Cuenta

Como el tuxor no es reversible, la recuperación requiere un restablecimiento completo de credenciales mediante un **contacto de recuperación** registrado — ya sea correo electrónico o número telefónico:

```
recuperacion: "usuario@ejemplo.com"  → correo detectado → envía enlace
recuperacion: "+5214421234567"       → teléfono detectado → envía SMS/código
```

El sistema auto-detecta el tipo. Al recuperar, el usuario define credenciales completamente nuevas.

### Uso Rápido

#### PHP

```php
require_once 'php/Tuxor.php';

// Registro
$tuxor = Tuxor::compute('+alice^', '*MiClave#');
// Guardar $tuxor en la base de datos

// Login
$valido = Tuxor::verify('+alice^', '*MiClave#', $tuxorAlmacenado);

// Validar que la entrada tiene operadores
Tuxor::validate('+alice^');  // true
Tuxor::validate('alice');    // false
```

#### JavaScript

```javascript
import { compute, verify, validate } from './javascript/tuxor.js';

// Registro
const tuxor = await compute('+alice^', '*MiClave#');

// Login
const valido = await verify('+alice^', '*MiClave#', tuxorAlmacenado);

// Validar
validate('+alice^');  // true
validate('alice');    // false
```

#### Python

```python
from python.tuxor import compute, verify, validate

# Registro
tuxor = compute('+alice^', '*MiClave#')

# Login
valido = verify('+alice^', '*MiClave#', tuxor_almacenado)

# Validar
validate('+alice^')  # True
validate('alice')    # False
```

### Ejecutar Tests

```bash
# PHP
php tests/test.php

# Python
python3 tests/test.py

# JavaScript (Node.js 16+)
node tests/test.js
```

### Recomendaciones

1. Aplicar **bcrypt** o **Argon2** al tuxor final antes de almacenarlo para resistencia adicional contra fuerza bruta
2. Implementar **límite de intentos** (rate limiting) a nivel de aplicación
3. Siempre usar **TLS/HTTPS** para la transmisión de credenciales
4. Requerir al menos **2 operadores** en total entre ambas entradas

### Trabajo Relacionado

Varios esquemas existentes comparten similitudes parciales con TUXOR:

| Esquema | Similitud | Diferencia clave |
|---------|-----------|------------------|
| **SXR** (Polpong, 2021) | Divide hash en bloques, combina con parámetros del input | Un solo hash, solo XOR |
| **LG** (Anbari, 2024) | Múltiples compuertas lógicas (AND, OR, XOR, NAND) sobre credenciales | Compuertas son parámetros fijos del sistema, no elegidos por el usuario |
| **HMAC** (RFC 2104) | Combina clave + mensaje con dos pases de hash | Operación fija (XOR), entrada única |
| **Pepper** (OWASP) | Secreto del servidor combinado con contraseña | El secreto es un valor, no una operación |

**Qué hace novel a TUXOR:** Ningún algoritmo publicado trata la operación de combinación como un secreto del usuario. En todos los esquemas existentes, la función combinadora es pública y fija. El enfoque de TUXOR de incrustar símbolos operadores dentro de las credenciales como tokens de entrada y selectores de función no tiene precedente en la literatura criptográfica publicada. Ver [SPEC.md](SPEC.md) Sección 11 para el análisis completo.

---

## Specification / Especificación

See [SPEC.md](SPEC.md) for the complete formal specification.
Consulta [SPEC.md](SPEC.md) para la especificación formal completa.

## License / Licencia

GPL-3.0

## Author / Autor

**Bernardo Sanchez Gutierrez** — tuxor.max@gmail.com
