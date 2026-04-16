// src/utils/whatsapp.ts

/**
 * Abre un chat de WhatsApp con el mensaje predefinido.
 * @param telefono Número de teléfono (string o number)
 * @param mensaje Texto a enviar
 */
export const enviarWhatsapp = (telefono: string | number, mensaje: string) => {
    if (!telefono) {
        alert("El usuario no tiene teléfono registrado.");
        return;
    }

    // Convertir a string y limpiar caracteres no numéricos
    let phoneStr = String(telefono).replace(/\D/g, '');

    // Validación básica para Colombia (si tiene 10 dígitos, agregamos 57)
    // Puedes ajustar esto según tu país
    if (phoneStr.length === 10 && !phoneStr.startsWith('57')) {
        phoneStr = '57' + phoneStr;
    }

    const url = `https://wa.me/${phoneStr}?text=${encodeURIComponent(mensaje)}`;
    
    // Abrir en nueva pestaña
    window.open(url, '_blank');
};