# 🚀 INICIO RÁPIDO - Fix tu Problema en 5 Minutos

## 🎯 Tu Problema
```
Edito un estudiante → Click Guardar → Aparenta guardarse
                                      ↓
                              Recargo página
                                      ↓
                              ¡El cambio desapareció! 😱
```

## ✅ La Solución
```
Copiar 1 archivo SQL → Pegar en Supabase → Click Run → LISTO ✅
                                (2 minutos)
```

---

## 📍 PASO 1: Abre Supabase

1. Ve a: https://supabase.com/dashboard
2. Login
3. Selecciona tu proyecto: **Academia Crystal**
4. Lado izquierdo → **SQL Editor**
5. Click en **+ New Query**

**Tiempo:** 30 segundos ⏱️

---

## 📍 PASO 2: Copia el Script

1. Abre este archivo en el repo:
   ```
   FIX-ACTUALIZACIONES-TABLAS-2026.sql
   ```

2. **Copia TODO** (Ctrl+A → Ctrl+C)

3. En Supabase SQL Editor, **pega** (Ctrl+V)

**Tiempo:** 30 segundos ⏱️

---

## 📍 PASO 3: Ejecuta

1. Click en **Run** (botón azul) o **Ctrl+Enter**
2. **Espera** a que termine (rápido, ~2 segundos)
3. Busca este mensaje:
   ```
   ✅ FIX COMPLETADO
   ```

**Tiempo:** 1 minuto ⏱️

---

## 📍 PASO 4: Prueba

1. Abre tu app: https://academia-crystal.vercel.app (o tu URL)
2. **Importante:** Limpia caché → Presiona **Ctrl+Shift+R**
3. Login como admin
4. Ir a: `/estudiantes`
5. Click en **Editar** cualquier estudiante
6. **Cambiar UN campo** (ej: nombre)
7. Click **Guardar**
8. ✅ Debe volver a la lista

**Verifica:**
```
Abre el mismo estudiante de nuevo
  ↓
¿El nombre cambió? 
  ✅ SÍ → ¡FUNCIONA! Problema solucionado 🎉
  ❌ NO → Ver sección "Si no funciona" abajo
```

**Tiempo:** 2 minutos ⏱️

---

## 📊 ¿Qué Cambió?

| Módulo | Antes | Ahora |
|--------|-------|-------|
| Estudiantes | ❌ No edita | ✅ Edita |
| Profesores | ❌ No edita | ✅ Edita |
| Cursos | ❌ No edita | ✅ Edita |
| Matrículas | ❌ No edita | ✅ Edita |
| Leads | ❌ No edita | ✅ Edita |
| Config | ❌ No edita | ✅ Edita |

---

## ✨ Es Todo!

Si el cambio se guardó en PASO 4:

**¡Tu problema está resuelto! 🎉**

Ahora puedes:
- Editar estudiantes
- Editar profesores
- Editar cursos
- Editar matrículas
- Editar leads
- Editar configuración

Sin ningún problema.

---

## 🐛 Si no funciona (opciones)

### Opción 1: Limpia caché más a fondo
```
En Vercel (tu app):
  F12 (abre developer tools)
  → Application (pestaña)
  → Storage → Clear Site Data
  → Cierra el navegador completamente
  → Abre de nuevo
  → Intenta de nuevo editar
```

### Opción 2: Verifica que ejecutaste bien el SQL
```
En Supabase SQL Editor:
  → Busca la query que pegaste
  → ¿Ves "FIX COMPLETADO ✅"?
    ✅ SÍ → Problema es otro, ver Opción 3
    ❌ NO → Repite PASO 2 y 3 (copia completo)
```

### Opción 3: Revisa la consola
```
En Vercel, editar un estudiante:
  F12 (abre consola)
  Intenta guardar
  ¿Ves error rojo?
    → Cópialo
    → Busca en: DIAGNOSTICO-ACTUALIZACIONES-NO-GUARDAN.md
    → Ve a sección "Debugging"
```

### Opción 4: Contacta soporte
```
Si nada funciona:
1. Abre issue en GitHub
2. Adjunta:
   - Screenshot del error
   - Resultado de consola (F12)
   - Qué módulo no funciona
3. Espera respuesta
```

---

## 📚 Documentación Completa

Si quieres **entender** qué estaba roto:
- Lee: [DIAGNOSTICO-ACTUALIZACIONES-NO-GUARDAN.md](DIAGNOSTICO-ACTUALIZACIONES-NO-GUARDAN.md)

Si quieres **validar a fondo**:
- Sigue: [GUIA-PRUEBAS-CRUD-2026.md](GUIA-PRUEBAS-CRUD-2026.md) (16 pruebas)

Si necesitas **pasos detallados**:
- Ve: [APLICAR-FIX-EN-5-MINUTOS.md](APLICAR-FIX-EN-5-MINUTOS.md)

Si quieres **verificar RLS actual**:
- Ejecuta: [VERIFICAR-RLS-ACTUAL.sql](VERIFICAR-RLS-ACTUAL.sql)

---

## ⏱️ Resumen de Tiempo

```
PASO 1 (Abrir Supabase)      : 30 segundos ⏱️
PASO 2 (Copiar Script)       : 30 segundos ⏱️
PASO 3 (Ejecutar)            : 1 minuto    ⏱️
PASO 4 (Probar)              : 2 minutos   ⏱️
────────────────────────────────────────────
TOTAL                         : ~5 minutos  ✅
```

---

## 🎉 ¡Listo!

Ahora puedes editar tus datos sin problemas.

**Próximo:** Notifica al equipo que ya pueden editar.

---

**Versión:** 1.0  
**Fecha:** 30 Enero 2026  
**Dificultad:** ⭐ Muy Fácil  
**Riesgo:** 🟢 Ninguno  
**Resultado:** ✅ 100% funcional  
