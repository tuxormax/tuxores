# TUXOR v1.0 — Operator-Based Dual-Hash Authentication Algorithm

# TUXOR v1.0 — Algoritmo de Autenticación Dual-Hash Basado en Operadores

---

[English](#english) | [Español](#español)

---

## English

### Abstract

TUXOR is an authentication algorithm that combines two hashed inputs (identity and secret) using user-defined arithmetic and bitwise operators. The operator symbols are embedded within the inputs themselves, making the operation selection part of the secret. Only the final computed value (the **tuxor**) is stored — neither the identity nor the secret are persisted.

---

### 1. Definitions

| Term | Description |
|------|-------------|
| **Identity** | The first input string (e.g., a username). Must contain at least one operator symbol. |
| **Secret** | The second input string (e.g., a password). Must contain at least one operator symbol. |
| **Operator** | A symbol from the valid set that defines a mathematical or bitwise operation. |
| **Tuxor** | The final 64-character hexadecimal hash — the only value stored. |
| **Block** | A 16-character hexadecimal substring representing a 64-bit unsigned integer. |

---

### 2. Valid Operators

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

### 3. Input Requirements

Both **identity** and **secret** MUST contain at least one valid operator symbol, placed at the beginning and/or end of the string.

```
Format:  [operators_prefix] clean_text [operators_suffix]

Valid examples:
  +juan              → prefix: [+],    suffix: [],     clean: "juan"
  *juan-             → prefix: [*],    suffix: [-],    clean: "juan"
  +*juan             → prefix: [+,*],  suffix: [],     clean: "juan"
  ^MyPassword#       → prefix: [^],    suffix: [#],    clean: "MyPassword"
  +-MyPassword*>     → prefix: [+,-],  suffix: [*,>],  clean: "MyPassword"

Invalid examples:
  juan               → no operators (REJECTED)
  ju+an              → operator in middle (treated as no operator — REJECTED)
```

**Minimum clean text length:** 1 character after removing operators.

---

### 4. Algorithm

#### Step 1 — PARSE

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

#### Step 2 — HASH

Compute SHA-256 of each cleaned input:

```
H_i = SHA-256( clean_identity )    → 64 hex characters
H_s = SHA-256( clean_secret )      → 64 hex characters
```

#### Step 3 — SPLIT

Divide each hash into 4 blocks of 16 hexadecimal characters each:

```
H_i = [ I₀, I₁, I₂, I₃ ]    (each 16 hex chars = 64-bit integer)
H_s = [ S₀, S₁, S₂, S₃ ]
```

#### Step 4 — OPERATE

Apply operators cyclically to each block pair:

```
For n = 0 to 3:
  op = operators[ n mod len(operators) ]
  R_n = apply(op, I_n, S_n)
```

Where `apply(op, I, S)` performs the operation defined in Section 2.

All arithmetic operations are performed modulo 2⁶⁴ to keep results within 64-bit range.

#### Step 5 — COMBINE

Convert each result back to a 16-character zero-padded hexadecimal string. Concatenate all results and compute the final hash:

```
tuxor = SHA-256( hex(R₀) ∥ hex(R₁) ∥ hex(R₂) ∥ hex(R₃) )
```

The output is a 64-character hexadecimal string.

---

### 5. Storage

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

### 6. Verification

```
1. User provides: identity + secret (both with operators)
2. System computes: tuxor = TUXOR(identity, secret)
3. System queries: SELECT * FROM users WHERE tuxor = ?
4. Match found → authenticated
5. No match → rejected
```

---

### 7. Account Recovery

Since the tuxor is non-reversible and no individual credential is stored, account recovery requires a full credential reset.

#### Recovery Contact

Each user registers a **recovery** field that can be either an email address or a phone number. The system auto-detects the type:

```
recovery = "user@example.com"   → type: email
recovery = "+5214421234567"     → type: phone
recovery = "4421234567"         → type: phone (digits only)
```

**Detection rule:** if the value contains `@` → email. If it contains only digits, `+`, `-`, spaces, or parentheses → phone. Otherwise → reject.

#### Recovery Flow

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

---

### 8. Security Properties

| Property | Description |
|----------|-------------|
| **Non-reversible** | The tuxor cannot be decomposed into its original inputs |
| **Three-factor knowledge** | Attacker must guess: identity + secret + operators |
| **No credential storage** | Database compromise reveals no usernames or passwords |
| **Operator entropy** | 10 symbols × multiple positions add ~13-20 bits of entropy |
| **Collision resistance** | Inherits from SHA-256 (256-bit output) |
| **Deterministic** | Same inputs always produce the same tuxor |

#### Entropy Analysis

```
Operators per position:  10 possible symbols
Positions:               4  (identity prefix/suffix, secret prefix/suffix)
Symbols per position:    1-3 (practical range)
Operator combinations:   10¹ to 10¹² depending on usage
Additional entropy:      ~3.3 to ~40 bits
```

---

### 9. Recommendations

1. **Minimum operator count:** Require at least 2 operators total across both inputs
2. **Avoid patterns:** Do not use the same operator in all positions
3. **Clean text strength:** The clean identity and secret should follow standard password complexity guidelines
4. **Rate limiting:** Implement brute-force protection at the application level
5. **Transport security:** Always transmit inputs over TLS/HTTPS
6. **Optional hardening:** Apply bcrypt or Argon2 to the final tuxor before storage for additional brute-force resistance

---

### 10. Test Vector

```
Identity: "+tuxor"
Secret:   "*algorithm#"

Step 1 — PARSE:
  identity:  prefix=[+],  suffix=[],   clean="tuxor"
  secret:    prefix=[*],  suffix=[#],  clean="algorithm"
  operators: [+, *, #]

Step 2 — HASH:
  H_i = SHA-256("tuxor")
      = a735fb5bde81ec767b8a3fc7a202052606f894682ff5ef85344b8eaaac9b593e
  H_s = SHA-256("algorithm")
      = b1eb2ec8ac9f31ff7918231e67f96e6deda83a9ff33ed2c67443f1df81e5ed14

Step 3 — SPLIT:
  I = [a735fb5bde81ec76, 7b8a3fc7a202052e, 06f894682ff5ef85, 344b8eaaac9b593e]
  S = [b1eb2ec8ac9f31ff, 7918231e67f96e6d, eda83a9ff33ed2c6, 7443f1df81e5ed14]

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

### 11. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-02 | Initial specification |

---

---

## Español

### Resumen

TUXOR es un algoritmo de autenticación que combina dos entradas hasheadas (identidad y secreto) usando operadores aritméticos y de bits definidos por el usuario. Los símbolos operadores están incrustados dentro de las propias entradas, haciendo que la selección de operación sea parte del secreto. Solo se almacena el valor final calculado (el **tuxor**) — ni la identidad ni el secreto se persisten.

---

### 1. Definiciones

| Término | Descripción |
|---------|-------------|
| **Identidad** | La primera cadena de entrada (ej: un nombre de usuario). Debe contener al menos un símbolo operador. |
| **Secreto** | La segunda cadena de entrada (ej: una contraseña). Debe contener al menos un símbolo operador. |
| **Operador** | Un símbolo del conjunto válido que define una operación matemática o de bits. |
| **Tuxor** | El hash hexadecimal final de 64 caracteres — el único valor almacenado. |
| **Bloque** | Una subcadena hexadecimal de 16 caracteres que representa un entero sin signo de 64 bits. |

---

### 2. Operadores Válidos

Los siguientes 10 símbolos son reconocidos como operadores:

| Símbolo | Operación | Tipo | Descripción |
|---------|-----------|------|-------------|
| `+` | Suma | Aritmético | `(I + S) mod 2⁶⁴` |
| `-` | Resta | Aritmético | `(I - S + 2⁶⁴) mod 2⁶⁴` |
| `*` | Multiplicación | Aritmético | `(I × S) mod 2⁶⁴` |
| `%` | Módulo | Aritmético | `I mod S` (si S = 0, usar S = 1) |
| `^` | XOR | Bit a bit | `I ⊕ S` |
| `&` | AND | Bit a bit | `I ∧ S` |
| `|` | OR | Bit a bit | `I ∨ S` |
| `<` | Rotación izquierda | Desplazamiento | Rotar I a la izquierda `(S mod 64)` bits |
| `>` | Rotación derecha | Desplazamiento | Rotar I a la derecha `(S mod 64)` bits |
| `#` | Re-Hash | Especial | `hex_a_int( SHA-256(I ∥ S) [0..15] )` |

---

### 3. Requisitos de Entrada

Tanto la **identidad** como el **secreto** DEBEN contener al menos un símbolo operador válido, colocado al inicio y/o final de la cadena.

```
Formato:  [operadores_prefijo] texto_limpio [operadores_sufijo]

Ejemplos válidos:
  +juan              → prefijo: [+],    sufijo: [],     limpio: "juan"
  *juan-             → prefijo: [*],    sufijo: [-],    limpio: "juan"
  +*juan             → prefijo: [+,*],  sufijo: [],     limpio: "juan"
  ^MiClave#          → prefijo: [^],    sufijo: [#],    limpio: "MiClave"
  +-MiClave*>        → prefijo: [+,-],  sufijo: [*,>],  limpio: "MiClave"

Ejemplos inválidos:
  juan               → sin operadores (RECHAZADO)
  ju+an              → operador en medio (tratado como sin operador — RECHAZADO)
```

**Longitud mínima del texto limpio:** 1 carácter después de remover operadores.

---

### 4. Algoritmo

#### Paso 1 — PARSEAR

Extraer los símbolos operadores del inicio y final de ambas entradas.

```
parsear("+-juan*>") → {
  ops_prefijo: ['+', '-'],
  ops_sufijo: ['*', '>'],
  limpio: "juan"
}
```

Construir la **cadena de operadores** concatenando todos los operadores extraídos en orden:

```
operadores = identidad.prefijo + identidad.sufijo + secreto.prefijo + secreto.sufijo
```

La cadena de operadores DEBE contener al menos 1 operador (garantizado por los requisitos de entrada).

#### Paso 2 — HASH

Calcular SHA-256 de cada entrada limpia:

```
H_i = SHA-256( identidad_limpia )    → 64 caracteres hex
H_s = SHA-256( secreto_limpio )      → 64 caracteres hex
```

#### Paso 3 — DIVIDIR

Dividir cada hash en 4 bloques de 16 caracteres hexadecimales cada uno:

```
H_i = [ I₀, I₁, I₂, I₃ ]    (cada uno 16 chars hex = entero de 64 bits)
H_s = [ S₀, S₁, S₂, S₃ ]
```

#### Paso 4 — OPERAR

Aplicar operadores cíclicamente a cada par de bloques:

```
Para n = 0 hasta 3:
  op = operadores[ n mod longitud(operadores) ]
  R_n = aplicar(op, I_n, S_n)
```

Donde `aplicar(op, I, S)` realiza la operación definida en la Sección 2.

Todas las operaciones aritméticas se realizan módulo 2⁶⁴ para mantener los resultados dentro del rango de 64 bits.

#### Paso 5 — COMBINAR

Convertir cada resultado de vuelta a una cadena hexadecimal de 16 caracteres con ceros a la izquierda. Concatenar todos los resultados y calcular el hash final:

```
tuxor = SHA-256( hex(R₀) ∥ hex(R₁) ∥ hex(R₂) ∥ hex(R₃) )
```

La salida es una cadena hexadecimal de 64 caracteres.

---

### 5. Almacenamiento

Solo el valor **tuxor** se almacena en la base de datos o sistema de autenticación.

```sql
CREATE TABLE usuarios (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(100),          -- nombre para mostrar (no se usa para auth)
  identidad     VARCHAR(100),          -- se guarda para display/logs (no se usa para auth)
  recuperacion  VARCHAR(255),          -- correo o teléfono para recuperación de cuenta
  tuxor         CHAR(64) NOT NULL,     -- el ÚNICO campo de autenticación
  token         VARCHAR(64),           -- token de recuperación (nullable)
  token_exp     TIMESTAMP,             -- expiración del token (nullable)
  creado        TIMESTAMP DEFAULT NOW()
);
```

**La identidad y el secreto NUNCA se almacenan.** Ni en texto plano ni hasheados individualmente.

---

### 6. Verificación

```
1. El usuario proporciona: identidad + secreto (ambos con operadores)
2. El sistema calcula: tuxor = TUXOR(identidad, secreto)
3. El sistema consulta: SELECT * FROM usuarios WHERE tuxor = ?
4. Coincidencia → autenticado
5. Sin coincidencia → rechazado
```

---

### 7. Recuperación de Cuenta

Dado que el tuxor no es reversible y no se almacena ninguna credencial individual, la recuperación de cuenta requiere un restablecimiento completo de credenciales.

#### Contacto de Recuperación

Cada usuario registra un campo de **recuperación** que puede ser una dirección de correo electrónico o un número telefónico. El sistema auto-detecta el tipo:

```
recuperacion = "usuario@ejemplo.com"  → tipo: correo
recuperacion = "+5214421234567"       → tipo: teléfono
recuperacion = "4421234567"           → tipo: teléfono (solo dígitos)
```

**Regla de detección:** si el valor contiene `@` → correo. Si contiene solo dígitos, `+`, `-`, espacios o paréntesis → teléfono. De lo contrario → rechazar.

#### Flujo de Recuperación

```
1. El usuario solicita recuperación ingresando su contacto de recuperación
2. El sistema detecta el tipo (correo o teléfono) y envía:
   - Correo → enlace con token de tiempo limitado
   - Teléfono → código de verificación por SMS/WhatsApp
3. El usuario verifica el token/código
4. El usuario define NUEVA identidad + NUEVO secreto (ambos con operadores)
5. El sistema calcula y almacena el nuevo tuxor
6. El tuxor anterior se reemplaza
```

---

### 8. Propiedades de Seguridad

| Propiedad | Descripción |
|-----------|-------------|
| **No reversible** | El tuxor no puede descomponerse en sus entradas originales |
| **Conocimiento de tres factores** | El atacante debe adivinar: identidad + secreto + operadores |
| **Sin almacenamiento de credenciales** | Una brecha en la BD no revela usuarios ni contraseñas |
| **Entropía de operadores** | 10 símbolos × múltiples posiciones agregan ~13-20 bits de entropía |
| **Resistencia a colisiones** | Hereda de SHA-256 (salida de 256 bits) |
| **Determinístico** | Las mismas entradas siempre producen el mismo tuxor |

#### Análisis de Entropía

```
Operadores por posición:  10 símbolos posibles
Posiciones:               4  (identidad prefijo/sufijo, secreto prefijo/sufijo)
Símbolos por posición:    1-3 (rango práctico)
Combinaciones operadores: 10¹ a 10¹² dependiendo del uso
Entropía adicional:       ~3.3 a ~40 bits
```

---

### 9. Recomendaciones

1. **Mínimo de operadores:** Requerir al menos 2 operadores en total entre ambas entradas
2. **Evitar patrones:** No usar el mismo operador en todas las posiciones
3. **Fortaleza del texto limpio:** La identidad y el secreto limpios deben seguir las guías estándar de complejidad de contraseñas
4. **Límite de intentos:** Implementar protección contra fuerza bruta a nivel de aplicación
5. **Seguridad en transporte:** Siempre transmitir las entradas sobre TLS/HTTPS
6. **Endurecimiento opcional:** Aplicar bcrypt o Argon2 al tuxor final antes de almacenarlo para resistencia adicional contra fuerza bruta

---

### 10. Vector de Prueba

```
Identidad: "+tuxor"
Secreto:   "*algorithm#"

Paso 1 — PARSEAR:
  identidad: prefijo=[+],  sufijo=[],   limpio="tuxor"
  secreto:   prefijo=[*],  sufijo=[#],  limpio="algorithm"
  operadores: [+, *, #]

Paso 2 — HASH:
  H_i = SHA-256("tuxor")
      = a735fb5bde81ec767b8a3fc7a202052606f894682ff5ef85344b8eaaac9b593e
  H_s = SHA-256("algorithm")
      = b1eb2ec8ac9f31ff7918231e67f96e6deda83a9ff33ed2c67443f1df81e5ed14

Paso 3 — DIVIDIR:
  I = [a735fb5bde81ec76, 7b8a3fc7a202052e, 06f894682ff5ef85, 344b8eaaac9b593e]
  S = [b1eb2ec8ac9f31ff, 7918231e67f96e6d, eda83a9ff33ed2c6, 7443f1df81e5ed14]

Paso 4 — OPERAR (ciclo: +, *, #):
  R₀ = I₀ + S₀           (operador: +)
  R₁ = I₁ * S₁           (operador: *)
  R₂ = rehash(I₂, S₂)    (operador: #)
  R₃ = I₃ + S₃           (operador: + — regresa al ciclo)

Paso 5 — COMBINAR:
  tuxor = SHA-256( hex(R₀) ∥ hex(R₁) ∥ hex(R₂) ∥ hex(R₃) )

Salida esperada:
  663b623d1f5f78b197cfe54fbdbb47dcb679c8842e0bb138d90e001aaa50fdb8
```

**Nota:** Las implementaciones DEBEN producir `663b623d1f5f78b197cfe54fbdbb47dcb679c8842e0bb138d90e001aaa50fdb8` para este vector de prueba para ser consideradas conformantes.

---

### 11. Historial de Versiones

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0 | 02-04-2026 | Especificación inicial |

---

**Autor / Author:** Bernardo Sanchez Gutierrez — tuxor.max@gmail.com
**Licencia / License:** GPL-3.0
