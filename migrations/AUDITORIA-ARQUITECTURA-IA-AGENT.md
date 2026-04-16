# 🔍 AUDITORÍA COMPLETA: ARQUITECTURA DE AGENTE IA EN WHATSAPP

**Fecha:** 8 de Febrero, 2026  
**Arquitecto:** Senior Database & AI Architecture  
**Sistema:** Academia Crystal - Supabase + Make.com + WhatsApp IA Agent

---

## 📋 RESUMEN EJECUTIVO

### ✅ ESTADO GENERAL: **ARQUITECTURA SÓLIDA - OPTIMIZACIÓN REQUERIDA**

Tu base de datos **YA TIENE** las estructuras principales para soportar un agente de IA conversacional en WhatsApp. Sin embargo, existen **gaps críticos** que deben corregirse para garantizar memoria conversacional robusta y evitar duplicidad.

---

## 🔬 ANÁLISIS DETALLADO POR COMPONENTE

### 1️⃣ TABLA 'LEADS' - ✅ BUENO (Requiere Mejora Menor)

#### ✅ LO QUE ESTÁ BIEN:

```sql
-- Columnas existentes identificadas:
- id (UUID PRIMARY KEY)
- telefono (TEXT) ✅ con UNIQUE INDEX
- nombre, email, interes, canal, estado, notas
- whatsapp_id (VARCHAR 100)
- ultima_interaccion (TIMESTAMPTZ)
- origen_bot (BOOLEAN)
- conversacion_activa (BOOLEAN)
- metadatos_bot (JSONB) ✅✅✅ EXCELENTE
- created_at (TIMESTAMPTZ)
```

**FORTALEZAS:**
- ✅ Restricción UNIQUE en `telefono` (evita duplicados)
- ✅ Campo `metadatos_bot` (JSONB) para info flexible del agente
- ✅ Índices optimizados para búsquedas rápidas
- ✅ Función `upsert_lead_por_telefono()` implementada

#### ⚠️ LO QUE FALTA O DEBE MEJORAR:

1. **Campo telefono es TEXT pero debería ser más restrictivo:**
   ```sql
   -- Actual:
   telefono TEXT UNIQUE
   
   -- Recomendado:
   telefono VARCHAR(20) UNIQUE NOT NULL
   -- + validación de formato E.164: +573001234567
   ```

2. **Falta trigger para actualizar `ultima_interaccion`:**
   ```sql
   -- Debe actualizarse automáticamente cuando el bot interactúa
   CREATE TRIGGER update_ultima_interaccion_lead
   BEFORE UPDATE ON leads
   FOR EACH ROW
   WHEN (NEW.conversacion_activa != OLD.conversacion_activa)
   EXECUTE FUNCTION update_timestamp_ultima_interaccion();
   ```

3. **Campo `whatsapp_id` no es UNIQUE:**
   - Riesgo: Varios leads con el mismo WhatsApp Business ID
   - Solución: `CREATE UNIQUE INDEX idx_leads_whatsapp_id ON leads(whatsapp_id) WHERE whatsapp_id IS NOT NULL;`

4. **Falta columna `contexto_ia` separada de `metadatos_bot`:**
   ```sql
   -- Para guardar resumen de conversación anterior
   ALTER TABLE leads ADD COLUMN contexto_ia TEXT;
   -- Ejemplo: "Preguntó por cejas y pestañas, tiene $300k presupuesto"
   ```

---

### 2️⃣ TABLA 'MESSAGES' / 'WHATSAPP_MENSAJES' - ✅ EXCELENTE

#### ✅ LO QUE ESTÁ BIEN:

```sql
CREATE TABLE whatsapp_mensajes (
    id UUID PRIMARY KEY,
    usuario_id UUID REFERENCES usuarios(id), -- ⚠️ Ver nota abajo
    telefono VARCHAR(20) NOT NULL,
    tipo VARCHAR(50), -- 'inscripcion', 'pago', 'clase'
    mensaje_texto TEXT NOT NULL,
    estado VARCHAR(20), -- 'enviado', 'leído', 'fallido'
    message_id VARCHAR(100), -- ID de WhatsApp API
    metadatos JSONB DEFAULT '{}',
    respuesta_esperada BOOLEAN,
    respuesta_recibida TEXT,
    creado_en TIMESTAMPTZ,
    actualizado_en TIMESTAMPTZ
);

-- Índices:
CREATE INDEX idx_whatsapp_mensajes_telefono ON whatsapp_mensajes(telefono);
CREATE INDEX idx_whatsapp_mensajes_creado_en ON whatsapp_mensajes(creado_en);
```

**FORTALEZAS:**
- ✅ Estructura completa para historial conversacional
- ✅ Campo `mensaje_texto` para contenido
- ✅ Campo `metadatos` (JSONB) para info adicional
- ✅ Índices optimizados para queries de últimos mensajes
- ✅ Campos de tracking (estado, message_id)

#### ❌ PROBLEMAS CRÍTICOS IDENTIFICADOS:

1. **NO HAY CAMPO 'ROLE' (user/assistant):**
   ```sql
   -- ACTUAL (sin role):
   mensaje_texto TEXT -- ¿Quién habló? ¿El user o el bot?
   
   -- REQUERIDO:
   ALTER TABLE whatsapp_mensajes 
   ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user' 
   CHECK (role IN ('user', 'assistant', 'system'));
   ```

2. **NO HAY FOREIGN KEY A 'LEADS':**
   ```sql
   -- Actual:
   usuario_id UUID REFERENCES usuarios(id) -- Esto es para estudiantes matriculados
   
   -- Falta:
   ALTER TABLE whatsapp_mensajes 
   ADD COLUMN lead_id UUID REFERENCES leads(id) ON DELETE CASCADE;
   
   -- Para queries de memoria:
   CREATE INDEX idx_whatsapp_mensajes_lead_id ON whatsapp_mensajes(lead_id);
   ```

3. **TABLA 'WHATSAPP_CONVERSACIONES' ES REDUNDANTE:**
   - Ya tienes toda la info en `leads` (conversacion_activa, ultima_interaccion)
   - Solo está guardando resúmenes que podrían calcularse
   - **RECOMENDACIÓN:** Eliminar esta tabla o convertirla en VISTA materializada

4. **NO HAY LÍMITE DE MENSAJES GUARDADOS:**
   ```sql
   -- Query actual: SELECT * FROM whatsapp_mensajes WHERE telefono = '+57300...'
   -- Problema: Sin LIMIT, puede devolver 10,000 mensajes y saturar el prompt
   
   -- Solución: Crear función especializada:
   CREATE FUNCTION get_historial_conversacion_ia(
       p_telefono VARCHAR(20),
       p_limit INTEGER DEFAULT 10
   ) RETURNS TABLE(...) AS $$
       SELECT * FROM whatsapp_mensajes
       WHERE telefono = p_telefono
       ORDER BY creado_en DESC
       LIMIT p_limit;
   $$;
   ```

---

### 3️⃣ TABLA 'KNOWLEDGE_BASE' / 'CURSOS' - ⚠️ INCOMPLETO

#### ✅ LO QUE ESTÁ BIEN:

```sql
-- Tablas existentes:
CREATE TABLE cursos (
    id SERIAL PRIMARY KEY,
    nombre TEXT,
    descripcion TEXT,
    horario TEXT,
    precio NUMERIC(10,2),
    cupos INTEGER,
    estado TEXT,
    created_at TIMESTAMPTZ
);

CREATE TABLE programas (
    id SERIAL PRIMARY KEY,
    nombre TEXT,
    descripcion TEXT,
    precio NUMERIC(10,2),
    duracion TEXT,
    contenido TEXT,
    requisitos TEXT
);

CREATE TABLE marketing_assets (
    id UUID PRIMARY KEY,
    titulo TEXT,
    descripcion_ia TEXT, -- ✅ EXCELENTE para el agente
    url_archivo TEXT,
    tipo_asset VARCHAR(20),
    keywords TEXT[],
    visible_para_ia BOOLEAN
);
```

**FORTALEZAS:**
- ✅ Información completa de productos/cursos
- ✅ Tabla `marketing_assets` para PDFs/imágenes promocionales
- ✅ Campo `descripcion_ia` optimizado para prompts
- ✅ Vista `vw_cursos_para_ia` ya creada

#### ❌ LO QUE FALTA (CRÍTICO):

1. **NO HAY TABLA 'AI_KNOWLEDGE_BASE' UNIFICADA:**
   ```sql
   -- El agente debe buscar en 3 tablas diferentes:
   - cursos (productos)
   - marketing_assets (flyers)
   - ??? preguntas frecuentes (NO EXISTE)
   
   -- RECOMENDADO: Tabla unificada con embeddings
   CREATE TABLE ai_knowledge_base (
       id UUID PRIMARY KEY,
       tipo VARCHAR(50), -- 'curso', 'faq', 'promo', 'politica'
       contenido TEXT, -- Texto para buscar
       embedding VECTOR(1536), -- ⚠️ Ver nota de pgvector abajo
       metadatos JSONB,
       created_at TIMESTAMPTZ
   );
   ```

2. **NO TIENES 'PGVECTOR' INSTALADO:**
   ```sql
   -- Actual: Búsquedas por palabras clave (limitado)
   SELECT * FROM cursos WHERE nombre ILIKE '%cejas%';
   
   -- Ideal: Búsqueda semántica con embeddings
   -- Requiere: CREATE EXTENSION vector;
   -- Luego: SELECT * FROM ai_knowledge_base 
   --        ORDER BY embedding <-> '[0.1, 0.2, ...]' LIMIT 5;
   ```

3. **FALTA TABLA 'FAQ' (Preguntas Frecuentes):**
   ```sql
   CREATE TABLE faq (
       id SERIAL PRIMARY KEY,
       pregunta TEXT NOT NULL,
       respuesta TEXT NOT NULL,
       categoria VARCHAR(50),
       activo BOOLEAN DEFAULT true,
       prioridad INTEGER DEFAULT 0,
       created_at TIMESTAMPTZ
   );
   
   -- Ejemplos:
   -- "¿Aceptan pagos en cuotas?" -> "Sí, hasta 3 cuotas sin interés"
   -- "¿Incluye materiales?" -> "Sí, todos los cursos incluyen kit completo"
   ```

4. **DATOS DE CURSOS NO OPTIMIZADOS PARA IA:**
   ```sql
   -- Actual:
   cursos.descripcion = "Curso de cejas y pestañas para principiantes"
   
   -- Optimizado para IA:
   ALTER TABLE cursos ADD COLUMN resumen_ia TEXT;
   -- Ejemplo: "Cejas: técnicas microblading, diseño de cejas, lifting de pestañas. 
   --           8 semanas, $350k, próximo inicio: 15-Feb, 12 cupos disponibles"
   ```

---

## 🚨 PROBLEMAS CRÍTICOS A RESOLVER

### 🔴 PRIORIDAD ALTA (Resolver YA):

1. **Agregar campo 'role' a tabla `whatsapp_mensajes`**
   - Sin esto, el agente no sabe quién habló en cada mensaje
   - Impacto: Imposible construir prompt con historial coherente

2. **Agregar Foreign Key `lead_id` a `whatsapp_mensajes`**
   - Sin esto, no hay relación directa entre mensajes y leads
   - Impacto: Queries lentos y complejos (JOIN por telefono en vez de ID)

3. **Crear función `get_historial_conversacion_ia(telefono, limit)`**
   - Sin esto, arriesgas saturar el prompt del agente con 1000+ mensajes
   - Impacto: Costos altos de API (OpenAI) y respuestas lentas

4. **Crear tabla 'FAQ' con respuestas predefinidas**
   - Sin esto, el agente inventa respuestas a preguntas comunes
   - Impacto: Información inconsistente o incorrecta a clientes

### 🟡 PRIORIDAD MEDIA (Resolver en 1 semana):

5. **Instalar extensión 'pgvector' para búsqueda semántica**
   - Sin esto, búsquedas limitadas a palabras exactas
   - Impacto: El agente no encuentra cursos si el cliente usa sinónimos

6. **Eliminar tabla redundante `whatsapp_conversaciones`**
   - Ya tienes toda la info en `leads`
   - Impacto: Mantenimiento duplicado, riesgo de inconsistencias

7. **Agregar campo `contexto_ia` a tabla `leads`**
   - Sin esto, el agente repite preguntas que ya hizo
   - Impacto: Experiencia de usuario pobre (parecer "tonto")

### 🟢 PRIORIDAD BAJA (Nice-to-have):

8. **Crear tabla `ai_responses_cache` para respuestas frecuentes**
9. **Agregar triggers automáticos para actualizar `ultima_interaccion`**
10. **Implementar índices GIN para búsqueda full-text en español**

---

## ✅ RECOMENDACIONES FINALES

### ARQUITECTURA IDEAL PARA TU AGENTE:

```
┌─────────────┐
│   MAKE.COM  │ (Solo webhook relay)
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│  SUPABASE EDGE FUNCTION         │
│  "handle_whatsapp_message"      │
│  ┌──────────────────────────┐   │
│  │ 1. Extraer telefono      │   │
│  │ 2. Buscar/crear lead     │   │
│  │ 3. Obtener historial (10)│   │
│  │ 4. Obtener knowledge     │   │
│  │ 5. Llamar OpenAI         │   │
│  │ 6. Guardar respuesta     │   │
│  │ 7. Enviar a WhatsApp     │   │
│  └──────────────────────────┘   │
└─────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│      TABLAS SUPABASE            │
│  ┌────────────────────────┐     │
│  │ leads                  │     │
│  │ - telefono UNIQUE      │     │
│  │ - metadatos_bot JSONB  │     │
│  │ - contexto_ia TEXT     │     │
│  └────────────────────────┘     │
│  ┌────────────────────────┐     │
│  │ whatsapp_mensajes      │     │
│  │ - lead_id FK           │     │
│  │ - role (user/assistant)│     │
│  │ - mensaje_texto        │     │
│  └────────────────────────┘     │
│  ┌────────────────────────┐     │
│  │ ai_knowledge_base      │     │
│  │ - embedding VECTOR     │     │
│  │ - contenido TEXT       │     │
│  └────────────────────────┘     │
│  ┌────────────────────────┐     │
│  │ faq                    │     │
│  │ - pregunta/respuesta   │     │
│  └────────────────────────┘     │
└─────────────────────────────────┘
```

### PRÓXIMOS PASOS (Orden de ejecución):

1. ✅ **Ejecutar `fix-storage-rls-marketing.sql`** (YA CREADO)
   - Desbloquea upload de archivos en Marketing Center

2. 📝 **Ejecutar el SQL de correcciones** (VER ARCHIVO ADJUNTO)
   - Agrega campo `role` a mensajes
   - Crea tabla `faq`
   - Optimiza índices

3. 🧪 **Crear Supabase Edge Function** en vez de Make.com
   - Toda la lógica del agente en tu backend
   - Make solo como relay de webhooks

4. 🎯 **Instalar pgvector** (opcional pero recomendado)
   - Habilita búsqueda semántica inteligente
   - Requiere plan Pro de Supabase ($25/mes)

---

## 📊 TABLA COMPARATIVA

| Componente | Estado Actual | Estado Ideal | Gap Crítico? |
|------------|---------------|--------------|--------------|
| **leads.telefono UNIQUE** | ✅ Implementado | ✅ OK | No |
| **leads.metadatos_bot JSONB** | ✅ Implementado | ✅ OK | No |
| **leads.contexto_ia** | ❌ No existe | ✅ Requerido | **Sí** |
| **whatsapp_mensajes.role** | ❌ No existe | ✅ Requerido | **Sí** |
| **whatsapp_mensajes.lead_id FK** | ❌ No existe | ✅ Requerido | **Sí** |
| **Función historial limitado** | ❌ No existe | ✅ Requerido | **Sí** |
| **Tabla FAQ** | ❌ No existe | ✅ Requerido | **Sí** |
| **pgvector instalado** | ❌ No existe | ⚠️ Opcional | No |
| **ai_knowledge_base unificada** | ❌ No existe | ⚠️ Opcional | No |

---

## 🛠️ ARCHIVO SQL CORRECTIVO

Voy a generar el archivo `CORREGIR-ARQUITECTURA-IA-2026.sql` con todas las correcciones necesarias.

**Instrucciones:**
1. Ejecutar primero `fix-storage-rls-marketing.sql` (ya existe)
2. Luego ejecutar `CORREGIR-ARQUITECTURA-IA-2026.sql` (generando ahora)
3. Verificar con queries de prueba

---

**¿Necesitas que genere el SQL completo de correcciones ahora?**

