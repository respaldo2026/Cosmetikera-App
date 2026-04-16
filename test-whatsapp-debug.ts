/**
 * Script de prueba para verificar el envío de WhatsApp
 * 
 * Usa este endpoint para probar el envío directamente sin pasar por el catálogo
 */

// TEST 1: Verificar que las credenciales están cargadas
console.log("=== VERIFICACIÓN DE CREDENCIALES ===");
console.log("WHATSAPP_PHONE_NUMBER_ID:", process.env.WHATSAPP_PHONE_NUMBER_ID ? "✓ Configurado" : "✗ Falta");
console.log("WHATSAPP_ACCESS_TOKEN:", process.env.WHATSAPP_ACCESS_TOKEN ? "✓ Configurado" : "✗ Falta");
console.log("WHATSAPP_API_KEY:", process.env.WHATSAPP_API_KEY ? "✓ Configurado" : "✗ Falta");

// TEST 2: Verificar normalización de números
const testNumbers = [
  "3006402575",      // Tu número sin código país
  "573006402575",    // Tu número con código país
  "+573006402575",   // Tu número con +
  "57 300 640 2575", // Con espacios
];

console.log("\n=== NORMALIZACIÓN DE NÚMEROS ===");
testNumbers.forEach(num => {
  const normalized = num.replace(/[^\d+]/g, "");
  const final = normalized.startsWith("+") ? normalized.substring(1) : 
                normalized.startsWith("57") ? normalized : `57${normalized}`;
  console.log(`${num} → ${final}`);
});

// TEST 3: Payload de ejemplo
const examplePayload = {
  phone: "573006402575",
  type: "text",
  message: "Prueba de mensaje desde la API"
};

console.log("\n=== PAYLOAD DE PRUEBA ===");
console.log(JSON.stringify(examplePayload, null, 2));

// Instrucciones
console.log("\n=== INSTRUCCIONES ===");
console.log("1. Verifica que tu número 3006402575 tenga WhatsApp ACTIVO");
console.log("2. Abre WhatsApp y confirma que esté funcionando");
console.log("3. Verifica en Meta Dashboard que tu número de negocio esté VERIFICADO");
console.log("4. Si el token expiró, genera uno nuevo en Meta Dashboard");
console.log("\n=== PRUEBA ALTERNATIVA ===");
console.log("Prueba enviando desde otro número al tuyo:");
console.log("- Pide a alguien que te envíe un mensaje por WhatsApp");
console.log("- Luego intenta responder usando la API");
console.log("(La ventana de 24 horas se activa cuando RECIBES un mensaje)");

export {};
