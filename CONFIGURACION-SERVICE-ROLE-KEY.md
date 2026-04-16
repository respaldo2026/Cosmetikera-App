# 🔑 Configuración de Service Role Key

## Error: "User not allowed" (403)

Este error ocurre cuando intentas crear usuarios desde el navegador. La solución es usar la **Service Role Key** en el servidor.

---

## ✅ Solución Implementada

Se creó un **API Route** seguro que maneja la creación de usuarios:

- **Ruta:** `/api/create-user`
- **Ubicación:** `src/app/api/create-user/route.ts`
- **Uso:** Las páginas de crear profesores/estudiantes ahora llaman a esta API

---

## 🔧 Configuración Requerida

### Paso 1: Obtener la Service Role Key

1. Ve a tu **Supabase Dashboard**
2. Navega a: **Settings** → **API**
3. Copia la **`service_role` key** (secret)

⚠️ **IMPORTANTE:** Esta clave tiene privilegios totales. Nunca la expongas en el cliente.

### Paso 2: Crear archivo .env.local

Crea un archivo `.env.local` en la raíz del proyecto:

```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Ubicación:** `academia-crystal/.env.local`

### Paso 3: Reiniciar el servidor de desarrollo

```bash
npm run dev
```

---

## 🧪 Probar

1. Ve a "Profesores" → "Crear Nuevo Profesor"
2. Completa el formulario con email válido
3. Haz clic en "Guardar"

✅ **Resultado esperado:** 
- Usuario creado exitosamente
- Mensaje con credenciales temporales
- Redirige a lista de profesores

---

## 📝 Qué hace el API Route

```
Cliente (navegador)
    ↓
    POST /api/create-user
    ↓
Servidor (Next.js API Route)
    ↓
Supabase Admin API (con SERVICE_ROLE_KEY)
    ↓
1. Crea usuario en auth.users
2. Crea perfil en tabla perfiles
3. Si falla, hace rollback
    ↓
Respuesta al cliente
```

---

## 🔐 Seguridad

✅ **Correcto:**
- Service Role Key solo en servidor (API routes)
- Variable de entorno nunca se expone al navegador
- Next.js solo incluye variables `NEXT_PUBLIC_*` en el cliente

❌ **Incorrecto:**
- Usar SERVICE_ROLE_KEY directamente en componentes de React
- Incluir la clave en código versionado (git)
- Exponerla en `NEXT_PUBLIC_*` variables

---

## 📂 Archivos Modificados

- ✅ `src/app/api/create-user/route.ts` - API route seguro
- ✅ `src/app/profesores/create/page.tsx` - Llama al API route
- ✅ `src/app/estudiantes/create/page.tsx` - Llama al API route
- ✅ `.env.example` - Plantilla de variables

---

## 🐛 Troubleshooting

### Error: "SUPABASE_SERVICE_ROLE_KEY is undefined"

**Solución:**
1. Verifica que `.env.local` existe en la raíz del proyecto
2. Reinicia el servidor (`npm run dev`)
3. Asegúrate que la variable no tiene espacios extra

### Error: "Invalid API key"

**Solución:**
1. Verifica que copiaste la **service_role** key (no la anon key)
2. Asegúrate que no tiene espacios al inicio/final
3. Comprueba que es del proyecto correcto en Supabase

### Error: "Cannot find module '/app/api/create-user/route'"

**Solución:**
1. Verifica que la estructura de carpetas es: `src/app/api/create-user/route.ts`
2. Reinicia el servidor
3. Compila el proyecto: `npm run build`
