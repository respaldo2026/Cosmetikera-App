// Test para verificar que generateUUID funciona correctamente
// Esto es solo para verificación local

const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Generar algunos UUIDs de prueba
console.log("Test generateUUID:");
for (let i = 0; i < 3; i++) {
  const uuid = generateUUID();
  console.log(`UUID ${i+1}:`, uuid);
  console.log(`  Formato válido:`, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid));
}

// El formato es: 8-4-4-4-12 (con el 4 fijo en la posición de versión)
// Ejemplo: 550e8400-e29b-41d4-a716-446655440000
