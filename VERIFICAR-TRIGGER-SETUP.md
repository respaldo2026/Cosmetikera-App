# ✅ Verificación del Trigger y Setup de Auth

## Problema reportado:
- Error 500 en `/api/auth/create-user`
- Error 400 en login "Invalid login credentials"
- Warning de Ant Design message

## Lo que arreglamos:
1. ✅ Cambié la API para usar `signUp` en lugar de `admin.createUser` (no requiere SERVICE_KEY)
2. ✅ Cambiamos el flujo: primero crea en Auth, luego el trigger auto-crea en perfiles
3. ✅ Arreglamos el warning de message usando `App.useApp()`
4. ✅ Aumentamos memoria a 6GB y limpiamos caché

## ⚠️ Pasos CRÍTICOS para verificar en Supabase:

### 1. Verificar que el Trigger existe:
```sql
-- Ejecuta esto en Supabase SQL Editor
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```
Si devuelve cero filas, el trigger NO existe.

### 2. Si el trigger NO existe, crea esto:
```sql
-- Crear función para manejar nuevo usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.perfiles (
    id,
    email,
    nombre_completo,
    rol,
    activo
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.user_metadata->>'nombre_completo', NEW.email),
    COALESCE(NEW.user_metadata->>'rol', 'estudiante'),
    true
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 3. Verificar que la tabla perfiles existe:
```sql
SELECT * FROM information_schema.tables WHERE table_name = 'perfiles';
```

### 4. Después de verificar, intenta crear un nuevo admin:
- Ve a `/configuracion/administradores`
- Crea un usuario con email: `test@example.com`
- Contraseña será generada de la cédula (sin puntos)

### 5. Si SIGUE fallando el login:
- Verifica que `auth.users` tiene el usuario creado
- Verifica que `public.perfiles` tiene la fila
- Comprueba que los emails coinciden

## Servidor Next.js:
- Ya está corriendo con 6GB de memoria
- Si necesitas reiniciar: `npm run dev`
- Puerto: http://localhost:3001

## Próximos pasos:
1. ✅ Verificar el trigger en Supabase
2. ✅ Probar creación de admin
3. ✅ Probar login

¡Avísame si necesitas ayuda con cualquiera de estos pasos!
