/**
 * ============================================================================
 * LÓGICA DEL FUNNEL COTIZADOR - FRAN ESTUVO ACÁ
 * ============================================================================
 */

(function () {
  const CFG = window.COTIZADOR_CONFIG;

  // Estado global de la aplicación
  // Ninguna combinación de cantidad/tiempo viene precargada para no dar una
  // falsa impresión de caro o barato antes de que el cliente elija en la matriz.
  const state = {
    step: 1, // 1: Selección de servicios, 2: Cantidades y Meses, 3: Resumen y Cierre
    enabledModules: {
      v: true,
      cm: true,
      to: true,
      inu: false
    },
    clientName: "",
    customNote: "",
    uberOneWay: 0, // Si es > 0, calcula ida y vuelta (x2) por visita

    // Selecciones del Paso 1 (qué servicios le interesan)
    selectedVideoMode: null, // null | 'graboEdiPubli' | 'ediPubli' (mutuamente excluyentes)
    selectedCM: false,
    selectedTienda: false,

    // Configuración del Paso 2 - Videos (arranca sin selección hasta que el cliente elija)
    videoQty: null, // null o número de videos por mes
    videoMonths: null, // null o 1, 2, 3, 6 meses

    // Configuración del Paso 2 - CM (arranca sin selección hasta que el cliente elija)
    cmPlanId: null, // null | 'presencia' | 'crecimiento' | 'total'
    cmMonths: null, // null | 1, 2, 3, 6 meses

    // Configuración del Paso 2 - Tienda / Catálogo (arranca sin selección hasta el Paso 2)
    tiendaOptions: {
      catalogoWsp: false,
      tiendaNube: false
    }
  };

  // ==========================================================================
  // 1. UTILIDADES DE FORMATO Y CÁLCULO DE PRECIOS
  // ==========================================================================

  function formatARS(num) {
    return "$" + Math.round(num).toLocaleString("es-AR");
  }

  /**
   * Calcula el descuento del video N dentro del mes:
   * 1ro: 0%, 2do: 10%, 3ro: 20%, 4to: 30%, 5to: 40%, 6to+: 50%
   */
  function getVideoUnitDiscountPct(unitIndex1Based) {
    if (unitIndex1Based <= 1) return 0;
    if (unitIndex1Based === 2) return 10;
    if (unitIndex1Based === 3) return 20;
    if (unitIndex1Based === 4) return 30;
    if (unitIndex1Based === 5) return 40;
    return 50; // 6to en adelante 50% c/u
  }

  function getMonthDiscountPct(months) {
    const found = CFG.mesesOpciones.find((m) => m.meses === Number(months));
    return found ? found.descuentoPct : 0;
  }

  /**
   * Calcula todo el desglose de Videos según modalidad, cantidad mensual y meses
   */
  function calculateVideosQuote(modeId, qtyPerMonth, months) {
    const mode = CFG.videos.modalidades[modeId];
    if (!mode || !qtyPerMonth || qtyPerMonth < 1 || !months || months < 1) {
      return {
        isComplete: false,
        baseUnitPrice: mode ? mode.precioBase : 0,
        monthlyRaw: 0,
        monthlyWithVolumeDiscount: 0,
        totalRawAllMonths: 0,
        totalFinal: 0,
        totalSaved: 0,
        effectivePerMonth: 0,
        effectivePerVideo: 0,
        monthDiscountPct: 0,
        unitBreakdown: []
      };
    }

    const base = mode.precioBase;
    let monthlyWithVolumeDiscount = 0;
    const unitBreakdown = [];

    for (let i = 1; i <= qtyPerMonth; i++) {
      const discPct = getVideoUnitDiscountPct(i);
      const unitPrice = base * (1 - discPct / 100);
      monthlyWithVolumeDiscount += unitPrice;
      unitBreakdown.push({ index: i, discPct, unitPrice });
    }

    const monthlyRaw = base * qtyPerMonth;
    const totalRawAllMonths = monthlyRaw * months;
    const subtotalBeforeMonthDisc = monthlyWithVolumeDiscount * months;

    const monthDiscountPct = getMonthDiscountPct(months);
    const totalFinal = subtotalBeforeMonthDisc * (1 - monthDiscountPct / 100);
    const totalSaved = totalRawAllMonths - totalFinal;

    return {
      isComplete: true,
      baseUnitPrice: base,
      monthlyRaw,
      monthlyWithVolumeDiscount,
      totalRawAllMonths,
      totalFinal,
      totalSaved,
      effectivePerMonth: totalFinal / months,
      effectivePerVideo: totalFinal / (qtyPerMonth * months),
      monthDiscountPct,
      unitBreakdown
    };
  }

  /**
   * Calcula todo el desglose de CM según plan y meses
   */
  function calculateCMQuote(planId, months) {
    const plan = CFG.cm.planes.find((p) => p.id === planId);
    if (!plan || !months || months < 1) {
      return {
        isComplete: false,
        plan: plan || null,
        monthlyRaw: plan ? plan.precioMensual : 0,
        totalRawAllMonths: 0,
        monthDiscountPct: 0,
        totalFinal: 0,
        totalSaved: 0,
        effectivePerMonth: 0
      };
    }

    const monthlyRaw = plan.precioMensual;
    const totalRawAllMonths = monthlyRaw * months;
    const monthDiscountPct = getMonthDiscountPct(months);
    const totalFinal = totalRawAllMonths * (1 - monthDiscountPct / 100);
    const totalSaved = totalRawAllMonths - totalFinal;

    return {
      isComplete: true,
      plan,
      monthlyRaw,
      totalRawAllMonths,
      monthDiscountPct,
      totalFinal,
      totalSaved,
      effectivePerMonth: totalFinal / months
    };
  }

  /**
   * Calcula el total de Tienda Online / Catálogo WhatsApp (Pago único)
   */
  function calculateTiendaQuote() {
    let total = 0;
    const chosen = [];
    CFG.tienda.opciones.forEach((op) => {
      if (state.tiendaOptions[op.id]) {
        total += op.precioUnico;
        chosen.push(op);
      }
    });
    return {
      isComplete: chosen.length > 0,
      total,
      chosen
    };
  }

  /**
   * Cuenta cuántos servicios eligió en el Paso 1
   */
  function countStep1Selections() {
    let count = 0;
    if (state.selectedVideoMode) count++;
    if (state.selectedCM) count++;
    if (state.selectedTienda) count++;
    return count;
  }

  /**
   * Calcula el Gran Total de toda la cotización activa (solo de las matrices ya elegidas en Paso 2)
   */
  function calculateGrandTotals() {
    let totalFinal = 0;
    let totalSaved = 0;
    let totalRaw = 0;
    let requiresTravel = false;
    const pendingSteps = [];

    if (state.selectedVideoMode) {
      const vq = calculateVideosQuote(state.selectedVideoMode, state.videoQty, state.videoMonths);
      if (vq.isComplete) {
        totalFinal += vq.totalFinal;
        totalSaved += vq.totalSaved;
        totalRaw += vq.totalRawAllMonths;
        if (CFG.videos.modalidades[state.selectedVideoMode].requiereTraslado) {
          requiresTravel = true;
        }
      } else {
        pendingSteps.push("Videos (elegí cantidad y meses)");
      }
    }

    if (state.selectedCM) {
      const cmq = calculateCMQuote(state.cmPlanId, state.cmMonths);
      if (cmq.isComplete) {
        totalFinal += cmq.totalFinal;
        totalSaved += cmq.totalSaved;
        totalRaw += cmq.totalRawAllMonths;
      } else {
        pendingSteps.push("Redes Sociales / CM (elegí plan y meses)");
      }
    }

    if (state.selectedTienda) {
      const tq = calculateTiendaQuote();
      if (tq.isComplete) {
        totalFinal += tq.total;
        totalRaw += tq.total;
        requiresTravel = true;
      } else {
        pendingSteps.push("Catálogo / Tienda (elegí al menos una opción)");
      }
    }

    const step1Count = countStep1Selections();

    return {
      totalFinal,
      totalSaved,
      totalRaw,
      requiresTravel,
      hasStep1Selection: step1Count > 0,
      step1Count,
      allConfiguredInStep2: step1Count > 0 && pendingSteps.length === 0,
      pendingSteps
    };
  }

  // ==========================================================================
  // 2. LECTURA DE PARÁMETROS DE URL (SOPORTA ?v&cm&to&inu Y #v&cm&to)
  // ==========================================================================

  function parseUrlParameters() {
    const rawSearch = window.location.search.replace(/^\?/, "");
    const rawHash = window.location.hash.replace(/^#/, "");
    const combined = [rawSearch, rawHash].filter(Boolean).join("&");

    const params = new URLSearchParams(combined);
    const keysLower = Array.from(params.keys()).map((k) => k.toLowerCase());

    const hasV = keysLower.includes("v") || keysLower.includes("vg") || keysLower.includes("ve");
    const hasCM = keysLower.includes("cm");
    const hasTO = keysLower.includes("to");
    const hasINU = keysLower.includes("inu");

    if (hasV || hasCM || hasTO) {
      state.enabledModules.v = hasV;
      state.enabledModules.cm = hasCM;
      state.enabledModules.to = hasTO;
    } else {
      state.enabledModules.v = true;
      state.enabledModules.cm = true;
      state.enabledModules.to = true;
    }

    state.enabledModules.inu = hasINU;

    const clientParam = params.get("c") || params.get("cliente") || "";
    state.clientName = clientParam.trim();

    const noteParam = params.get("nota") || "";
    state.customNote = noteParam.trim();

    const uberParam = parseInt(params.get("uber") || "0", 10);
    if (!isNaN(uberParam) && uberParam > 0) {
      state.uberOneWay = uberParam;
    }

    if (keysLower.includes("admin")) {
      setTimeout(() => {
        openAdminModal();
      }, 200);
    }
  }

  // ==========================================================================
  // 3. RENDERIZADO DEL ENCABEZADO Y NAVEGACIÓN
  // ==========================================================================

  function renderHeader() {
    const titleEl = document.getElementById("hero-title");
    const subtitleEl = document.getElementById("hero-subtitle");
    const noteEl = document.getElementById("custom-note-banner");

    if (state.clientName) {
      titleEl.textContent = `¡Hola ${state.clientName}! 👋 Armá tu presupuesto a medida`;
      subtitleEl.textContent =
        "Elegí los servicios que te interesan, combinalos como quieras y mirá cuánto ahorrás!.";
    } else {
      titleEl.textContent = "Calculá tu Presupuesto a Medida al Instante";
      subtitleEl.textContent =
        "Elegí qué necesita tu negocio, ajustá las cantidades y mirá cuánto ahorrás!.";
    }

    if (state.customNote) {
      noteEl.textContent = `💬 Nota de Fran: "${state.customNote}"`;
      noteEl.style.display = "block";
    } else {
      noteEl.style.display = "none";
    }
  }

  function renderStepper() {
    for (let i = 1; i <= 3; i++) {
      const tab = document.getElementById(`step-tab-${i}`);
      if (!tab) continue;
      tab.classList.remove("active", "completed");
      if (state.step === i) {
        tab.classList.add("active");
      } else if (state.step > i) {
        tab.classList.add("completed");
      }
    }
  }

  // ==========================================================================
  // 4. PASO 1: SELECCIÓN DE SERVICIOS (SIN PRECARGAR TOTALES)
  // ==========================================================================

  function renderStep1() {
    const container = document.getElementById("step-1-content");
    let html = `
      <div class="section-header-box">
        <h2>Paso 1: ¿Qué servicios te gustaría contratar?</h2>
        <p>Marcá las opciones que te interesen para tu negocio. Luego tocá <strong>"Siguiente"</strong> abajo para elegir cantidades, meses y ver los precios.</p>
      </div>
    `;

    // 1. BLOQUE DE VIDEOS (GraboEdiPubli vs EdiPubli - Mutuamente excluyentes)
    if (state.enabledModules.v) {
      const mGrabo = CFG.videos.modalidades.graboEdiPubli;
      const mEdi = CFG.videos.modalidades.ediPubli;
      const isGraboSelected = state.selectedVideoMode === "graboEdiPubli";
      const isEdiSelected = state.selectedVideoMode === "ediPubli";

      html += `
        <div class="category-group">
          <div class="category-group-header">
            <div class="category-group-title">
              <span>🎬 Videos para Redes Sociales</span>
            </div>
            <span class="category-rule-badge">Elegí 1 de las 2 opciones a continuación</span>
          </div>

          <div class="service-cards-grid">
            <!-- Opción A: GraboEdiPubli -->
            <div class="service-card ${isGraboSelected ? "selected" : ""}" data-action="select-video-mode" data-mode="graboEdiPubli">
              <div class="service-card-top">
                <span class="service-badge">${isGraboSelected ? "✅ Seleccionado para cotizar" : mGrabo.badge}</span>
                <h3 class="service-title">${mGrabo.nombre}</h3>

                <div class="criollo-box">
                  <strong>💡 ${mGrabo.enCriolloTitulo}</strong>
                  <p>${mGrabo.enCriolloTexto}</p>
                </div>

                <ul class="service-checklist">
                  ${mGrabo.incluye.map((item) => `<li>${item}</li>`).join("")}
                </ul>
              </div>

              <button type="button" class="select-action-btn">
                ${isGraboSelected ? "✅ Elegido (Tocá para quitar)" : "Cotizar esta opción (Con grabación)"}
              </button>
            </div>

            <!-- Opción B: EdiPubli -->
            <div class="service-card ${isEdiSelected ? "selected" : ""}" data-action="select-video-mode" data-mode="ediPubli">
              <div class="service-card-top">
                <span class="service-badge">${isEdiSelected ? "✅ Seleccionado para cotizar" : mEdi.badge}</span>
                <h3 class="service-title">${mEdi.nombre}</h3>

                <div class="criollo-box">
                  <strong>💡 ${mEdi.enCriolloTitulo}</strong>
                  <p>${mEdi.enCriolloTexto}</p>
                </div>

                <ul class="service-checklist">
                  ${mEdi.incluye.map((item) => `<li>${item}</li>`).join("")}
                </ul>
              </div>

              <button type="button" class="select-action-btn">
                ${isEdiSelected ? "✅ Elegido (Tocá para quitar)" : "Cotizar esta opción (Solo edición)"}
              </button>
            </div>
          </div>
        </div>
      `;
    }

    // 2. BLOQUE DE COMMUNITY MANAGEMENT (CM)
    if (state.enabledModules.cm) {
      const isCM = state.selectedCM;
      html += `
        <div class="category-group">
          <div class="category-group-header">
            <div class="category-group-title">
              <span>📱 ${CFG.cm.tituloSeccion}</span>
            </div>
            <span class="category-rule-badge">Independiente • Opcional</span>
          </div>

          <div class="service-card ${isCM ? "selected" : ""}" data-action="toggle-cm">
            <div class="service-card-top">
              <span class="service-badge">${isCM ? "✅ Seleccionado para cotizar" : "Tu negocio activo en Internet"}</span>
              <h3 class="service-title">Manejo Integral de tus Redes + Presencia en Google Maps</h3>

              <div class="criollo-box">
                <strong>💡 ¿Qué es un Community Manager (CM) y para qué sirve?</strong>
                <p>${CFG.cm.enCriolloGeneral}</p>
              </div>

              <ul class="service-checklist">
                <li><strong>Te encuentran en Google Maps:</strong> Armamos tu ficha para que cuando alguien busque tu rubro en la zona, aparezcas vos.</li>
                <li><strong>Videos, fotos e historias todas las semanas:</strong> Tu página siempre activa y vendedora.</li>
                <li><strong>Atención de consultas y comentarios:</strong> Para que ningún cliente quede sin respuesta.</li>
              </ul>
            </div>

            <button type="button" class="select-action-btn">
              ${isCM ? "✅ Elegido (Tocá para quitar)" : "Quiero cotizar el Manejo de mis Redes Sociales"}
            </button>
          </div>
        </div>
      `;
    }

    // 3. BLOQUE DE TIENDA ONLINE / CATÁLOGO DIGITAL
    if (state.enabledModules.to) {
      const isTO = state.selectedTienda;
      html += `
        <div class="category-group">
          <div class="category-group-header">
            <div class="category-group-title">
              <span>🛒 ${CFG.tienda.tituloSeccion}</span>
            </div>
            <span class="category-rule-badge">Independiente • Pago por única vez</span>
          </div>

          <div class="service-card ${isTO ? "selected" : ""}" data-action="toggle-tienda">
            <div class="service-card-top">
              <span class="service-badge">${isTO ? "✅ Seleccionado para cotizar" : "Pago Único • Sin abono mensual"}</span>
              <h3 class="service-title">Armado de Catálogo en WhatsApp o Tienda Online</h3>

              <div class="criollo-box">
                <strong>💡 ¿Qué es un Catálogo / Tienda Digital y cómo te ahorra tiempo?</strong>
                <p>${CFG.tienda.enCriolloGeneral}</p>
              </div>

              <ul class="service-checklist">
                <li><strong>Opción Catálogo en tu WhatsApp Business:</strong> Saco fotos de hasta 30 productos en tu negocio y te dejo el catálogo listo adentro de tu WhatsApp.</li>
                <li><strong>Opción Tienda Online (Tienda Nube / Empretienda):</strong> Tu propia web con hasta 30 productos, pagos con Mercado Pago y envíos configurados.</li>
              </ul>
            </div>

            <button type="button" class="select-action-btn">
              ${isTO ? "✅ Elegido (Tocá para quitar)" : "Quiero cotizar mi Catálogo o Tienda Online"}
            </button>
          </div>
        </div>
      `;
    }

    // 4. TARJETA IMPRENTA INUCORN (Si el parámetro &inu está en la URL)
    if (state.enabledModules.inu) {
      html += renderInucornCardHTML();
    }

    container.innerHTML = html;
  }

  /**
   * Construye el link de WhatsApp directo a Imprenta Inucorn (+5493512692607)
   * con el mensaje hardcodeado usando el nombre del cliente definido en Admin.
   */
  function buildInucornWhatsAppUrl() {
    const clientLabel = state.clientName ? state.clientName : "cliente de Fran Estuvo Acá";
    const msg = `Hola! Soy ${clientLabel} y escribo porque me gustaría solicitar un presupuesto`;
    return `https://wa.me/${CFG.inucorn.whatsappNumber}?text=${encodeURIComponent(msg)}`;
  }

  function renderInucornCardHTML() {
    const inu = CFG.inucorn;
    const inuWspUrl = buildInucornWhatsAppUrl();
    return `
      <div class="inucorn-card">
        <div class="inucorn-header">
          <div style="flex:1; min-width:240px;">
            <div class="inucorn-title">${inu.titulo}</div>
            <p style="color:#5b21b6; font-size:0.95rem; margin-top:4px;">${inu.descripcion}</p>
          </div>
          <div class="coupon-pill">
            <span>Código: <strong>${inu.codigoCupon}</strong></span>
            <a href="${inuWspUrl}" target="_blank" rel="noopener noreferrer" class="inucorn-contact-btn">
              <span>💬 Contactar a Inucorn ↗</span>
              <small>(Se abre en pestaña nueva)</small>
            </a>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // 5. PASO 2: CANTIDADES, MESES Y MATRIZ HIPER-ACCESIBLE
  // ==========================================================================

  function renderStep2() {
    const container = document.getElementById("step-2-content");
    const totals = calculateGrandTotals();

    if (!totals.hasStep1Selection) {
      container.innerHTML = `
        <div class="section-header-box" style="text-align:center; padding:36px 20px;">
          <h2>Todavía no elegiste ningún servicio en el Paso 1</h2>
          <p style="margin:10px 0 20px;">Volvé al Paso 1 y tocá al menos una opción para ver sus combinaciones de cantidad y tiempo.</p>
          <button type="button" class="btn-primary" data-action="goto-step" data-step="1">⬅ Volver al Paso 1</button>
        </div>
      `;
      return;
    }

    let html = `
      <div class="section-header-box">
        <h2>Paso 2: Elegí cantidad y meses para ver tu cotización</h2>
        <p>Tocá los botones de cada paso o hacé clic directo en cualquier casillero de la tabla comparativa para armar la combinación que mejor te cierre.</p>
      </div>
    `;

    // A) CONFIGURADOR DE VIDEOS
    if (state.selectedVideoMode) {
      html += renderVideoConfiguratorHTML();
    }

    // B) CONFIGURADOR DE CM
    if (state.selectedCM) {
      html += renderCMConfiguratorHTML();
    }

    // C) CONFIGURADOR DE TIENDA ONLINE / CATÁLOGO
    if (state.selectedTienda) {
      html += renderTiendaConfiguratorHTML();
    }

    // D) TARJETA INUCORN SI ESTÁ ACTIVA
    if (state.enabledModules.inu) {
      html += renderInucornCardHTML();
    }

    container.innerHTML = html;
  }

  function renderVideoConfiguratorHTML() {
    const mode = CFG.videos.modalidades[state.selectedVideoMode];
    const vq = calculateVideosQuote(state.selectedVideoMode, state.videoQty, state.videoMonths);

    // Botones de cantidades rápidas (1 a 6)
    const quickQtys = [1, 2, 3, 4, 5, 6];
    const qtyCardsHTML = quickQtys
      .map((q) => {
        const sim = calculateVideosQuote(state.selectedVideoMode, q, 1);
        const unitDisc = getVideoUnitDiscountPct(q);
        const isActive = state.videoQty === q;
        return `
          <button type="button" class="qty-card-btn ${isActive ? "active" : ""}" data-action="set-video-qty" data-qty="${q}">
            <span class="qty-num">${q} ${q === 1 ? "video" : "videos"}/mes</span>
            <span class="qty-discount-pill">
              ${q === 1 ? "Precio base" : `${q}° video al ${unitDisc}% OFF`}
            </span>
            <span class="qty-price-sub">${formatARS(sim.monthlyWithVolumeDiscount)} / mes</span>
          </button>
        `;
      })
      .join("");

    // Tarjetas de Meses (1, 2, 3, 6)
    const monthCardsHTML = CFG.mesesOpciones
      .map((m) => {
        const isActive = state.videoMonths === m.meses;
        const sim = state.videoQty
          ? calculateVideosQuote(state.selectedVideoMode, state.videoQty, m.meses)
          : null;

        return `
          <div class="month-card-btn ${isActive ? "active" : ""}" data-action="set-video-months" data-months="${m.meses}">
            <div>
              ${m.badge ? `<span class="month-top-badge">${m.badge}</span>` : ""}
              <div class="month-title">
                <span>${m.etiqueta}</span>
                ${m.descuentoPct > 0 ? `<span class="month-off-tag">-${m.descuentoPct}% OFF</span>` : ""}
              </div>
              <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:2px;">${m.subtitulo}</div>
            </div>
            <div>
              ${
                sim && sim.isComplete
                  ? `
                    <div class="month-total-price">${formatARS(sim.totalFinal)} <small style="font-size:0.78rem; font-weight:600; color:var(--text-muted);">total</small></div>
                    ${
                      m.meses > 1
                        ? `<div style="font-size:0.82rem; color:var(--text-secondary);">Equivale a <strong>${formatARS(sim.effectivePerMonth)}/mes</strong></div>`
                        : `<div style="font-size:0.82rem; color:var(--text-muted);">Pago de 1 solo mes</div>`
                    }
                    ${
                      sim.totalSaved > 0
                        ? `<div class="month-savings-text">🎉 Ahorrás ${formatARS(sim.totalSaved)}</div>`
                        : ""
                    }
                  `
                  : `<div style="font-size:0.85rem; font-weight:700; color:var(--primary); margin-top:6px;">Elegí cantidad de videos arriba o tocá la tabla abajo</div>`
              }
            </div>
          </div>
        `;
      })
      .join("");

    // Matriz Comparativa Interactiva (Filas: 1, 2, 3, 4, 5, 6 videos | Columnas: 1, 2, 3, 6 meses)
    const matrixRows = [1, 2, 3, 4, 5, 6];
    if (state.videoQty && state.videoQty > 6 && !matrixRows.includes(state.videoQty)) {
      matrixRows.push(state.videoQty);
    }

    const matrixBodyHTML = matrixRows
      .map((rowQty) => {
        const cellsHTML = CFG.mesesOpciones
          .map((m) => {
            const cellQuote = calculateVideosQuote(state.selectedVideoMode, rowQty, m.meses);
            const isSelected = state.videoQty === rowQty && state.videoMonths === m.meses;
            return `
              <td class="matrix-cell ${isSelected ? "selected-cell" : ""}" data-action="pick-video-matrix" data-qty="${rowQty}" data-months="${m.meses}">
                <span class="cell-main-price">${isSelected ? "✅ " : ""}${formatARS(cellQuote.totalFinal)}</span>
                <span class="cell-per-month">${formatARS(cellQuote.effectivePerVideo)} c/video</span>
                ${
                  cellQuote.totalSaved > 0
                    ? `<span class="cell-save-badge">Ahorrás ${formatARS(cellQuote.totalSaved)}</span>`
                    : ""
                }
              </td>
            `;
          })
          .join("");

        return `
          <tr>
            <th>
              ${rowQty} ${rowQty === 1 ? "video" : "videos"}/mes
              <div style="font-size:0.75rem; font-weight:600; color:var(--text-muted);">
                (${rowQty * 1} a ${rowQty * 6} videos totales)
              </div>
            </th>
            ${cellsHTML}
          </tr>
        `;
      })
      .join("");

    const subtotalHTML = vq.isComplete
      ? `
        <div class="service-subtotal-bar">
          <div class="subtotal-details">
            <h4>✅ Tu selección de Videos: ${state.videoQty} ${
          state.videoQty === 1 ? "video" : "videos"
        }/mes durante ${state.videoMonths} ${state.videoMonths === 1 ? "mes" : "meses"} (${
          state.videoQty * state.videoMonths
        } videos en total)</h4>
            <p>
              Modalidad: ${mode.nombre} • Te queda cada video a un promedio de <strong>${formatARS(
          vq.effectivePerVideo
        )}</strong>
              ${mode.requiereTraslado ? renderTravelNoteInline() : ""}
            </p>
          </div>
          <div class="subtotal-numbers">
            ${
              vq.totalSaved > 0
                ? `<div class="price-strikethrough">Precio normal: ${formatARS(vq.totalRawAllMonths)}</div>`
                : ""
            }
            <div class="subtotal-final-amount">${formatARS(vq.totalFinal)}</div>
            ${
              vq.totalSaved > 0
                ? `<div style="font-size:0.85rem; font-weight:800; color:var(--success);">¡Te ahorrás ${formatARS(
                    vq.totalSaved
                  )}!</div>`
                : ""
            }
          </div>
        </div>
      `
      : `
        <div class="service-subtotal-bar" style="background:#eff6ff; border-color:var(--primary);">
          <div class="subtotal-details">
            <h4 style="color:#1e40af;">👆 Elegí tu combinación de Videos y Meses</h4>
            <p style="color:#1e3a8a;">
              ${
                !state.videoQty && !state.videoMonths
                  ? "Tocá cuántos videos querés (A) y por cuántos meses (B), o hacé clic directo en cualquier casillero de la tabla comparativa."
                  : !state.videoQty
                  ? "Ya elegiste los meses. Ahora tocá arriba cuántos videos por mes querés."
                  : "Ya elegiste la cantidad de videos. Ahora tocá por cuántos meses (1, 2, 3 o 6 meses) querés contratar."
              }
            </p>
          </div>
        </div>
      `;

    return `
      <div class="configurator-block">
        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">
          <h3 class="configurator-block-title">🎬 Videos (${mode.nombreCorto})</h3>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button type="button" class="btn-secondary" style="padding:6px 12px; font-size:0.85rem; ${
              state.selectedVideoMode === "graboEdiPubli"
                ? "border-color:var(--primary); background:var(--primary-light); color:var(--primary-hover);"
                : ""
            }" data-action="switch-video-mode" data-mode="graboEdiPubli">
              Con Grabación (${formatARS(CFG.videos.modalidades.graboEdiPubli.precioBase)} base)
            </button>
            <button type="button" class="btn-secondary" style="padding:6px 12px; font-size:0.85rem; ${
              state.selectedVideoMode === "ediPubli"
                ? "border-color:var(--primary); background:var(--primary-light); color:var(--primary-hover);"
                : ""
            }" data-action="switch-video-mode" data-mode="ediPubli">
              Solo Edición (${formatARS(CFG.videos.modalidades.ediPubli.precioBase)} base)
            </button>
          </div>
        </div>

        <p style="color:var(--text-secondary); font-size:0.96rem;">
          <strong>¿Cómo funcionan los descuentos por cantidad?</strong> El 1° video del mes vale ${formatARS(mode.precioBase)}, el 2° tiene <strong>10% OFF</strong>, el 3° <strong>20% OFF</strong>, el 4° <strong>30% OFF</strong>, el 5° <strong>40% OFF</strong> y del 6° video en adelante te quedan a <strong>MITAD DE PRECIO (50% OFF c/u)</strong>.
        </p>

        <!-- PASO A: CANTIDAD DE VIDEOS -->
        <div class="question-label">
          <span class="step-badge-mini">A</span>
          <span>¿Cuántos videos querés publicar por mes?</span>
        </div>

        <div class="qty-grid">
          ${qtyCardsHTML}
        </div>

        <div class="custom-qty-bar">
          <span style="font-weight:700; font-size:0.95rem;">¿Querés más de 6 videos por mes? Ajustalo acá (del 6° en adelante van todos al 50% OFF):</span>
          <div class="counter-controls">
            <button type="button" class="counter-btn" data-action="step-video-qty" data-delta="-1">−</button>
            <span class="counter-val">${state.videoQty ? `${state.videoQty} / mes` : "Sin elegir"}</span>
            <button type="button" class="counter-btn" data-action="step-video-qty" data-delta="1">+</button>
          </div>
        </div>

        <!-- PASO B: MESES A PRE-CONTRATAR -->
        <div class="question-label">
          <span class="step-badge-mini">B</span>
          <span>¿Por cuántos meses querés congelar el precio?</span>
        </div>

        <div class="prepay-banner">
          <span class="prepay-banner-icon">🛡️</span>
          <div>
            <strong>Ventaja por Pago Adelantado:</strong> Si elegís 2, 3 o 6 meses, se abonan por adelantado con <strong>doble beneficio</strong>: te llevás un <strong>10%, 20% o 30% de descuento extra sobre el total</strong> y <strong>CONGELÁS EL PRECIO HOY</strong> sin aumentos durante todos esos meses.
          </div>
        </div>

        <div class="months-grid">
          ${monthCardsHTML}
        </div>

        <!-- TABLA COMPARATIVA DE UN VISTAZO -->
        <div class="matrix-toggle-box">
          <div class="matrix-intro">
            📊 <strong>Matriz Comparativa (Videos vs. Meses):</strong> Tocá directamente cualquier casillero de la tabla para elegir esa combinación de un solo clic:
          </div>
          <div class="matrix-scroll-wrapper">
            <table class="comparison-matrix">
              <thead>
                <tr>
                  <th>Videos por mes</th>
                  ${CFG.mesesOpciones
                    .map(
                      (m) => `
                        <th>
                          ${m.etiqueta}
                          <span class="th-sub">${
                            m.descuentoPct > 0 ? `-${m.descuentoPct}% OFF Total` : "Sin dto. extra"
                          }</span>
                        </th>
                      `
                    )
                    .join("")}
                </tr>
              </thead>
              <tbody>
                ${matrixBodyHTML}
              </tbody>
            </table>
          </div>
        </div>

        ${subtotalHTML}
      </div>
    `;
  }

  function renderCMConfiguratorHTML() {
    const cmq = calculateCMQuote(state.cmPlanId, state.cmMonths);

    const plansCardsHTML = CFG.cm.planes
      .map((plan) => {
        const isSelected = state.cmPlanId === plan.id;
        return `
          <div class="service-card ${isSelected ? "selected" : ""}" data-action="set-cm-plan" data-plan="${plan.id}">
            <div class="service-card-top">
              <span class="service-badge">${isSelected ? "✅ Plan Elegido" : plan.badge}</span>
              <h4 class="service-title">${plan.nombre}</h4>
              <div class="service-price-tag">
                ${formatARS(plan.precioMensual)} <small>/ mes (valor base)</small>
              </div>
              <p style="font-size:0.93rem; color:var(--text-secondary); margin-bottom:10px;">
                ${plan.enCriollo}
              </p>
              <ul class="service-checklist">
                ${plan.resumenCorto.map((r) => `<li>${r}</li>`).join("")}
              </ul>
              <details class="plan-details-accordion" onclick="event.stopPropagation()">
                <summary>Ver los ${plan.detalleCompleto.length} puntos que incluye este plan</summary>
                <ul class="service-checklist" style="margin-top:8px;">
                  ${plan.detalleCompleto.map((d) => `<li>${d}</li>`).join("")}
                </ul>
              </details>
            </div>
            <button type="button" class="select-action-btn">
              ${isSelected ? "✅ Plan Seleccionado" : `Elegir ${plan.nombre}`}
            </button>
          </div>
        `;
      })
      .join("");

    const cmMonthsHTML = CFG.mesesOpciones
      .map((m) => {
        const isActive = state.cmMonths === m.meses;
        const sim = state.cmPlanId ? calculateCMQuote(state.cmPlanId, m.meses) : null;
        return `
          <div class="month-card-btn ${isActive ? "active" : ""}" data-action="set-cm-months" data-months="${m.meses}">
            <div>
              ${m.badge ? `<span class="month-top-badge">${m.badge}</span>` : ""}
              <div class="month-title">
                <span>${m.etiqueta}</span>
                ${m.descuentoPct > 0 ? `<span class="month-off-tag">-${m.descuentoPct}% OFF</span>` : ""}
              </div>
              <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:2px;">${m.subtitulo}</div>
            </div>
            <div>
              ${
                sim && sim.isComplete
                  ? `
                    <div class="month-total-price">${formatARS(sim.totalFinal)} <small style="font-size:0.78rem; font-weight:600; color:var(--text-muted);">total</small></div>
                    ${
                      m.meses > 1
                        ? `<div style="font-size:0.82rem; color:var(--text-secondary);">Te queda en <strong>${formatARS(sim.effectivePerMonth)}/mes</strong></div>`
                        : `<div style="font-size:0.82rem; color:var(--text-muted);">Pago de 1 mes</div>`
                    }
                    ${
                      sim.totalSaved > 0
                        ? `<div class="month-savings-text">🎉 Ahorrás ${formatARS(sim.totalSaved)}</div>`
                        : ""
                    }
                  `
                  : `<div style="font-size:0.85rem; font-weight:700; color:var(--primary); margin-top:6px;">Elegí un plan arriba o tocá la tabla abajo</div>`
              }
            </div>
          </div>
        `;
      })
      .join("");

    // Matriz comparativa de Planes CM vs Meses
    const cmMatrixRowsHTML = CFG.cm.planes
      .map((p) => {
        const cells = CFG.mesesOpciones
          .map((m) => {
            const sim = calculateCMQuote(p.id, m.meses);
            const isSel = state.cmPlanId === p.id && state.cmMonths === m.meses;
            return `
              <td class="matrix-cell ${isSel ? "selected-cell" : ""}" data-action="pick-cm-matrix" data-plan="${p.id}" data-months="${m.meses}">
                <span class="cell-main-price">${isSel ? "✅ " : ""}${formatARS(sim.totalFinal)}</span>
                <span class="cell-per-month">${formatARS(sim.effectivePerMonth)} / mes</span>
                ${
                  sim.totalSaved > 0
                    ? `<span class="cell-save-badge">Ahorrás ${formatARS(sim.totalSaved)}</span>`
                    : ""
                }
              </td>
            `;
          })
          .join("");

        return `
          <tr>
            <th>${p.nombre}</th>
            ${cells}
          </tr>
        `;
      })
      .join("");

    const cmSubtotalHTML = cmq.isComplete
      ? `
        <div class="service-subtotal-bar">
          <div class="subtotal-details">
            <h4>✅ Tu Plan CM: ${cmq.plan.nombre} por ${state.cmMonths} ${
          state.cmMonths === 1 ? "mes" : "meses"
        }</h4>
            <p>Valor mensual equivalente: <strong>${formatARS(cmq.effectivePerMonth)} / mes</strong></p>
          </div>
          <div class="subtotal-numbers">
            ${
              cmq.totalSaved > 0
                ? `<div class="price-strikethrough">Precio normal: ${formatARS(cmq.totalRawAllMonths)}</div>`
                : ""
            }
            <div class="subtotal-final-amount">${formatARS(cmq.totalFinal)}</div>
            ${
              cmq.totalSaved > 0
                ? `<div style="font-size:0.85rem; font-weight:800; color:var(--success);">¡Te ahorrás ${formatARS(
                    cmq.totalSaved
                  )}!</div>`
                : ""
            }
          </div>
        </div>
      `
      : `
        <div class="service-subtotal-bar" style="background:#eff6ff; border-color:var(--primary);">
          <div class="subtotal-details">
            <h4 style="color:#1e40af;">👆 Elegí tu Plan de Redes y Meses</h4>
            <p style="color:#1e3a8a;">
              ${
                !state.cmPlanId && !state.cmMonths
                  ? "Elegí cuál de los 3 planes te gusta (A) y por cuántos meses (B), o tocá directamente un casillero de la tabla comparativa."
                  : !state.cmPlanId
                  ? "Ya elegiste los meses. Ahora tocá arriba cuál de los 3 planes de CM preferís."
                  : "Ya elegiste el plan. Ahora tocá por cuántos meses (1, 2, 3 o 6 meses) querés contratarlo."
              }
            </p>
          </div>
        </div>
      `;

    return `
      <div class="configurator-block">
        <h3 class="configurator-block-title">📱 Manejo de Redes Sociales (Community Manager)</h3>
        <p style="color:var(--text-secondary); font-size:0.96rem;">
          Elegí el plan según la cantidad de movimiento semanal que quieras para tu negocio y por cuántos meses querés congelar el precio.
        </p>

        <div class="question-label">
          <span class="step-badge-mini">A</span>
          <span>Elegí cuál de los 3 planes se adapta mejor a tu negocio:</span>
        </div>

        <div class="service-cards-grid">
          ${plansCardsHTML}
        </div>

        <div class="question-label" style="margin-top:24px;">
          <span class="step-badge-mini">B</span>
          <span>¿Por cuántos meses querés congelar el valor del plan?</span>
        </div>

        <div class="prepay-banner">
          <span class="prepay-banner-icon">🛡️</span>
          <div>
            <strong>Congelá el valor mensual:</strong> Pre-contratando 2, 3 o 6 meses por adelantado te asegurás de que <strong>no haya aumentos por inflación</strong> y recibís hasta un <strong>30% de descuento directo</strong>.
          </div>
        </div>

        <div class="months-grid">
          ${cmMonthsHTML}
        </div>

        <!-- TABLA COMPARATIVA DE PLANES CM VS MESES -->
        <div class="matrix-toggle-box">
          <div class="matrix-intro">
            📊 <strong>Matriz Comparativa (Planes CM vs. Meses):</strong> Tocá cualquier casillero para elegir plan y meses en un solo clic:
          </div>
          <div class="matrix-scroll-wrapper">
            <table class="comparison-matrix">
              <thead>
                <tr>
                  <th>Plan de CM</th>
                  ${CFG.mesesOpciones
                    .map(
                      (m) => `
                        <th>
                          ${m.etiqueta}
                          <span class="th-sub">${
                            m.descuentoPct > 0 ? `-${m.descuentoPct}% OFF` : "1 mes"
                          }</span>
                        </th>
                      `
                    )
                    .join("")}
                </tr>
              </thead>
              <tbody>
                ${cmMatrixRowsHTML}
              </tbody>
            </table>
          </div>
        </div>

        ${cmSubtotalHTML}
      </div>
    `;
  }

  function renderTiendaConfiguratorHTML() {
    const tq = calculateTiendaQuote();

    const cardsHTML = CFG.tienda.opciones
      .map((op) => {
        const isChecked = Boolean(state.tiendaOptions[op.id]);
        return `
          <div class="service-card ${isChecked ? "selected" : ""}" data-action="toggle-tienda-option" data-option="${op.id}">
            <div class="service-card-top">
              <span class="service-badge">${isChecked ? "✅ Incluido" : op.badge}</span>
              <h4 class="service-title">${op.nombre}</h4>
              <div class="service-price-tag">
                ${formatARS(op.precioUnico)} <small>(Pago único)</small>
              </div>
              <div class="criollo-box">
                <strong>💡 ¿En qué consiste?</strong>
                <p>${op.enCriollo}</p>
              </div>
              <ul class="service-checklist">
                ${op.incluye.map((i) => `<li>${i}</li>`).join("")}
              </ul>
            </div>
            <button type="button" class="select-action-btn">
              ${isChecked ? "✅ Seleccionado (Tocá para quitar)" : "Elegir esta opción ($50.000 pago único)"}
            </button>
          </div>
        `;
      })
      .join("");

    const tiendaSubtotalHTML = tq.isComplete
      ? `
        <div class="service-subtotal-bar">
          <div class="subtotal-details">
            <h4>✅ Subtotal Catálogo / Tienda (Pago por única vez)</h4>
            <p>
              ${tq.chosen.map((c) => c.nombre).join(" + ")}
              ${renderTravelNoteInline()}
            </p>
          </div>
          <div class="subtotal-numbers">
            <div class="subtotal-final-amount">${formatARS(tq.total)}</div>
          </div>
        </div>
      `
      : `
        <div class="service-subtotal-bar" style="background:#eff6ff; border-color:var(--primary);">
          <div class="subtotal-details">
            <h4 style="color:#1e40af;">👆 Elegí qué opción de Catálogo o Tienda necesitás</h4>
            <p style="color:#1e3a8a;">Tocá una de las tarjetas de arriba (o ambas) para sumarla a tu presupuesto.</p>
          </div>
        </div>
      `;

    return `
      <div class="configurator-block">
        <h3 class="configurator-block-title">🛒 Catálogo Digital y Tienda Online (Pago Único)</h3>
        <p style="color:var(--text-secondary); font-size:0.96rem; margin-bottom:14px;">
          Podés elegir el armado de tu Catálogo en WhatsApp Business, tu Tienda Online (Tienda Nube / Empretienda), o ambos. Se pagan una sola vez y quedan listos para usar.
        </p>

        <div class="service-cards-grid">
          ${cardsHTML}
        </div>

        ${tiendaSubtotalHTML}
      </div>
    `;
  }

  function renderTravelNoteInline() {
    if (state.uberOneWay > 0) {
      const roundTrip = state.uberOneWay * 2;
      return ` • 🚗 <strong>Traslado estimado (Uber ida y vuelta):</strong> ${formatARS(
        roundTrip
      )} por visita presencial`;
    }
    return ` • 🚗 <strong>Traslado:</strong> Se coordina aparte según zona`;
  }

  // ==========================================================================
  // 6. PASO 3: RESUMEN FINAL Y CIERRE POR WHATSAPP ("PUM")
  // ==========================================================================

  function renderStep3() {
    const container = document.getElementById("step-3-content");
    const totals = calculateGrandTotals();

    if (!totals.allConfiguredInStep2) {
      container.innerHTML = `
        <div class="section-header-box" style="text-align:center; padding:36px 20px;">
          <h2>Te falta elegir la combinación de cantidad/tiempo en el Paso 2</h2>
          <p style="margin:10px 0 20px;">Pendiente: <strong>${totals.pendingSteps.join(", ") || "Seleccionar servicios"}</strong></p>
          <button type="button" class="btn-primary" data-action="goto-step" data-step="2">⬅ Volver al Paso 2</button>
        </div>
      `;
      return;
    }

    let itemsHTML = "";

    // Item Videos
    if (state.selectedVideoMode) {
      const mode = CFG.videos.modalidades[state.selectedVideoMode];
      const vq = calculateVideosQuote(state.selectedVideoMode, state.videoQty, state.videoMonths);
      itemsHTML += `
        <div class="summary-item">
          <div>
            <div class="summary-item-title">🎬 ${mode.nombre}</div>
            <div class="summary-item-desc">
              <strong>${state.videoQty} ${state.videoQty === 1 ? "video" : "videos"} por mes</strong> × <strong>${
        state.videoMonths
      } ${state.videoMonths === 1 ? "mes" : "meses"}</strong> (${
        state.videoQty * state.videoMonths
      } videos totales)
              <br/>
              Equivale a ${formatARS(vq.effectivePerMonth)}/mes (${formatARS(vq.effectivePerVideo)} por video)
            </div>
          </div>
          <div class="summary-item-price">
            ${
              vq.totalSaved > 0
                ? `<div class="price-strikethrough">${formatARS(vq.totalRawAllMonths)}</div>`
                : ""
            }
            <div>${formatARS(vq.totalFinal)}</div>
            ${
              vq.totalSaved > 0
                ? `<div style="font-size:0.8rem; color:var(--success);">Ahorrás ${formatARS(vq.totalSaved)}</div>`
                : ""
            }
          </div>
        </div>
      `;
    }

    // Item CM
    if (state.selectedCM) {
      const cmq = calculateCMQuote(state.cmPlanId, state.cmMonths);
      itemsHTML += `
        <div class="summary-item">
          <div>
            <div class="summary-item-title">📱 ${cmq.plan.nombre} (Community Manager)</div>
            <div class="summary-item-desc">
              Contratación por <strong>${state.cmMonths} ${
        state.cmMonths === 1 ? "mes" : "meses"
      }</strong> • Equivale a <strong>${formatARS(cmq.effectivePerMonth)}/mes</strong>
            </div>
          </div>
          <div class="summary-item-price">
            ${
              cmq.totalSaved > 0
                ? `<div class="price-strikethrough">${formatARS(cmq.totalRawAllMonths)}</div>`
                : ""
            }
            <div>${formatARS(cmq.totalFinal)}</div>
            ${
              cmq.totalSaved > 0
                ? `<div style="font-size:0.8rem; color:var(--success);">Ahorrás ${formatARS(cmq.totalSaved)}</div>`
                : ""
            }
          </div>
        </div>
      `;
    }

    // Item Tienda / Catálogo
    if (state.selectedTienda) {
      const tq = calculateTiendaQuote();
      tq.chosen.forEach((op) => {
        itemsHTML += `
          <div class="summary-item">
            <div>
              <div class="summary-item-title">🛒 ${op.nombre}</div>
              <div class="summary-item-desc">Pago por única vez (hasta 30 productos incluidos)</div>
            </div>
            <div class="summary-item-price">
              <div>${formatARS(op.precioUnico)}</div>
            </div>
          </div>
        `;
      });
    }

    // Aclaración de Traslado / Viáticos
    let travelBoxHTML = "";
    if (totals.requiresTravel) {
      if (state.uberOneWay > 0) {
        const roundTrip = state.uberOneWay * 2;
        travelBoxHTML = `
          <div style="background:#f8fafc; border:1px solid var(--border); border-radius:var(--radius-sm); padding:12px 14px; margin-top:14px; font-size:0.95rem;">
            🚗 <strong>Viáticos / Traslado presencial:</strong> Costo estimado de Uber ida y vuelta desde mi base hasta tu negocio: <strong>${formatARS(
              roundTrip
            )} por cada visita de grabación/fotografía</strong>.
          </div>
        `;
      } else {
        travelBoxHTML = `
          <div style="background:#f8fafc; border:1px solid var(--border); border-radius:var(--radius-sm); padding:12px 14px; margin-top:14px; font-size:0.95rem;">
            🚗 <strong>Nota sobre Traslado / Viáticos:</strong> En los servicios presenciales (grabación en el local o toma de fotografías), el traslado se coordina aparte según la zona (costo de Uber ida y vuelta).
          </div>
        `;
      }
    }

    const wspUrl = buildWhatsAppUrl();

    container.innerHTML = `
      <div class="section-header-box">
        <h2>Paso 3: ¡Tu presupuesto está listo!</h2>
        <p>Revisá el resumen de lo que armaste. Al tocar el botón verde se abre tu WhatsApp con todo este detalle escrito para que coordinemos y arranquemos.</p>
      </div>

      <div class="summary-card">
        <h3 style="font-size:1.3rem; font-weight:900; margin-bottom:8px;">
          📋 Resumen de tu Selección ${state.clientName ? `para ${state.clientName}` : ""}
        </h3>

        ${itemsHTML}

        ${travelBoxHTML}

        <div class="prepay-banner" style="margin-top:16px; margin-bottom:0;">
          <span class="prepay-banner-icon">🔒</span>
          <div>
            <strong>Precio Congelado:</strong> Recordá que los planes de meses a futuro se abonan por adelantado y te garantizan mantener exactamente este valor sin sufrir aumentos.
          </div>
        </div>

        <div class="summary-total-box">
          <div>
            <div class="summary-total-label">TOTAL PRESUPUESTADO</div>
            ${
              totals.totalSaved > 0
                ? `<span class="summary-savings-pill">🎉 Estás ahorrando ${formatARS(
                    totals.totalSaved
                  )} sobre el precio de lista</span>`
                : `<span style="font-size:0.9rem; color:#cbd5e1;">Podés volver al Paso 2 si querés sumar meses con descuento</span>`
            }
          </div>
          <div class="summary-grand-total">${formatARS(totals.totalFinal)}</div>
        </div>

        <a href="${wspUrl}" target="_blank" rel="noopener noreferrer" class="whatsapp-cta-btn">
          <span>💬 Enviar esta cotización por WhatsApp a Fran</span>
        </a>
      </div>

      ${state.enabledModules.inu ? renderInucornCardHTML() : ""}
    `;
  }

  function buildWhatsAppUrl() {
    const totals = calculateGrandTotals();
    const lines = [];

    if (state.clientName) {
      lines.push(`¡Hola Fran! Soy de *${state.clientName}*.`);
    } else {
      lines.push(`¡Hola Fran!`);
    }

    lines.push(`Estuve armando mi presupuesto en tu cotizador web y me interesa avanzar con esta opción:`);
    lines.push(``);

    if (state.selectedVideoMode) {
      const mode = CFG.videos.modalidades[state.selectedVideoMode];
      const vq = calculateVideosQuote(state.selectedVideoMode, state.videoQty, state.videoMonths);
      if (vq.isComplete) {
        lines.push(
          `🎬 *VIDEOS (${mode.nombre}):* ${state.videoQty} ${
            state.videoQty === 1 ? "video" : "videos"
          }/mes x ${state.videoMonths} ${state.videoMonths === 1 ? "mes" : "meses"} (${
            state.videoQty * state.videoMonths
          } videos en total) -> *${formatARS(vq.totalFinal)}*`
        );
      }
    }

    if (state.selectedCM) {
      const cmq = calculateCMQuote(state.cmPlanId, state.cmMonths);
      if (cmq.isComplete) {
        lines.push(
          `📱 *REDES SOCIALES (${cmq.plan.nombre}):* Plan por ${state.cmMonths} ${
            state.cmMonths === 1 ? "mes" : "meses"
          } (${formatARS(cmq.effectivePerMonth)}/mes) -> *${formatARS(cmq.totalFinal)}*`
        );
      }
    }

    if (state.selectedTienda) {
      const tq = calculateTiendaQuote();
      tq.chosen.forEach((op) => {
        lines.push(`🛒 *${op.nombre}:* Pago único -> *${formatARS(op.precioUnico)}*`);
      });
    }

    lines.push(``);
    lines.push(`💰 *TOTAL COTIZADO:* *${formatARS(totals.totalFinal)}*`);
    if (totals.totalSaved > 0) {
      lines.push(`✅ *(Ahorro aplicado por volumen/meses adelantados: ${formatARS(totals.totalSaved)})*`);
    }

    if (totals.requiresTravel) {
      if (state.uberOneWay > 0) {
        lines.push(`🚗 *Traslado estimado (Uber ida y vuelta):* ${formatARS(state.uberOneWay * 2)} por visita`);
      } else {
        lines.push(`🚗 *Traslado presencial:* A coordinar según zona.`);
      }
    }

    lines.push(``);
    lines.push(`¿Coordinamos para avanzar?`);

    const encoded = encodeURIComponent(lines.join("\n"));
    return `https://wa.me/${CFG.whatsappNumber}?text=${encoded}`;
  }

  // ==========================================================================
  // 7. BARRA INFERIOR FLOTANTE Y RENDER GENERAL
  // ==========================================================================

  function renderStickyBar() {
    const totals = calculateGrandTotals();
    const labelEl = document.querySelector(".sticky-label");
    const amountEl = document.getElementById("sticky-amount");
    const savingsEl = document.getElementById("sticky-savings");
    const actionsEl = document.getElementById("sticky-actions");

    // En el Paso 1 NO mostramos ningún monto para no dar falsa idea de caro/barato antes de ver la matriz
    if (state.step === 1) {
      labelEl.textContent = "Paso 1 de 3";
      if (totals.step1Count === 0) {
        amountEl.textContent = "Elegí qué servicios cotizar";
        amountEl.style.fontSize = "1.1rem";
        savingsEl.textContent = "Tocá las tarjetas de arriba para seleccionarlas";
      } else {
        amountEl.textContent = `✅ ${totals.step1Count} ${
          totals.step1Count === 1 ? "servicio elegido" : "servicios elegidos"
        }`;
        amountEl.style.fontSize = "1.2rem";
        savingsEl.textContent = "Tocá 'Siguiente' para elegir cantidades, meses y ver precios";
      }
      savingsEl.style.display = "block";

      actionsEl.innerHTML = `
        <button type="button" class="btn-primary" data-action="goto-step" data-step="2">
          Siguiente: Cantidades y Meses ➔
        </button>
      `;
      return;
    }

    // En Paso 2 y Paso 3 mostramos el total de lo que el usuario ya haya elegido en la matriz
    amountEl.style.fontSize = "1.45rem";
    labelEl.textContent = "Total según tu combinación";
    amountEl.textContent = formatARS(totals.totalFinal);

    if (!totals.allConfiguredInStep2) {
      savingsEl.textContent = `Falta elegir: ${totals.pendingSteps.join(" • ")}`;
      savingsEl.style.color = "var(--accent-amber)";
      savingsEl.style.display = "block";
    } else if (totals.totalSaved > 0) {
      savingsEl.textContent = `🎉 Ahorrás ${formatARS(totals.totalSaved)} con esta combinación`;
      savingsEl.style.color = "var(--success)";
      savingsEl.style.display = "block";
    } else {
      savingsEl.textContent = "Sumá más meses para activar hasta 30% OFF";
      savingsEl.style.color = "var(--text-muted)";
      savingsEl.style.display = "block";
    }

    if (state.step === 2) {
      actionsEl.innerHTML = `
        <button type="button" class="btn-secondary" data-action="goto-step" data-step="1">⬅ Servicios</button>
        <button type="button" class="btn-primary" data-action="goto-step" data-step="3">
          Ver Resumen y Enviar ➔
        </button>
      `;
    } else {
      const wspUrl = buildWhatsAppUrl();
      actionsEl.innerHTML = `
        <button type="button" class="btn-secondary" data-action="goto-step" data-step="2">⬅ Ajustar</button>
        <a href="${wspUrl}" target="_blank" rel="noopener noreferrer" class="btn-primary" style="background:var(--whatsapp); text-decoration:none;">
          💬 Enviar por WhatsApp
        </a>
      `;
    }
  }

  function renderApp() {
    renderHeader();
    renderStepper();

    const s1 = document.getElementById("step-1-content");
    const s2 = document.getElementById("step-2-content");
    const s3 = document.getElementById("step-3-content");

    s1.style.display = state.step === 1 ? "block" : "none";
    s2.style.display = state.step === 2 ? "block" : "none";
    s3.style.display = state.step === 3 ? "block" : "none";

    if (state.step === 1) renderStep1();
    if (state.step === 2) renderStep2();
    if (state.step === 3) renderStep3();

    renderStickyBar();
  }

  // ==========================================================================
  // 8. MODO ADMIN PROTEGIDO CON HASH SHA-256 OFUSCADO
  // ==========================================================================

  async function sha256Hex(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function openAdminModal() {
    const modal = document.getElementById("admin-modal");
    modal.classList.remove("hidden");
  }

  function closeAdminModal() {
    const modal = document.getElementById("admin-modal");
    modal.classList.add("hidden");
  }

  async function verifyAdminPin() {
    const input = document.getElementById("admin-pin-input");
    const errorEl = document.getElementById("admin-pin-error");
    const pin = (input.value || "").trim();

    const salted = `${CFG.adminPinSalt}${pin}${CFG.adminPinSuffix}`;
    const computedHash = await sha256Hex(salted);

    if (computedHash === CFG.adminPinHash) {
      errorEl.style.display = "none";
      document.getElementById("admin-login-view").style.display = "none";
      document.getElementById("admin-panel-view").style.display = "block";
      updateAdminGeneratedUrl();
    } else {
      errorEl.style.display = "block";
      errorEl.textContent = "Contraseña incorrecta.";
    }
  }

  function updateAdminGeneratedUrl() {
    const baseUrl = window.location.origin + window.location.pathname;
    const chkV = document.getElementById("adm-chk-v").checked;
    const chkCM = document.getElementById("adm-chk-cm").checked;
    const chkTO = document.getElementById("adm-chk-to").checked;
    const chkINU = document.getElementById("adm-chk-inu").checked;
    const client = document.getElementById("adm-client-name").value.trim();
    const note = document.getElementById("adm-client-note").value.trim();
    const uber = parseInt(document.getElementById("adm-uber-cost").value.trim() || "0", 10);

    const parts = [];
    if (chkV) parts.push("v");
    if (chkCM) parts.push("cm");
    if (chkTO) parts.push("to");
    if (chkINU) parts.push("inu");
    if (client) parts.push(`c=${encodeURIComponent(client)}`);
    if (note) parts.push(`nota=${encodeURIComponent(note)}`);
    if (uber > 0) parts.push(`uber=${uber}`);

    const finalUrl = parts.length > 0 ? `${baseUrl}?${parts.join("&")}` : baseUrl;
    document.getElementById("adm-generated-url").textContent = finalUrl;
    return finalUrl;
  }

  // ==========================================================================
  // 9. MANEJO DE EVENTOS (DELEGACIÓN GLOBAL)
  // ==========================================================================

  function setupEventListeners() {
    document.body.addEventListener("click", (e) => {
      const target = e.target.closest("[data-action]");
      if (!target) return;

      const action = target.getAttribute("data-action");

      switch (action) {
        case "select-video-mode": {
          const mode = target.getAttribute("data-mode");
          if (state.selectedVideoMode === mode) {
            state.selectedVideoMode = null;
            state.videoQty = null;
            state.videoMonths = null;
          } else {
            state.selectedVideoMode = mode;
          }
          renderApp();
          break;
        }

        case "switch-video-mode": {
          const mode = target.getAttribute("data-mode");
          state.selectedVideoMode = mode;
          renderApp();
          break;
        }

        case "toggle-cm": {
          state.selectedCM = !state.selectedCM;
          if (!state.selectedCM) {
            state.cmPlanId = null;
            state.cmMonths = null;
          }
          renderApp();
          break;
        }

        case "toggle-tienda": {
          state.selectedTienda = !state.selectedTienda;
          if (!state.selectedTienda) {
            state.tiendaOptions.catalogoWsp = false;
            state.tiendaOptions.tiendaNube = false;
          }
          renderApp();
          break;
        }

        case "set-video-qty": {
          state.videoQty = parseInt(target.getAttribute("data-qty"), 10);
          renderApp();
          break;
        }

        case "step-video-qty": {
          const delta = parseInt(target.getAttribute("data-delta"), 10);
          const current = state.videoQty || 6;
          state.videoQty = Math.max(1, Math.min(30, current + delta));
          renderApp();
          break;
        }

        case "set-video-months": {
          state.videoMonths = parseInt(target.getAttribute("data-months"), 10);
          renderApp();
          break;
        }

        case "pick-video-matrix": {
          state.videoQty = parseInt(target.getAttribute("data-qty"), 10);
          state.videoMonths = parseInt(target.getAttribute("data-months"), 10);
          renderApp();
          break;
        }

        case "set-cm-plan": {
          state.cmPlanId = target.getAttribute("data-plan");
          renderApp();
          break;
        }

        case "set-cm-months": {
          state.cmMonths = parseInt(target.getAttribute("data-months"), 10);
          renderApp();
          break;
        }

        case "pick-cm-matrix": {
          state.cmPlanId = target.getAttribute("data-plan");
          state.cmMonths = parseInt(target.getAttribute("data-months"), 10);
          renderApp();
          break;
        }

        case "toggle-tienda-option": {
          const opId = target.getAttribute("data-option");
          state.tiendaOptions[opId] = !state.tiendaOptions[opId];
          renderApp();
          break;
        }

        case "goto-step": {
          const nextStep = parseInt(target.getAttribute("data-step"), 10);
          const totals = calculateGrandTotals();

          if (nextStep >= 2 && !totals.hasStep1Selection) {
            alert("Por favor elegí al menos un servicio en el Paso 1 para continuar.");
            return;
          }
          if (nextStep === 3 && !totals.allConfiguredInStep2) {
            alert(
              "Antes de ver el resumen final, elegí la combinación en: " +
                totals.pendingSteps.join(", ")
            );
            return;
          }

          state.step = nextStep;
          renderApp();
          window.scrollTo({ top: 0, behavior: "smooth" });
          break;
        }

        case "open-admin": {
          openAdminModal();
          break;
        }

        case "close-admin": {
          closeAdminModal();
          break;
        }

        case "verify-admin-pin": {
          verifyAdminPin();
          break;
        }

        case "copy-admin-url": {
          const url = updateAdminGeneratedUrl();
          navigator.clipboard.writeText(url);
          target.textContent = "✅ ¡Link copiado al portapapeles!";
          setTimeout(() => {
            target.textContent = "📋 Copiar Link para el Cliente";
          }, 2000);
          break;
        }

        case "test-admin-url": {
          const url = updateAdminGeneratedUrl();
          window.location.href = url;
          break;
        }
      }
    });

    const adminInputs = [
      "adm-chk-v",
      "adm-chk-cm",
      "adm-chk-to",
      "adm-chk-inu",
      "adm-client-name",
      "adm-client-note",
      "adm-uber-cost"
    ];
    adminInputs.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("input", updateAdminGeneratedUrl);
        el.addEventListener("change", updateAdminGeneratedUrl);
      }
    });

    const pinInput = document.getElementById("admin-pin-input");
    if (pinInput) {
      pinInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          verifyAdminPin();
        }
      });
    }
  }

  // Inicialización
  document.addEventListener("DOMContentLoaded", () => {
    parseUrlParameters();
    setupEventListeners();
    renderApp();
  });
})();
