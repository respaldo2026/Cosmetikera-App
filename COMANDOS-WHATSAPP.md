# 🛠️ Comandos Útiles para WhatsApp Templates

## 📋 Verificación de Estado

### Ver todos los templates en Meta
```bash
npm run templates:listar
```

**Qué muestra:**
- Lista completa de templates
- Estado de cada uno (APPROVED, PENDING_REVIEW, REJECTED)
- Categoría y idioma
- Razones de rechazo (si aplica)

**Cuándo usar:**
- Después de 24-48h para verificar aprobación
- Al depurar problemas de envío
- Para confirmar que los templates existen

---

## 🧪 Pruebas Manuales

### Probar envío de template (cuando estén APPROVED)
```bash
# Formato básico
npm run templates:probar <telefono> <nombre_template> [variables...]

# Ejemplos prácticos
npm run templates:probar "573000000757" "inscripcion_confirmada" "Juan Pérez" "Curso Python"
npm run templates:probar "573000000757" "recordatorio_pago" "Juan" "50000" "15 enero"
npm run templates:probar "573000000757" "bienvenida_nuevo_estudiante" "María González"
```

**Cuándo usar:**
- Después de que Meta apruebe los templates (24-48h)
- Para probar manualmente antes de usar en producción
- Al depurar problemas de envío

**Nota:** Reemplaza `573000000757` con el número de prueba real (sin espacios ni guiones).

---

## 🏗️ Crear Templates (Si Necesitas Crearlos Nuevamente)

### Crear todos los templates
```bash
npm run templates:crear
```

**Qué hace:**
- Crea los 7 templates en Meta Business Manager
- Los templates quedan en estado PENDING_REVIEW
- Espera aprobación de Meta (24-48h)

**Cuándo NO usar:**
- ❌ Si los templates ya existen (da error "Ya existe contenido en este idioma")
- ❌ Si solo quieres probarlos (usa `templates:probar` en su lugar)

**Cuándo SÍ usar:**
- ✅ Primera vez configurando la app
- ✅ Después de borrar todos los templates en Meta
- ✅ Si cambias el idioma o estructura de templates

---

## 🔍 Validar Configuración

### Validar token y credenciales
```bash
npm run validar:config
```

**Qué valida:**
- Token de acceso válido
- WABA_ID correcto
- Permisos suficientes
- Acceso a la API de Meta

**Cuándo usar:**
- Al configurar la app por primera vez
- Cuando cambias el token de acceso
- Si obtienes errores de autenticación

---

## 📦 Desarrollo Normal

### Iniciar servidor de desarrollo
```bash
npm run dev
```

**Puerto:** http://localhost:3001  
**Hot reload:** Activado

### Build de producción
```bash
npm run build
```

### Iniciar producción
```bash
npm run start
```

---

## 🚀 Flujo de Trabajo Completo (Primera Vez)

```bash
# 1. Validar configuración
npm run validar:config

# 2. Crear templates (si no existen)
npm run templates:crear

# 3. Esperar 24-48h

# 4. Verificar aprobación
npm run templates:listar

# 5. Probar envío manual
npm run templates:probar "573000000757" "inscripcion_confirmada" "Juan" "Python"

# 6. Iniciar app
npm run dev
```

---

## 📝 Notas Importantes

### Estados de Templates

| Estado | Significa | Qué hacer |
|--------|-----------|-----------|
| **APPROVED** | ✅ Listo para enviar | Nada, ya funciona |
| **PENDING_REVIEW** | ⏳ En revisión (24-48h) | Esperar |
| **REJECTED** | ❌ Meta lo rechazó | Ver razón, corregir y recrear |

### Variables en Templates

Cada template espera ciertas variables **en orden**:

```javascript
// inscripcion_confirmada
[nombreEstudiante, nombreCurso]

// recordatorio_pago
[nombre, monto, fechaLimite, curso]

// pago_recibido
[nombre, monto, curso]

// bienvenida_nuevo_estudiante
[nombreEstudiante]

// recordatorio_clase
[nombreEstudiante, nombreCurso, fecha, hora]

// certificado_disponible
[nombreEstudiante, nombreCurso]

// formulario_interes (marketing)
[nombre, cursosDeInteres]
```

### Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| "Ya existe contenido en este idioma" | Templates ya creados | ✅ Perfecto, solo lista con `templates:listar` |
| "Template not found" | Aún no aprobado | Espera 24-48h o verifica con `templates:listar` |
| "Invalid access token" | Token expirado | Genera nuevo token en Meta Dashboard |
| "Parameter validation failed" | Variables incorrectas | Verifica orden y cantidad de variables |

---

## 🎯 Resumen de Scripts

| Comando | Propósito | Frecuencia |
|---------|-----------|------------|
| `npm run dev` | Desarrollo | Siempre |
| `npm run templates:listar` | Ver estado templates | Ocasional |
| `npm run templates:probar` | Prueba manual | Ocasional |
| `npm run templates:crear` | Crear templates | Una vez |
| `npm run validar:config` | Validar config | Ocasional |

---

## 📚 Referencias

- [Meta WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Message Templates Guide](https://developers.facebook.com/docs/whatsapp/message-templates)
- [Estado actual: ESTADO-FINAL-WHATSAPP-TEMPLATES.md](./ESTADO-FINAL-WHATSAPP-TEMPLATES.md)

