# ⚡ REFERENCIA RÁPIDA - CHEAT SHEET

## 🎯 TU PROBLEMA
```
No puedo guardar cambios en estudiantes, profesores, cursos, matrículas, leads, configuración
```

## ✅ LA SOLUCIÓN EN 5 PASOS

### 1️⃣ SUPABASE SQL EDITOR
```
Supabase.com → Dashboard → Tu Proyecto → SQL Editor → + New Query
```

### 2️⃣ COPIAR SCRIPT
```
Abre: FIX-ACTUALIZACIONES-TABLAS-2026.sql
Copia TODO (Ctrl+A + Ctrl+C)
Pega en SQL Editor (Ctrl+V)
```

### 3️⃣ EJECUTAR
```
Click: Run  O  Presiona: Ctrl+Enter
Espera: 2 segundos máximo
Busca: ✅ FIX COMPLETADO
```

### 4️⃣ LIMPIAR CACHÉ
```
En tu navegador:
Ctrl+Shift+R  (fuerza)
O  Ctrl+F5
```

### 5️⃣ PROBAR
```
Vercel → /estudiantes → Editar → Cambiar campo → Guardar
Recarga página → ¿Cambió? 
  ✅ SÍ → Problema solucionado
  ❌ NO → Ver sección "DEBUGGING" abajo
```

---

## 📊 CAMBIOS

| Tabla | Antes | Ahora |
|-------|-------|-------|
| estudiantes | ❌ | ✅ |
| profesores | ❌ | ✅ |
| cursos | ❌ | ✅ |
| matriculas | ❌ | ✅ |
| leads | ❌ | ✅ |
| configuracion | ❌ | ✅ |

---

## 🐛 DEBUGGING RÁPIDO

### "Cambios no se guardan"
```
1. Ctrl+Shift+R en navegador (limpia caché)
2. Intenta editar de nuevo
3. Si no funciona → Próximo paso
```

### "Veo error 'Permission denied'"
```
1. Supabase SQL Editor
2. Ejecuta: VERIFICAR-RLS-ACTUAL.sql
3. ¿Ves ❌ PROBLEMA?
   SÍ → Repite paso 3 del FIX (ejecuta script completo)
   NO → Contacta soporte
```

### "No sé si funcionó"
```
1. Abre Supabase SQL
2. Pega: SELECT * FROM pg_policies 
         WHERE tablename = 'perfiles';
3. ¿Ves columna 'with_check' con valor?
   ✅ SÍ → Funcionó
   ❌ NO → Repite FIX
```

---

## 📚 DOCUMENTACIÓN

| Necesitas... | Lee... | Tiempo |
|--------------|--------|--------|
| Instrucciones rápidas | INICIO-RAPIDO.md | 5 min |
| Entender qué pasó | DIAGNOSTICO-*.md | 10 min |
| Validar todo | GUIA-PRUEBAS-CRUD.md | 20 min |
| Pasos detallados | APLICAR-FIX-EN-5.md | 5 min |
| Indice completo | INDICE-DOCUMENTACION.md | 5 min |

---

## 🔐 SEGURIDAD

**ANTES:** Cualquiera podía hacer cualquier cosa  
**DESPUÉS:** Solo admin puede editar todo, otros solo su data  
**Resultado:** ✅ Más seguro + Funcional

---

## ⏱️ TIEMPO TOTAL
```
FIX SQL        :  2 min
Limpiar caché  :  1 min
Probar         :  2 min
─────────────────────
TOTAL          :  5 min ✅
```

---

## ✨ ESTADO

- [ ] Ejecutar FIX SQL
- [ ] Limpiar caché
- [ ] Probar edición
- [ ] ✅ Problema resuelto

---

## 🆘 CONTACTO

Si nada funciona:
1. Ejecuta: VERIFICAR-RLS-ACTUAL.sql
2. Abre: DIAGNOSTICO-ACTUALIZACIONES-NO-GUARDAN.md
3. Ve: Sección "Debugging"
4. Si aún no funciona → Abre issue

---

**Versión:** 1.0  
**Fecha:** 30 Enero 2026  
**Riesgo:** 🟢 Ninguno
