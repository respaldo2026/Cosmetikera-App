# Plantillas de Meta Business Manager - Cumpleaños (MARKETING)

## ℹ️ NOTA

Meta clasifica los mensajes de cumpleaños como **MARKETING** automaticamente. Estas plantillas estan optimizadas para maxima conversion dentro de esa categoria.

---

## 📋 Plantilla 1: Cumpleanos en 2 Dias

**Template Name:** `cumpleanos_recordatorio_2d_es`
**Category:** MARKETING
**Language:** Spanish (es)

**Content (copia EXACTO):**
```
Hola {{1}}! 🎂

Tu cumpleanos es en 2 dias y en La Cosmetikera tenemos algo especial para ti.

Escribe "CUMPLE" para ver tu regalo de cumpleanos 🎁
```

---

## 📋 Plantilla 2: Cumpleanos Manana

**Template Name:** `cumpleanos_recordatorio_1d_es`
**Category:** MARKETING
**Language:** Spanish (es)

**Content (copia EXACTO):**
```
Hola {{1}}! 🎂

Manana es tu cumpleanos! En La Cosmetikera tenemos una sorpresa lista para ti.

Escribe "CUMPLE" para reclamarla antes de que expire 🎁
```

---

## 📋 Plantilla 3: Feliz Cumpleanos Hoy

**Template Name:** `cumpleanos_celebracion_es`
**Category:** MARKETING
**Language:** Spanish (es)

**Content (copia EXACTO):**
```
Feliz cumpleanos {{1}}! 🎂🎉

Hoy es tu dia especial y La Cosmetikera lo celebra contigo.

Escribe "CUMPLE" para activar tu regalo de hoy 🎁
```

---

## ✅ Por que estas convierten mejor

| Elemento | Razon |
|----------|-------|
| **{{1}} = nombre del cliente** | Personalizacion aumenta apertura 40% |
| **"algo especial para ti"** | Genera curiosidad sin revelar todo |
| **"Escribe CUMPLE"** | CTA claro y facil de responder |
| **"antes de que expire"** | Urgencia aumenta conversion |
| **Emoji 🎁** | Refuerza la idea de regalo |

---

## 📝 Como usar la variable {{1}}

En Meta Business Manager:
- `{{1}}` se reemplaza automaticamente con el nombre del cliente
- En tu codigo, ya se envia el nombre en el payload del template

En el endpoint `send-birthday-reminder`, el parametro se envia asi:
```json
"components": [{
  "type": "body",
  "parameters": [{ "type": "text", "text": "Maria" }]
}]
```

---

## 📝 Pasos para crear en Meta Business Manager

1. Ir a **https://business.facebook.com**
2. Buscar **"Message Templates"** o **WhatsApp > Settings > Message Templates**
3. Click **Create Template**
4. **Template Name**: Copiar exacto (ej. `cumpleanos_recordatorio_2d_es`)
5. **Category**: Seleccionar **MARKETING**
6. **Language**: **Spanish (Espanol)**
7. **Message Content**: Pegar el contenido de arriba **EXACTO**
8. **Submit for Review**
9. Esperar aprobacion (~2-24 horas)

---

## 🔍 Status de Aprobacion

Una vez enviadas, revisalas en Meta:
- **Approved** ✅ = Listo para usar
- **Pending** ⏳ = En revision (espera ~24h)
- **Rejected** ❌ = Necesita cambios

---

## 🚀 Despues de Aprobacion

1. **Migracion SQL ejecutada en Supabase** ✅
2. **Endpoint listo** ✅
3. **Plantillas aprobadas en Meta** ← Aqui estas
4. **Configurar Make.com** - 3 escenarios diarios
5. **Testing con dry_run**
6. **Go Live**

---

**Version:** 3.0 (Marketing - Alta Conversion)
**Ultima actualizacion:** 2 de mayo de 2026

---

## ✅ Notas adicionales

- Las plantillas usan `{{1}}` = nombre del cliente (ya configurado en el endpoint)
- Meta las clasifica como MARKETING (normal para mensajes de cumpleanos)
- Funciona 24/7 sin restriccion de ventana horaria para templates

---

**Version:** 3.0 (Marketing - Alta Conversion)
**Ultima actualizacion:** 2 de mayo de 2026
