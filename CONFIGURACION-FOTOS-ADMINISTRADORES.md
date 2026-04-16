# 📸 Configuración de Carga de Fotos para Administradores

## ¿Qué se implementó?

Se ha habilitado la funcionalidad para que los administradores puedan:
1. ✅ Subir fotos de perfil al crear un nuevo administrador
2. ✅ Cambiar/actualizar fotos al editar un administrador existente
3. ✅ Ver previsualizaciones de las fotos

## 🔧 Requisitos de Configuración en Supabase

Necesitas crear un **Storage Bucket** llamado `fotos` en Supabase:

### Paso 1: Crear el Bucket

1. Abre tu dashboard de Supabase
2. Ve a **Storage** (en el menú lateral izquierdo)
3. Haz clic en **Create a new bucket**
4. Configura:
   - **Name:** `fotos`
   - **Public bucket:** ✅ Sí (para que las imágenes sean públicas)
   - **File size limit:** 5 MB
5. Haz clic en **Create bucket**

### Paso 2: Configurar Políticas RLS (Opcional pero Recomendado)

Para mayor seguridad, configura permisos en el bucket:

```sql
-- Para ver el bucket desde la consola SQL de Supabase
SELECT * FROM storage.buckets WHERE name = 'fotos';

-- Configura permisos (si usas auth_uid)
-- Los usuarios pueden subir sus propias fotos
```

### Paso 3: Verificar Funcionamiento

1. Ve a la página de Administradores (Configuración > Administradores)
2. Haz clic en "Nuevo Administrador"
3. Llena los datos básicos
4. Haz clic en "Subir Foto" y selecciona una imagen
5. La foto debe cargarse y mostrar un preview
6. Cuando guardes, la foto se guardará en Supabase Storage

## 📋 Información Técnica

### Ubicación en la App

- **Archivo:** `src/app/configuracion/administradores/page.tsx`
- **Componentes utilizados:**
  - `Upload` (Ant Design) - Para la carga de archivos
  - `Avatar` - Para mostrar preview
  - `Supabase Storage Client` - Para guardar en la nube

### Validaciones Implementadas

✅ Tamaño máximo: 5 MB
✅ Formatos soportados: Cualquier imagen (JPG, PNG, WebP, etc.)
✅ Nombres únicos: Evita conflictos con timestamp
✅ Rutas organizadas: `/administradores/` en el bucket

### Flujo de Almacenamiento

```
Usuario selecciona foto
    ↓
Validación de tamaño (max 5MB)
    ↓
Subida a Supabase Storage → /fotos/administradores/{nombre_unico}.{ext}
    ↓
Obtención de URL pública
    ↓
Guardado de URL en tabla perfiles.foto_url
    ↓
Muestra preview en formulario
```

## 🎨 Campos de Base de Datos

La tabla `perfiles` debe tener la columna `foto_url` (tipo: `text`):

```sql
-- Esta columna ya debería existir, pero si no:
ALTER TABLE perfiles ADD COLUMN foto_url TEXT NULL;

-- Crear índice para optimizar búsquedas
CREATE INDEX idx_perfiles_foto_url ON perfiles(foto_url);
```

## 🔐 Seguridad

- Las imágenes se almacenan en un bucket separado
- URLs públicas se generan automáticamente
- Los nombres de archivo incluyen timestamp para evitar sobrescrituras
- Validación de tamaño en frontend (máximo 5MB)

## 📱 Uso en Creación vs Edición

### Crear Administrador
```
1. Llenar datos (nombre, email, cédula)
2. Click en "Subir Foto"
3. Seleccionar imagen
4. Ver preview
5. Click en "Crear Administrador"
```

### Editar Administrador
```
1. Click en el menú (⋮) → Editar Perfil
2. Se abre modal con datos actuales
3. Click en "Cambiar Foto" para actualizar
4. Ver preview de nueva foto
5. Click en "Actualizar" para guardar
```

## 🚀 Próximas Mejoras Opcionales

- [ ] Captura de foto con cámara (usando WebRTC)
- [ ] Crop/redimensionamiento de imagen
- [ ] Compresión automática de imágenes
- [ ] Múltiples formatos (PNG, WebP, AVIF)
- [ ] Galería de avatares predefinidos

## 🐛 Solución de Problemas

### "Error al cargar la foto"
- Verifica que el bucket `fotos` está creado en Supabase
- Verifica que el bucket está marcado como **Public**
- Verifica que las variables de entorno están correctas

### Las fotos no aparecen después de guardar
- Revisa que `foto_url` está siendo guardado en la BD
- Verifica que la URL es válida en el navegador
- Comprueba que CORS está habilitado en Supabase

### "La imagen no debe exceder 5MB"
- Selecciona un archivo más pequeño
- Comprime la imagen antes de subir
- Usa formato WebP que ocupa menos

## 📞 Comandos SQL Útiles

```sql
-- Ver todas las fotos subidas
SELECT id, nombre_completo, email, foto_url FROM perfiles WHERE rol = 'admin' AND foto_url IS NOT NULL;

-- Limpiar fotos nulas
SELECT COUNT(*) FROM perfiles WHERE foto_url IS NULL AND rol = 'admin';

-- Ver tamaño de bucket (si Supabase lo permite)
SELECT * FROM storage.objects WHERE bucket_id = (SELECT id FROM storage.buckets WHERE name = 'fotos');
```

---

**¡La funcionalidad está lista! Solo necesitas crear el bucket `fotos` en Supabase.** 🎉
