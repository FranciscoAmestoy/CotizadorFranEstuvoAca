/**
 * ============================================================================
 * CONFIGURACIÓN DE PRECIOS Y SERVICIOS - FRAN ESTUVO ACÁ
 * ============================================================================
 * Este archivo es tu "Set and Forget".
 * Si el día de mañana querés actualizar tus precios base por inflación,
 * solo cambiás el número acá y toda la matriz de descuentos se recalcula sola.
 * ============================================================================
 */

window.COTIZADOR_CONFIG = {
  // Tu número de WhatsApp (con código de país, sin + ni espacios)
  whatsappNumber: "5493513239815",

  // Nombre de tu marca
  brandName: "Fran Estuvo Acá",
  brandTagline:
    "Contenido y herramientas digitales para que tu negocio venda más",

  // Hash SHA-256 ofuscado de tu clave Admin (nunca se guarda la clave en texto plano)
  adminPinSalt: "fea_salt_",
  adminPinSuffix: "_v1",
  adminPinHash:
    "a829ec6bf756e3bc02c606d8e1b12a783c0e2c38b5bb2d887f85d17f6b3e71a3",

  // --------------------------------------------------------------------------
  // 1. CONFIGURACIÓN DE VIDEOS (Parámetro URL: v)
  // --------------------------------------------------------------------------
  videos: {
    modalidades: {
      graboEdiPubli: {
        id: "graboEdiPubli",
        nombre: "Grabación + Edición + Publicación",
        nombreCorto: "Fran va, graba, edita y publica",
        precioBase: 50000,
        requiereTraslado: true,
        badge: "Servicio Completo",
        enCriolloTitulo: "¿Qué es y para qué te sirve?",
        enCriolloTexto:
          "Fran va personalmente a tu empresa o local, filma tus productos o servicios en acción, luego se edita de forma profesional y se comparte en redes para que la gente vea cómo trabajás.",
        incluye: [
          "Filmación profesional de tus productos, servicios o equipo",
          "Edición dinámica con subtítulos, música y buena calidad",
          "Publicación lista en redes sociales",
        ],
      },
      ediPubli: {
        id: "ediPubli",
        nombre: "Edición + Publicación",
        nombreCorto: "Vos aportás los videos, yo edito y publico",
        precioBase: 35000,
        requiereTraslado: false,
        badge: "Más Económico (Sin traslados)",
        enCriolloTitulo: "¿Qué es y para qué te sirve?",
        enCriolloTexto:
          "Ideal si vos ya tenés videos grabados pero no tenés tiempo ni ganas de ponerte a editarlos. Fran los compila, edita y transforma en un video profesional listo para atraer clientes.",
        incluye: [
          "Selección de las mejores tomas y recorte de tiempos muertos",
          "Edición profesional con títulos llamativos, subtítulos y música",
          "Armado del texto vendedor para acompañar el video",
          "Publicación lista en tus redes sociales",
        ],
      },
    },

    // Descuento escalonado por cada video adicional en el mismo mes:
    // 1er video: 0%, 2do: 10%, 3ro: 20%, 4to: 30%, 5to: 40%, 6to en adelante: 50%
    descuentoPorUnidad: [
      { unidad: 1, descuentoPct: 0 },
      { unidad: 2, descuentoPct: 10 },
      { unidad: 3, descuentoPct: 20 },
      { unidad: 4, descuentoPct: 30 },
      { unidad: 5, descuentoPct: 40 },
      { unidad: 6, descuentoPct: 50 }, // Del 6to en adelante se mantiene en 50%
    ],

    // Cantidades rápidas para mostrar en los botones y en la matriz
    cantidadesSugeridas: [1, 2, 3, 4, 5, 6, 8, 10],
  },

  // --------------------------------------------------------------------------
  // 2. DESCUENTOS POR MESES ADELANTADOS (Aplica a Videos y a Planes CM)
  // --------------------------------------------------------------------------
  mesesOpciones: [
    {
      meses: 1,
      descuentoPct: 0,
      etiqueta: "1 Mes",
      subtitulo: "Para probar sin compromiso",
      destacado: false,
    },
    {
      meses: 2,
      descuentoPct: 10,
      etiqueta: "2 Meses",
      subtitulo: "10% OFF en el total + Congelás precio",
      destacado: false,
    },
    {
      meses: 3,
      descuentoPct: 20,
      etiqueta: "3 Meses",
      subtitulo: "20% OFF en el total + Congelás precio",
      badge: "⭐ Más elegido",
      destacado: true,
    },
    {
      meses: 6,
      descuentoPct: 30,
      etiqueta: "6 Meses",
      subtitulo: "30% OFF en el total + Congelás precio",
      badge: "🔥 Máximo ahorro",
      destacado: false,
    },
    {
      meses: 9,
      descuentoPct: 35,
      etiqueta: "9 Meses",
      subtitulo: "35% OFF en el total + Congelás precio",
      badge: "🚀 9 Meses",
      destacado: false,
    },
    {
      meses: 12,
      descuentoPct: 40,
      etiqueta: "12 Meses",
      subtitulo: "40% OFF en el total + Congelás precio por 1 año",
      badge: "👑 1 Año Completo",
      destacado: false,
    },
  ],

  // --------------------------------------------------------------------------
  // 3. PLANES DE COMMUNITY MANAGEMENT - CM (Parámetro URL: cm)
  // --------------------------------------------------------------------------
  cm: {
    tituloSeccion: "Manejo de Redes Sociales (Community Manager)",
    enCriolloGeneral:
      "Hoy, antes de comprarte o pedirte un presupuesto la gente te busca en Google, Instagram o Facebook. Si no estás o tu página está inactiva se lleva una primera impresión que tal vez no sea la mejor. Con este servicio mantenés tu negocio activo sin que vos pierdas tiempo.",
    planes: [
      {
        id: "presencia",
        nombre: "Plan CM Presencia",
        precioMensual: 180000,
        badge: "Para arrancar y estar al día",
        enCriollo:
          "Ideal para que tu negocio figure en Google Maps, se vea activo todas las semanas y quien te busque vea una empresa seria y en movimiento.",
        resumenCorto: [
          "🎬 1 Reel / video por semana (~4 al mes)",
          "🖼️ 1 publicación adicional por semana (carrusel, foto o placa)",
          "📱 Historias 3 días por semana + Alta en Google Maps",
          "💬 Respuesta básica de comentarios y mensajes (1 vez/semana)",
        ],
        detalleCompleto: [
          "Estrategia y planificación mensual de contenido.",
          "Calendario de publicaciones.",
          "Creamos tu perfil de negocio para que te encuentren en Maps y en Google (sólo local físico).",
          "1 Reel/video por semana → aproximadamente 4 al mes.",
          "1 publicación adicional semanal entre carrusel, foto o pieza gráfica.",
          "Stories 3 días por semana, con contenido relacionado a las publicaciones.",
          "Creación de ideas y conceptos para el contenido.",
          "Redacción de textos/copies básico.",
          "Selección de hashtags y palabras clave.",
          "Publicación y programación del contenido.",
          "Optimización de textos, títulos y llamados a la acción.",
          "Respuesta y moderación básica de comentarios y mensajes 1 vez / semana.",
          "Revisión mensual de estadísticas.",
          "Informe mensual sencillo con resultados y observaciones.",
        ],
      },
      {
        id: "crecimiento",
        nombre: "Plan CM Crecimiento",
        precioMensual: 280000,
        badge: "⭐ Recomendado para atraer clientes",
        destacado: true,
        enCriollo:
          "Pensado para negocios que quieren salir a buscar clientes nuevos activamente. Más videos por semana, presencia casi todos los días y atención constante.",
        resumenCorto: [
          "🎬 2 a 3 Reels / videos por semana (~8 a 12 al mes)",
          "🖼️ 1 a 2 publicaciones gráficas por semana + Historias 5 días/sem",
          "💬 Gestión de comentarios y mensajes 3 veces por semana",
          "📈 Análisis semanal de métricas + Investigación de tendencias",
        ],
        detalleCompleto: [
          "Estrategia y planificación mensual de contenido.",
          "Calendario de publicaciones.",
          "Creamos tu perfil de negocio para que te encuentren en Maps y en Google (sólo local físico).",
          "2 a 3 Reels/videos por semana.",
          "1–2 publicaciones gráficas adicionales por semana.",
          "Stories 5 días por semana.",
          "Mayor variedad de contenido: educativo, entretenimiento, producto, venta, interacción, tendencias, etc.",
          "Copywriting orientado a interacción y conversión.",
          "Selección de hashtags y palabras clave.",
          "Publicación y programación del contenido.",
          "Optimización de textos, títulos y llamados a la acción.",
          "Gestión 3 veces por semana de comentarios y mensajes.",
          "Análisis semanal de métricas.",
          "Informe mensual + propuestas de mejora para el mes siguiente.",
          "Investigación de tendencias y audios.",
          "Adaptación de contenido según lo que mejor funcione en la cuenta.",
        ],
      },
      {
        id: "total",
        nombre: "Plan CM Total",
        precioMensual: 400000,
        badge: "Delegación 100% + Atención Diaria",
        enCriollo:
          "Te olvidás por completo de las redes. Publicamos videos todos los días hábiles, respondemos mensajes todos los días y nos reunimos mes a mes para planificar campañas y ventas.",
        resumenCorto: [
          "🎬 5 Reels / videos por semana (~20 al mes) con guiones e ideas",
          "🖼️ Publicaciones gráficas y carruseles + Historias de Lunes a Viernes",
          "💬 Gestión DIARIA de comentarios y mensajes",
          "🤝 Informe detallado + Reunión mensual + Campañas y promociones",
        ],
        detalleCompleto: [
          "Estrategia y planificación mensual de contenido.",
          "Calendario de publicaciones.",
          "Creamos tu perfil de negocio para que te encuentren en Maps y en Google (sólo local físico).",
          "5 Reels/videos por semana.",
          "Publicaciones gráficas/carruseles según estrategia.",
          "Stories de lunes a viernes, con contenido frecuente y dinámico.",
          "Contenido orientado a vender, generar interacción y construir comunidad.",
          "Copywriting orientado a interacción y conversión.",
          "Selección de hashtags y palabras clave.",
          "Publicación y programación del contenido.",
          "Optimización de textos, títulos y llamados a la acción.",
          "Gestión diaria de comentarios y mensajes.",
          "Revisión semanal de métricas para ir ajustando el contenido.",
          "Informe mensual detallado + Reunión mensual de seguimiento.",
          "Investigación de tendencias y audios.",
          "Optimización del perfil cuando sea necesario.",
          "Planificación estratégica mensual.",
          "Calendario editorial completo.",
          "Ideas, conceptos y guiones para videos.",
          "Interacción activa con la comunidad.",
          "Propuestas de campañas, promociones y fechas especiales.",
        ],
      },
    ],
  },

  // --------------------------------------------------------------------------
  // 4. TIENDA ONLINE Y CATÁLOGO DIGITAL (Parámetro URL: to)
  // --------------------------------------------------------------------------
  tienda: {
    tituloSeccion: "Catálogo Digital / Tienda Online (Pago Único)",
    enCriolloGeneral:
      "Un catálogo digital es un mostrador abierto las 24 hs: mandás un solo link y el cliente ve fotos, características y precios listos para encargarte.",
    precioAmbos: 100000,
    opciones: [
      {
        id: "catalogoWsp",
        nombre: "Digitalización de Catálogo WhatsApp Business",
        precioUnico: 50000,
        requiereTraslado: true,
        badge: "Pago Único • Ideal para vender por chat",
        enCriollo:
          "Voy a tu local o empresa, saco las fotos de tus productos/servicios y te dejo armado un catálogo adentro de tu propio WhatsApp con precios y descripciones para que no tengas que escribir todo de cero cada vez que te consultan.",
        incluye: [
          "Fotografía de hasta 30 productos en tu local o predio",
          "Armado completo del catálogo dentro de tu WhatsApp Business",
          "Organización por precios, categorías y descripciones vendedoras",
          "Pago por única vez (queda tuyo para siempre)",
          "Traslado se cobra aparte según zona",
        ],
      },
      {
        id: "tiendaNube",
        nombre: "Apertura y Carga de Tienda Online (Tienda Nube / Empretienda)",
        precioUnico: 50000,
        requiereTraslado: true,
        badge: "Pago Único • Tu propia web de ventas",
        enCriollo:
          "Te dejo armada tu propia página web para vender o mostrar tu catálogo las 24 hs. Tus clientes entran desde cualquier lado, ven hasta 30 productos con sus fotos y detalles, y pueden comprarte o pedirte presupuesto directo.",
        incluye: [
          "Configuración completa de tu tienda (Tienda Nube o Empretienda)",
          "Conexión de medios de pago (Mercado Pago / transferencia)",
          "Configuración de medios de envío o retiro",
          "Carga de hasta 30 productos con fotos optimizadas y descripción",
          "Pago por única vez • Traslado se cobra aparte según zona",
        ],
      },
    ],
  },

  // --------------------------------------------------------------------------
  // 5. BENEFICIO IMPRENTA INUCORN (Parámetro URL: inu)
  // --------------------------------------------------------------------------
  inucorn: {
    nombre: "Imprenta Inucorn",
    whatsappNumber: "5493512692607",
    descuentoPct: 10,
    codigoCupon: "FRANESTUVOACA",
    titulo: "🎁 Beneficio Exclusivo: 10% OFF en Imprenta Inucorn",
    descripcion:
      "Contratando cualquiera de mis servicios, tenés un 10% de descuento en servicios de imprenta (folletos, tarjetas personales, stickers, cartelería y gráfica para tu negocio) mencionando el código FRANESTUVOACA.",
  },

  // --------------------------------------------------------------------------
  // 6. PROGRAMA DE REFERIDOS (Parámetro URL: ref)
  // --------------------------------------------------------------------------
  referidos: {
    descuentoPct: 25,
  },
};
