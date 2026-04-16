# 🎁 Instrucciones para Activar el Sistema de Entrega de Materiales

## ✅ Paso 1: Ejecutar la Migración en Supabase

1. **Abre Supabase Dashboard** en tu navegador
2. Ve a **SQL Editor**
3. Abre el archivo `migration-entregas-materiales.sql` de este proyecto
4. **Copia TODO el contenido** del archivo
5. **Pega** en el SQL Editor de Supabase
6. Haz clic en **RUN** para ejecutar la migración

### ¿Qué se creará?

- ✅ Tabla `entregas_materiales` para registrar camisetas y kits
- ✅ Índices para mejorar performance
- ✅ Políticas RLS (Row Level Security) para proteger los datos
- ✅ Vista `v_entregas_materiales_completa` con información completa
- ✅ Función `obtener_resumen_entregas()` para resúmenes rápidos
- ✅ Trigger para actualizar `updated_at` automáticamente

---

## ✅ Paso 2: Verificar la Instalación

Después de ejecutar la migración, ejecuta esta consulta SQL para verificar:

\`\`\`sql
-- Verificar que la tabla existe
SELECT 'Tabla entregas_materiales creada correctamente' as status
FROM entregas_materiales
LIMIT 0;

-- Verificar que la vista existe
SELECT 'Vista v_entregas_materiales_completa creada correctamente' as status
FROM v_entregas_materiales_completa
LIMIT 0;

-- Verificar que la función existe
SELECT obtener_resumen_entregas('00000000-0000-0000-0000-000000000000') as resumen;
\`\`\`

Si no hay errores, ¡todo está listo! ✅

---

## ✅ Paso 3: Probar el Sistema

### 🧑‍🏫 Como Profesor:

1. Inicia sesión con una cuenta de profesor
2. Ve a **Mi Oficina** → Haz clic en **"Gestionar Clase"** en un curso
3. En la lista de estudiantes, verás un botón 🎁 (regalo) junto a cada estudiante
4. Haz clic en el botón 🎁 para abrir el modal de entrega
5. Llena el formulario:
   - **Tipo de Material**: Camiseta o Kit
   - Si es **Camiseta**: selecciona la talla (S, M, L, XL, XXL)
   - Si es **Kit**: indica el mes/ciclo (Enero, Febrero, etc.)
   - **Descripción**: ej. "Camiseta blanca con logo"
   - **Fecha de Entrega**: fecha actual por defecto
   - **Observaciones**: cualquier nota adicional (opcional)
6. Haz clic en **"Registrar Entrega"**
7. Verás el historial de entregas del estudiante en la tabla de abajo

### 👨‍💼 Como Administrador:

1. Ve a **Estudiantes** → Haz clic en un estudiante
2. En el perfil del estudiante, verás una nueva pestaña **"📦 Materiales Entregados"**
3. Ahí puedes ver todo el historial de entregas del estudiante

### 🎓 Como Estudiante:

1. Inicia sesión con una cuenta de estudiante
2. Ve al **Portal del Estudiante**
3. Haz clic en la pestaña **"📦 Materiales"**
4. Verás tu historial de entregas con:
   - ✅ Si ya recibiste tu camiseta
   - 📦 Cuántos kits has recibido
   - 📅 Fecha del último kit recibido
   - Tabla completa con todos los detalles

---

## 📊 Campos de la Tabla `entregas_materiales`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único |
| `estudiante_id` | UUID | ID del estudiante (FK a perfiles) |
| `tipo_material` | VARCHAR | "camiseta" o "kit" |
| `descripcion` | TEXT | Descripción del material |
| `talla` | VARCHAR | Talla (solo para camisetas): S, M, L, XL, XXL |
| `mes_ciclo` | VARCHAR | Mes/ciclo (solo para kits): Enero, Febrero, etc. |
| `fecha_entrega` | DATE | Fecha en que se entregó |
| `entregado_por` | UUID | ID del profesor/admin que entregó (FK a perfiles) |
| `observaciones` | TEXT | Notas adicionales (opcional) |
| `created_at` | TIMESTAMP | Fecha de creación del registro |
| `updated_at` | TIMESTAMP | Fecha de última actualización |

---

## 🔒 Permisos (RLS)

- **SELECT (Ver)**: Todos los usuarios autenticados pueden ver entregas
- **INSERT (Crear)**: Solo profesores y administradores pueden registrar entregas
- **UPDATE (Editar)**: Solo quien entregó o los administradores pueden editar
- **DELETE (Eliminar)**: Solo administradores pueden eliminar

---

## 🎯 Resumen de la Integración Completada

### ✅ Frontend
- [x] Modal de entrega integrado en `/mi-oficina` (oficina del profesor)
- [x] Historial de entregas en `/estudiantes/show/[id]` (perfil del estudiante)
- [x] Historial de entregas en `/portal-estudiante` (portal del estudiante)

### ✅ Backend
- [x] Tabla `entregas_materiales` creada (pendiente ejecutar migración)
- [x] Vista `v_entregas_materiales_completa` para consultas
- [x] Función `obtener_resumen_entregas()` para resúmenes
- [x] Políticas RLS configuradas
- [x] Trigger para `updated_at` automático

### ✅ Componentes
- [x] `EntregaMaterialModal` - Modal para registrar entregas
- [x] `HistorialEntregas` - Tabla para ver historial con resumen

---

## 🚀 ¡Todo Listo!

Después de ejecutar la migración en Supabase, el sistema estará completamente funcional. Los profesores podrán registrar entregas desde su oficina, y tanto administradores como estudiantes podrán ver el historial completo de materiales entregados.

**Nota**: Si encuentras algún error, revisa:
1. Que la migración se ejecutó sin errores
2. Que las políticas RLS están activas
3. Que el rol del usuario tiene los permisos correctos

---

**¿Necesitas ayuda?** Revisa el archivo `SISTEMA-ENTREGAS-MATERIALES.md` para más detalles técnicos.
