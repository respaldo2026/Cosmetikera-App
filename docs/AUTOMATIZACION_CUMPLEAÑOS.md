# Automatización: Recordatorios de Cumpleaños 🎂

## Resumen

Envía mensajes de WhatsApp automáticos a clientes en **3 momentos diferentes**:
- **-2 días**: Previa del cumpleaños próximo
- **-1 día**: Última oportunidad de beneficios
- **0 (hoy)**: ¡Feliz cumpleaños! con descuento activado

Cada mensaje es **transaccional** (cumple normas Meta) y recuerda descuentos/beneficios.

---

## Componentes Creados

### 1. **Plantillas de WhatsApp** (Supabase)
Tres nuevas plantillas transaccionales en `plantillas_whatsapp`:

```sql
-- Plantilla 1: 2 días antes
'cumpleaños_recordatorio_2d_es'
"Tu cumpleaños se acerca 🎂
En 2 días activaremos tu descuento..."

-- Plantilla 2: 1 día antes  
'cumpleaños_recordatorio_1d_es'
"¡Casi es tu día! 🎂
Mañana se activa tu descuento..."

-- Plantilla 3: Día del cumpleaños
'cumpleaños_celebracion_es'
"¡Feliz cumpleaños! 🎂🎉
Hoy es tu día especial..."
```

### 2. **Tabla de Auditoría**
`cumpleaños_notificaciones` - Rastrea qué mensajes se enviaron:
```sql
perfil_id, año_celebracion,
enviado_2d_antes, fecha_2d_antes,
enviado_1d_antes, fecha_1d_antes,
enviado_dia_cumple, fecha_dia_cumple
```

Evita duplicados: `UNIQUE(perfil_id, año_celebracion)`

### 3. **Función SQL**
`get_clientes_cumpleaños_proximos(dias_offset)`
- Busca clientes con cumpleaños en días específicos (-2, -1, 0)
- Usado por el endpoint para obtener destinatarios

### 4. **Endpoint API**
**POST `/api/whatsapp/send-birthday-reminder`**

**Autenticación:**
- Header `x-api-key` = `WHATSAPP_API_KEY`
- O sesión autenticada

**Payload:**
```json
{
  "dias_offset": -2,  // -2 | -1 | 0
  "dry_run": false    // true = simular sin enviar
}
```

**Response:**
```json
{
  "success": true,
  "message": "Recordatorios de cumpleaños enviados para en 2 día(s)",
  "enviados": 5,
  "fallidos": 0,
  "detalles": [
    {
      "perfil_id": "uuid",
      "nombre": "María García",
      "resultado": "éxito"
    }
  ]
}
```

---

## Cómo Automatizar (Ejecutar Diariamente)

### Opción 1: Make.com (Recomendado)

1. **Crear 3 escenarios separados** en Make.com:

**Escenario 1: Recordatorio -2 días**
- **Trigger**: Diariamente (Schedule)
- **Acción**: HTTP POST
- **URL**: `https://app.cosmetikera.com/api/whatsapp/send-birthday-reminder`
- **Headers**: `x-api-key: {WHATSAPP_API_KEY}`
- **Body**:
  ```json
  {
    "dias_offset": -2,
    "dry_run": false
  }
  ```

**Escenario 2: Recordatorio -1 día**
- Mismo setup, pero `"dias_offset": -1`

**Escenario 3: ¡Feliz Cumpleaños! (hoy)**
- Mismo setup, pero `"dias_offset": 0`

2. **Configurar horario**:
   - Ejecutar a las **06:00 AM** (antes de que se despiertan los clientes)
   - Timezone: Colombia (UTC-5)

---

### Opción 2: Supabase Edge Function + Cron (Avanzado)

1. Crear Edge Function que llame al endpoint
2. Configurar Supabase Cron para ejecutarla

---

## Pruebas

### Test 1: Dry Run (simular sin enviar)
```bash
curl -X POST http://localhost:3000/api/whatsapp/send-birthday-reminder \
  -H "x-api-key: tu-api-key" \
  -H "Content-Type: application/json" \
  -d '{"dias_offset": -2, "dry_run": true}'
```

**Respuesta:**
```json
{
  "success": true,
  "message": "[DRY RUN] Recordatorios de cumpleaños enviados para en 2 día(s)",
  "enviados": 3,
  "fallidos": 0
}
```

### Test 2: Envío Real
```bash
curl -X POST http://localhost:3000/api/whatsapp/send-birthday-reminder \
  -H "x-api-key: tu-api-key" \
  -H "Content-Type: application/json" \
  -d '{"dias_offset": -2, "dry_run": false}'
```

---

## Requisitos Previos

✅ Cliente debe tener:
- Fecha de nacimiento en `perfiles.fecha_nacimiento`
- Teléfono en `perfiles.telefono`
- Rol `cliente` (o NULL)

✅ Plantillas creadas en Meta Business Manager:
- `cumpleaños_recordatorio_2d_es`
- `cumpleaños_recordatorio_1d_es`
- `cumpleaños_celebracion_es`

---

## Monitoreo

### Ver notificaciones enviadas:
```sql
SELECT 
  cn.perfil_id,
  p.nombre_completo,
  cn.año_celebracion,
  cn.enviado_2d_antes,
  cn.fecha_2d_antes,
  cn.enviado_1d_antes,
  cn.fecha_1d_antes,
  cn.enviado_dia_cumple,
  cn.fecha_dia_cumple
FROM cumpleaños_notificaciones cn
JOIN perfiles p ON cn.perfil_id = p.id
WHERE cn.año_celebracion = EXTRACT(YEAR FROM CURRENT_DATE)
ORDER BY cn.updated_at DESC;
```

### Ver próximos cumpleaños (-2 días):
```sql
SELECT * FROM get_clientes_cumpleaños_proximos(-2);
```

---

## Próximos Pasos

1. ✅ Migraciones SQL creadas
2. ✅ Endpoint API creado
3. ⏳ **Crear 3 plantillas en Meta Business Manager**
   - `cumpleaños_recordatorio_2d_es`
   - `cumpleaños_recordatorio_1d_es`
   - `cumpleaños_celebracion_es`
4. ⏳ **Ejecutar migraciones SQL** en Supabase dashboard
5. ⏳ **Configurar 3 escenarios en Make.com** (uno por cada día)
6. ⏳ **Testing** con clientes de prueba
7. ⏳ **Deploy a producción**

---

**Creado:** 28 de abril de 2026
**Versión:** 1.0
**Normas:** ✅ Cumple políticas de Meta para mensajes transaccionales
