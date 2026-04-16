# 🤖 GUÍA DE INTEGRACIÓN: AGENTE DE IA (DANY) + MAKE.COM

**Fecha:** 7 de Febrero 2026  
**Arquitecto:** Software Senior  
**Propósito:** Integrar agente de IA conversacional con WhatsApp usando Make.com

---

## 📋 TABLA DE CONTENIDOS

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura de la Solución](#arquitectura)
3. [Configuración de Supabase](#configuración-supabase)
4. [Endpoints API para Make.com](#endpoints-api)
5. [Configuración del Bucket de Storage](#storage)
6. [Escenarios de Make.com](#escenarios-make)
7. [Testing y Verificación](#testing)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 RESUMEN EJECUTIVO {#resumen-ejecutivo}

### ¿Qué se implementó?

1. **Tabla LEADS actualizada** con columnas para tracking de WhatsApp
2. **Tabla MARKETING_ASSETS** para almacenar flyers y material promocional
3. **Vista SQL optimizada** para que la IA consulte cursos activos
4. **Funciones Database** para operaciones CRUD desde Make.com
5. **Políticas RLS** configuradas para Service Role Key
6. **Componente React** para administrar el Marketing Center

### Flujo completo:

```
Cliente escribe por WhatsApp
     ↓
Make.com recibe mensaje
     ↓
Consulta Supabase (cursos, material)
     ↓
Envía prompt a IA (ChatGPT/Claude)
     ↓
IA responde con información
     ↓
Make.com guarda conversación en Supabase
     ↓
Responde al cliente por WhatsApp
```

---

## 🏗️ ARQUITECTURA DE LA SOLUCIÓN {#arquitectura}

### Base de Datos (Supabase)

```
┌─────────────────────────────────────────┐
│          SUPABASE DATABASE              │
├─────────────────────────────────────────┤
│                                         │
│  📋 TABLA: leads                        │
│  - telefono (UNIQUE) ← CLAVE PRINCIPAL │
│  - whatsapp_id                         │
│  - conversacion_activa                 │
│  - ultima_interaccion                  │
│  - metadatos_bot (JSONB)               │
│                                         │
│  📁 TABLA: marketing_assets             │
│  - url_archivo (Storage)               │
│  - descripcion_ia                      │
│  - visible_para_ia                     │
│                                         │
│  📊 VISTA: vw_cursos_para_ia            │
│  - resumen_texto_ia                    │
│                                         │
│  🔧 FUNCIONES:                          │
│  - upsert_lead_por_telefono()          │
│  - get_cursos_para_ia_texto()          │
│  - get_marketing_assets_para_ia()      │
│                                         │
└─────────────────────────────────────────┘
```

---

## ⚙️ CONFIGURACIÓN DE SUPABASE {#configuración-supabase}

### Paso 1: Ejecutar Migración SQL

1. Ve a **Supabase Dashboard** → Tu proyecto
2. Navega a **SQL Editor**
3. Abre el archivo: `migrations/2026-02-07-ai-agent-integration.sql`
4. Copia y pega TODO el contenido
5. Click en **RUN**
6. Verifica que aparezca: ✅ "MIGRACIÓN COMPLETADA"

### Paso 2: Crear Bucket de Storage

1. Ve a **Storage** en Supabase
2. Click en **New bucket**
3. Nombre: `marketing`
4. **Public bucket**: ✅ SÍ (marcado)
5. Click **Create bucket**

### Paso 3: Configurar Políticas de Storage

En la configuración del bucket `marketing`, agrega estas políticas:

```sql
-- Lectura pública (para que la IA acceda a URLs)
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'marketing');

-- Escritura solo para admins
CREATE POLICY "Admin upload access"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'marketing' 
    AND auth.role() = 'authenticated'
    AND EXISTS (
        SELECT 1 FROM public.perfiles
        WHERE perfiles.id = auth.uid()
        AND perfiles.rol IN ('admin', 'director', 'administrativo')
    )
);
```

### Paso 4: Obtener Credenciales

1. Ve a **Settings** → **API**
2. Copia estos valores:

```
PROJECT URL: https://[tu-proyecto].supabase.co
ANON KEY: eyJhbGc...  (para frontend)
SERVICE ROLE KEY: eyJhbGc...  (para Make.com) ⚠️ SECRETO
```

---

## 🔌 ENDPOINTS API PARA MAKE.COM {#endpoints-api}

### Headers requeridos (todas las peticiones):

```http
apikey: [TU_SERVICE_ROLE_KEY]
Authorization: Bearer [TU_SERVICE_ROLE_KEY]
Content-Type: application/json
Prefer: return=representation
```

---

### 1️⃣ UPSERT LEAD (Crear o Actualizar)

**Método:** `POST`  
**URL:** `https://[PROJECT].supabase.co/rest/v1/rpc/upsert_lead_por_telefono`

**Body (JSON):**
```json
{
  "p_telefono": "+573001234567",
  "p_nombre": "María Gómez",
  "p_email": "maria@example.com",
  "p_interes": "Manicure Profesional",
  "p_canal": "WhatsApp",
  "p_estado": "nuevo",
  "p_notas": "Contactó vía bot. Interesada en horarios nocturnos.",
  "p_whatsapp_id": "whatsapp:+573001234567",
  "p_metadatos_bot": {
    "sesion_id": "abc123",
    "idioma": "es",
    "ultima_pregunta": "¿Cuánto cuesta el curso?"
  }
}
```

**Respuesta (200 OK):**
```json
[
  {
    "id": "uuid-123...",
    "nombre": "María Gómez",
    "telefono": "+573001234567",
    "email": "maria@example.com",
    "interes": "Manicure Profesional",
    "canal": "WhatsApp",
    "estado": "nuevo",
    "notas": "Contactó vía bot...",
    "whatsapp_id": "whatsapp:+573001234567",
    "origen_bot": true,
    "conversacion_activa": true,
    "ultima_interaccion": "2026-02-07T10:30:00Z",
    "created_at": "2026-02-07T10:30:00Z"
  }
]
```

**Comportamiento:**
- Si el teléfono **NO existe** → Crea un nuevo lead
- Si el teléfono **YA existe** → Actualiza datos y agrega notas

---

### 2️⃣ OBTENER CURSOS PARA IA (Texto Plano)

**Método:** `POST`  
**URL:** `https://[PROJECT].supabase.co/rest/v1/rpc/get_cursos_para_ia_texto`

**Body:** `{}`

**Respuesta (200 OK):**
```json
[
  {
    "resumen_texto": "Curso: Manicure Profesional | Programa: Belleza Integral | Profesor: Ana López | Horario: Lunes y Miércoles 6-9pm | Cupos disponibles: 8 | Precio: $450,000 | Estado: activo | Inicio: 15/02/2026\n\nCurso: Pedicure Spa | Programa: Belleza Integral | Profesor: Carlos Ruiz | Horario: Martes y Jueves 2-5pm | Cupos disponibles: 12 | Precio: $380,000 | Estado: activo | Inicio: 20/02/2026"
  }
]
```

**Uso en Make.com:**
Extrae `resumen_texto` y úsalo en el prompt de la IA:

```
Eres Dany, asistente virtual de Academia Crystal.

Información de cursos disponibles:
{{resumen_texto}}

Usuario preguntó: "{{mensaje_whatsapp}}"

Responde de forma amigable y profesional.
```

---

### 3️⃣ BUSCAR MATERIAL DE MARKETING

**Método:** `POST`  
**URL:** `https://[PROJECT].supabase.co/rest/v1/rpc/get_marketing_assets_para_ia`

**Body (JSON):**
```json
{
  "p_programa": "Manicure",
  "p_keyword": "promoción"
}
```

**Respuesta (200 OK):**
```json
[
  {
    "id": "uuid-456...",
    "titulo": "Flyer Promo Manicure Feb 2026",
    "descripcion_ia": "Promoción de manicure con 20% descuento válida hasta fin de mes",
    "url_archivo": "https://[project].supabase.co/storage/v1/object/public/marketing/12345.jpg",
    "tipo_asset": "flyer"
  }
]
```

**Uso:** La IA puede mencionar: "Tenemos una promoción especial..." y enviar la URL del flyer.

---

### 4️⃣ CONSULTAR LEAD POR TELÉFONO

**Método:** `GET`  
**URL:** `https://[PROJECT].supabase.co/rest/v1/leads?telefono=eq.+573001234567&select=*`

**Respuesta (200 OK):**
```json
[
  {
    "id": "uuid-789...",
    "nombre": "Pedro Sánchez",
    "telefono": "+573001234567",
    "email": "pedro@example.com",
    "interes": "Pedicure",
    "conversacion_activa": true,
    "ultima_interaccion": "2026-02-07T09:15:00Z"
  }
]
```

---

## 🗄️ CONFIGURACIÓN DEL BUCKET DE STORAGE {#storage}

### Estructura de carpetas recomendada:

```
marketing/
├── flyers/
│   ├── 2026-02-promo-manicure.jpg
│   └── 2026-02-descuento-pedicure.png
├── pdfs/
│   ├── programa-belleza-integral.pdf
│   └── horarios-febrero.pdf
├── videos/
│   └── tour-academia.mp4
└── documentos/
    └── requisitos-inscripcion.pdf
```

### Subir archivos desde el componente React:

1. Ve a `/marketing-center` en tu aplicación
2. Click en **Nuevo Asset**
3. Rellena el formulario:
   - **Título**: Descriptivo
   - **Descripción para IA**: ⚠️ MUY IMPORTANTE - La IA usa esto para saber cuándo compartir el material
   - **Tipo**: Selecciona (flyer, pdf, imagen, etc.)
   - **Archivo**: Selecciona desde tu PC
   - **Visible para IA**: Activado (switch)
4. Click **Crear**

---

## 🔄 ESCENARIOS DE MAKE.COM {#escenarios-make}

### Escenario 1: RECIBIR MENSAJE DE WHATSAPP

**Módulos:**
1. **Webhook** - Escucha mensajes entrantes
2. **HTTP Request** - Buscar lead en Supabase
3. **Router** - ¿Lead existe?
   - **Ruta A (SÍ):** Usar datos existentes
   - **Ruta B (NO):** Crear nuevo lead
4. **HTTP Request** - Obtener cursos
5. **HTTP Request** - Obtener marketing assets (opcional)
6. **OpenAI/Claude** - Generar respuesta
7. **HTTP Request** - Upsert lead con nueva info
8. **WhatsApp Send Message** - Responder al cliente

### Escenario 2: GUARDAR CONVERSACIÓN

Cada vez que el bot responde, guarda en `metadatos_bot`:

```json
{
  "conversacion": [
    {"role": "user", "content": "¿Cuánto cuesta el curso?", "timestamp": "..."},
    {"role": "assistant", "content": "El curso cuesta $450,000", "timestamp": "..."}
  ],
  "interes_detectado": "Manicure",
  "temperatura": 0.7
}
```

### Escenario 3: ENVIAR MATERIAL

Cuando la IA detecta que debe enviar un flyer:

1. Buscar en `marketing_assets` con keyword
2. Extraer `url_archivo`
3. Enviar mensaje de WhatsApp con imagen/pdf adjunto

---

## 🧪 TESTING Y VERIFICACIÓN {#testing}

### Test 1: Verificar migración

```sql
-- En Supabase SQL Editor
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'leads'
ORDER BY ordinal_position;

-- Debe mostrar: telefono, whatsapp_id, conversacion_activa, etc.
```

### Test 2: Probar función upsert

```sql
SELECT * FROM upsert_lead_por_telefono(
    p_telefono := '+573001234567',
    p_nombre := 'Test Bot',
    p_email := 'test@bot.com',
    p_interes := 'Manicure',
    p_notas := 'Prueba desde SQL'
);
```

### Test 3: Obtener cursos

```sql
SELECT * FROM get_cursos_para_ia_texto();
```

### Test 4: Probar endpoint desde Make.com

En Make, crea un módulo **HTTP Request**:
- URL: `https://[project].supabase.co/rest/v1/rpc/get_cursos_para_ia_texto`
- Method: POST
- Headers:
  ```
  apikey: [SERVICE_KEY]
  Authorization: Bearer [SERVICE_KEY]
  Content-Type: application/json
  ```
- Body: `{}`

---

## 🐛 TROUBLESHOOTING {#troubleshooting}

### Error: "relation leads does not exist"

**Causa:** La tabla leads no existe en tu base de datos.

**Solución:**
```sql
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    telefono VARCHAR(20),
    email TEXT,
    interes TEXT,
    canal TEXT DEFAULT 'WhatsApp',
    estado TEXT DEFAULT 'nuevo',
    notas TEXT,
    whatsapp_id VARCHAR(100),
    origen_bot BOOLEAN DEFAULT false,
    conversacion_activa BOOLEAN DEFAULT false,
    ultima_interaccion TIMESTAMPTZ DEFAULT NOW(),
    metadatos_bot JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Error: "permission denied for function"

**Causa:** Service Role Key no tiene permisos.

**Solución:**
```sql
GRANT EXECUTE ON FUNCTION upsert_lead_por_telefono TO service_role;
GRANT EXECUTE ON FUNCTION get_cursos_para_ia_texto TO service_role;
GRANT EXECUTE ON FUNCTION get_marketing_assets_para_ia TO service_role;
```

### Error: "duplicate key value violates unique constraint"

**Causa:** Intentas insertar un teléfono que ya existe.

**Solución:** Usa la función `upsert_lead_por_telefono()` en lugar de INSERT directo.

### Error 401: "JWT expired"

**Causa:** Estás usando Anon Key en lugar de Service Role Key.

**Solución:** Verifica que usas el **Service Role Key** en Make.com, no el Anon Key.

---

## 📊 MÉTRICAS Y MONITOREO

### Queries útiles para analítica:

```sql
-- Leads creados por el bot hoy
SELECT COUNT(*) FROM leads
WHERE origen_bot = true
AND DATE(created_at) = CURRENT_DATE;

-- Conversaciones activas
SELECT COUNT(*) FROM leads
WHERE conversacion_activa = true;

-- Temas más consultados
SELECT interes, COUNT(*) as total
FROM leads
WHERE origen_bot = true
GROUP BY interes
ORDER BY total DESC
LIMIT 10;

-- Assets más compartidos (requiere logging adicional)
SELECT titulo, tipo_asset, COUNT(*) as visualizaciones
FROM marketing_assets
WHERE visible_para_ia = true
GROUP BY titulo, tipo_asset
ORDER BY visualizaciones DESC;
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [ ] Ejecutar migración SQL en Supabase
- [ ] Crear bucket `marketing` en Storage
- [ ] Configurar políticas de Storage
- [ ] Obtener Service Role Key
- [ ] Crear escenario en Make.com con Webhook
- [ ] Configurar módulos HTTP para Supabase
- [ ] Integrar con OpenAI/Claude
- [ ] Probar flujo completo con teléfono de prueba
- [ ] Subir primeros assets en Marketing Center
- [ ] Configurar respuestas automáticas
- [ ] Monitorear logs en Make.com
- [ ] Revisar leads creados en Supabase

---

## 🎓 PROMPT SUGERIDO PARA LA IA

```
Eres Dany, la asistente virtual de Academia Crystal Daniela, una institución educativa especializada en belleza y estética.

Tu personalidad:
- Amable, profesional y cercana
- Respondes en español colombiano
- Usas emojis con moderación
- Eres paciente y clara

Información de cursos disponibles:
{{cursos_texto}}

Instrucciones:
1. Saluda cordialmente si es la primera interacción
2. Responde preguntas sobre cursos, horarios, precios
3. Si te preguntan por promociones, busca en los assets de marketing
4. Si detectas interés serio, menciona que un asesor se contactará pronto
5. Si no sabes algo, sé honesta y ofrece contactar a un humano
6. Mantén respuestas cortas (máximo 3 párrafos)

Información de usuario:
- Nombre: {{nombre_lead}}
- Interés previo: {{interes_lead}}
- Última interacción: {{ultima_interaccion}}

Mensaje del usuario:
{{mensaje_whatsapp}}

Responde de forma natural y útil.
```

---

## 📞 SOPORTE

Si tienes dudas sobre la implementación:
1. Revisa los logs de Make.com
2. Verifica la pestaña "Logs" en Supabase
3. Consulta la documentación de Supabase: https://supabase.com/docs

---

**Última actualización:** 7 de Febrero 2026  
**Versión:** 1.0
