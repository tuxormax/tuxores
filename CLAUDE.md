# CLAUDE.md — TUXOR

> Algoritmo de Autenticación Dual-Hash Basado en Operadores

---

## Stack

- **Lenguajes:** PHP 8, JavaScript (Node.js 16+/Browser), Python 3.6+
- **Dependencias:** Ninguna (solo funciones nativas de cada lenguaje)
- **KDF Modo Seguro:** PHP → Argon2id, JS/Python → scrypt
- **Paper:** LaTeX (pdflatex)
- **Licencia:** GPL-3.0

---

## Estructura del proyecto

```
tuxor/
├── README.md                  ← Documentación bilingüe (EN/ES)
├── SPEC.md                    ← Especificación formal bilingüe v2.0
├── LICENSE                    ← GPL-3.0
├── php/Tuxor.php              ← Implementación PHP (sin extensiones externas)
├── javascript/
│   ├── tuxor.js               ← ES Modules (browser)
│   └── tuxor.cjs.js           ← CommonJS (Node.js)
├── python/tuxor.py            ← Implementación Python
├── paper/
│   ├── tuxor-paper.tex        ← Paper académico LaTeX
│   └── tuxor-paper.pdf        ← Paper compilado (7 páginas)
└── tests/
    ├── test.php               ← 35 tests
    ├── test.js                ← 34 tests
    └── test.py                ← 34 tests
```

---

## Concepto del algoritmo

1. **PARSE:** Extraer operadores (`+ - * % ^ & | < > #`) del inicio/final de identidad y secreto
2. **Modificador @:** Controla si operadores se incluyen en el hash (4 modos: none, prefix, suffix, all)
3. **HASH:** SHA-256 de cada texto limpio → 64 hex chars
4. **SPLIT:** Dividir cada hash en 4 bloques de 16 hex (64 bits)
5. **OPERATE:** Aplicar operadores cíclicamente a cada par de bloques
6. **COMBINE:** SHA-256 del resultado concatenado → tuxor (64 hex chars)

---

## Modos de operación

### Básico (`compute` / `verify`)
Solo TUXOR — rápido, sin salt. Para pruebas y uso interno.

### Seguro (`computeSecure` / `verifySecure`)
TUXOR + salt + KDF (Argon2id/scrypt). Para producción.

```
tuxor_raw = TUXOR(identidad, secreto)     → capa de confusión
tuxor_final = KDF(tuxor_raw, salt, cost)  → capa de resistencia
```

---

## Test vector (cross-platform)

```
Identity: "+tuxor"
Secret:   "*algorithm#"
Tuxor:    663b623d1f5f78b197cfe54fbdbb47dcb679c8842e0bb138d90e001aaa50fdb8
```

Las 3 implementaciones DEBEN producir este mismo valor.

---

## Ejecutar tests

```bash
php tests/test.php        # PHP: 35 tests
python3 tests/test.py     # Python: 34 tests
node tests/test.js        # JavaScript: 34 tests
```

---

## Compilar paper

```bash
cd paper && pdflatex tuxor-paper.tex && pdflatex tuxor-paper.tex
```

(Dos pasadas para resolver referencias)

---

## Versionado

- **v2.0** (02-Abr-2026) — Modo seguro (salt + Argon2id/scrypt), paper académico
- **v1.1** (02-Abr-2026) — Modificador `@` expandido a 4 modos
- **v1.0** (02-Abr-2026) — Especificación inicial

---

## Autor

Bernardo Sanchez Gutierrez — tuxor.max@gmail.com
