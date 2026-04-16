export type WhatsappTemplateDefinition = {
    nombre: string;
    descripcion: string;
    variables: string[];
    fallback: string;
};

const definitions = {
    inscripcion_academica: {
        nombre: "inscripcion_academica",
        descripcion: "Confirma al estudiante que su inscripción fue registrada y explica próximos pasos.",
        variables: ["nombre", "curso"],
        fallback:
            "Hola {{nombre}}, confirmamos tu inscripción al curso {{curso}}. Te contactaremos con los siguientes pasos. Equipo Academia Crystal.",
    },
    pago_confirmado: {
        nombre: "pago_confirmado",
        descripcion: "Notifica la recepción de un pago y refuerza el compromiso del estudiante.",
        variables: ["nombre", "curso", "monto", "periodo"],
        fallback:
            "Hola {{nombre}}, registramos tu pago {{monto}} correspondiente a {{periodo}} del curso {{curso}}. Gracias por mantenerte al día.",
    },
    matricula_cancelada: {
        nombre: "matricula_cancelada",
        descripcion: "Informa al estudiante que su matrícula fue cancelada y habilita un canal de apoyo.",
        variables: ["nombre_estudiante", "nombre_curso"],
        fallback:
            "Hola {{nombre_estudiante}}, tu matrícula en {{nombre_curso}} fue cancelada. Si necesitas apoyo o deseas reactivarla, escríbenos y te ayudamos.",
    },
    nomina_pago_profesor: {
        nombre: "nomina_pago_profesor",
        descripcion: "Informa a un profesor que su nómina fue dispersada.",
        variables: ["nombre", "monto", "periodo_inicio", "periodo_fin"],
        fallback:
            "Hola {{nombre}}, generamos tu pago de nómina por {{monto}} correspondiente al periodo {{periodo_inicio}} - {{periodo_fin}}. Gracias por tu compromiso.",
    },
    nomina_clase_pagada: {
        nombre: "nomina_clase_pagada",
        descripcion: "Confirma al profesor que una clase individual fue pagada.",
        variables: ["nombre", "fecha", "monto", "curso"],
        fallback:
            "Hola {{nombre}}, el pago de tu clase del {{fecha}} por {{monto}} ya fue registrado para {{curso}}. ¡Gracias!",
    },
    bienvenida_portal_estudiante: {
        nombre: "bienvenida_portal_estudiante",
        descripcion: "Da la bienvenida al estudiante y comparte la información de ingreso al portal.",
        variables: ["nombre", "curso", "enlace_portal", "usuario"],
        fallback:
            "Hola {{nombre}}, ¡bienvenida al Curso: {{curso}}!\n\n*Ya puedes ingresar a la app:* {{enlace_portal}}\n\n*Usuario*: {{usuario}}\n\n*En la app podrás ver:*\n• Asistencias\n• Notas\n• Material didáctico\n• Materiales necesarios por clase",
    },
    bienvenida_portal_profesor: {
        nombre: "bienvenida_portal_profesor",
        descripcion: "Da la bienvenida al profesor y comparte acceso a la app con su usuario.",
        variables: ["nombre", "enlace_portal", "usuario"],
        fallback:
            "Hola {{nombre}}, tu cuenta de profesor en Academia Crystal Diamante fue activada.\n\nIngresa a la plataforma: {{enlace_portal}}\nUsuario registrado: {{usuario}}\n\nEste mensaje corresponde a la activación de tu acceso.",
    },
    pago_inscripcion_pendiente: {
        nombre: "pago_inscripcion_pendiente",
        descripcion: "Recuerda al estudiante completar el pago de inscripción pendiente.",
        variables: ["nombre", "curso", "monto"],
        fallback:
            "Hola {{nombre}}, recuerda que tienes pendiente el pago de inscripción de {{monto}} para el curso {{curso}}. Te esperamos para activar tu matrícula.",
    },
    asistencia_inasistencia_registrada: {
        nombre: "asistencia_inasistencia_registrada",
        descripcion: "Notifica una inasistencia registrada para facilitar seguimiento y justificaciones.",
        variables: ["nombre_estudiante", "nombre_curso", "fecha_clase"],
        fallback:
            "Hola {{nombre_estudiante}}, registramos una inasistencia en {{nombre_curso}} el {{fecha_clase}}. Si ya justificaste o fue un error, por favor respóndenos.",
    },
} satisfies Record<string, WhatsappTemplateDefinition>;

export type WhatsappTemplateName = keyof typeof definitions;

export const WHATSAPP_TEMPLATES: Record<WhatsappTemplateName, WhatsappTemplateDefinition> = definitions;

export const WHATSAPP_TEMPLATE_LIST: WhatsappTemplateDefinition[] = Object.values(definitions);

const placeholderPattern = /{{\s*([\w_]+)\s*}}/g;

const formatFallbackValue = (value: string | number | undefined): string => {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value);
};

const tidyMessageSpacing = (texto: string): string =>
    texto
        .replace(/[ \t]{2,}/g, " ")
        .replace(/\s+([,!.?])/g, "$1")
        .trim();

export const buildWhatsappFallbackMessage = (
    nombrePlantilla: string,
    variables: Record<string, string | number>,
): string | undefined => {
    if (!(nombrePlantilla in definitions)) {
        return undefined;
    }

    const definition = definitions[nombrePlantilla as WhatsappTemplateName];

    const mensaje = definition.fallback.replace(placeholderPattern, (_, key: string) => {
        const valor = formatFallbackValue(variables[key]);
        return valor;
    });

    return tidyMessageSpacing(mensaje);
};
