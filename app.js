/**
 * ============================================================================
 * RECORRIDO STEP-BY-STEP (ONE-PAGE FLOW) - FRAN ESTUVO ACÁ
 * ============================================================================
 */

(function () {
  const CFG = window.COTIZADOR_CONFIG;
  const DEFAULT_CFG = JSON.parse(JSON.stringify(window.COTIZADOR_CONFIG));

  function applyConfigOverrides(custom) {
    if (!custom) return;
    if (custom.videos) {
      if (
        custom.videos.graboEdiPubli !== undefined &&
        CFG.videos?.modalidades?.graboEdiPubli
      ) {
        CFG.videos.modalidades.graboEdiPubli.precioBase = Number(
          custom.videos.graboEdiPubli
        );
      }
      if (
        custom.videos.ediPubli !== undefined &&
        CFG.videos?.modalidades?.ediPubli
      ) {
        CFG.videos.modalidades.ediPubli.precioBase = Number(
          custom.videos.ediPubli
        );
      }
      if (custom.videos.descuentos && CFG.videos?.descuentoPorUnidad) {
        Object.keys(custom.videos.descuentos).forEach((u) => {
          const item = CFG.videos.descuentoPorUnidad.find(
            (d) => d.unidad === Number(u)
          );
          if (item) item.descuentoPct = Number(custom.videos.descuentos[u]);
        });
      }
    }
    if (custom.cm && CFG.cm?.planes) {
      if (custom.cm.presencia !== undefined) {
        const p = CFG.cm.planes.find((pl) => pl.id === "presencia");
        if (p) p.precioMensual = Number(custom.cm.presencia);
      }
      if (custom.cm.crecimiento !== undefined) {
        const p = CFG.cm.planes.find((pl) => pl.id === "crecimiento");
        if (p) p.precioMensual = Number(custom.cm.crecimiento);
      }
      if (custom.cm.total !== undefined) {
        const p = CFG.cm.planes.find((pl) => pl.id === "total");
        if (p) p.precioMensual = Number(custom.cm.total);
      }
    }
    if (custom.tienda && CFG.tienda) {
      if (custom.tienda.catalogoWsp !== undefined) {
        const o = CFG.tienda.opciones?.find((op) => op.id === "catalogoWsp");
        if (o) o.precioUnico = Number(custom.tienda.catalogoWsp);
      }
      if (custom.tienda.tiendaNube !== undefined) {
        const o = CFG.tienda.opciones?.find((op) => op.id === "tiendaNube");
        if (o) o.precioUnico = Number(custom.tienda.tiendaNube);
      }
      if (custom.tienda.ambos !== undefined) {
        CFG.tienda.precioAmbos = Number(custom.tienda.ambos);
      }
    }
    if (custom.meses && CFG.mesesOpciones) {
      Object.keys(custom.meses).forEach((m) => {
        const found = CFG.mesesOpciones.find((mo) => mo.meses === Number(m));
        if (found) found.descuentoPct = Number(custom.meses[m]);
      });
    }
    if (custom.inucorn && CFG.inucorn) {
      if (custom.inucorn.descuentoPct !== undefined) {
        CFG.inucorn.descuentoPct = Number(custom.inucorn.descuentoPct);
      }
    }
    if (custom.referidos && CFG.referidos) {
      if (custom.referidos.descuentoPct !== undefined) {
        CFG.referidos.descuentoPct = Number(custom.referidos.descuentoPct);
      }
    }
  }

  function loadPersistedConfig() {
    try {
      const saved = localStorage.getItem("FEA_CUSTOM_CONFIG");
      if (saved) {
        const custom = JSON.parse(saved);
        applyConfigOverrides(custom);
      }
    } catch (e) {
      console.warn("No se pudo cargar la configuración personalizada de localStorage", e);
    }
  }

  // Generador de código alfanumérico de 5 caracteres (distingue mayús de minús, sin símbolos)
  function generateReferralCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let code = "";
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Estado global
  const state = {
    // Parámetros de URL
    enabledModules: { v: false, cm: false, to: false, inu: false, ref: false },
    hasExplicitParams: false,
    clientName: "",
    businessName: "",
    customNote: "",
    uberOneWay: 0,

    // Decisiones del cliente
    selectedServices: { v: false, cm: false, to: false, inu: false, ref: false }, // Usado si entra sin parámetros
    inucornInterested: true, // Default checked según solicitud

    // Sistema de Referidos (25% OFF)
    myReferralCode: generateReferralCode(),
    inputReferredCode: "",
    wantToRefer: false, // Default desmarcado según solicitud

    videoMode: null, // 'graboEdiPubli' | 'ediPubli'
    videoQty: 4, // 1 a 30 videos por mes
    videoMonths: 3, // 1, 2, 3, 6 meses
    cmPlanId: null, // 'presencia' | 'crecimiento' | 'total' | 'skip'
    cmMonths: 3, // 1, 2, 3, 6 meses
    tiendaChoice: null, // 'catalogoWsp' | 'tiendaNube' | 'ambos' | 'skip'

    // Índice del paso actual en la cola activa
    currentStepIndex: 0,
  };

  // ==========================================================================
  // 1. CÁLCULOS MATEMÁTICOS DE PRECIOS Y DESCUENTOS
  // ==========================================================================

  function formatARS(num) {
    return "$" + Math.round(num).toLocaleString("es-AR");
  }

  function getVideoUnitDiscountPct(unitIndex1Based) {
    if (
      !CFG.videos ||
      !CFG.videos.descuentoPorUnidad ||
      !CFG.videos.descuentoPorUnidad.length
    ) {
      if (unitIndex1Based <= 1) return 0;
      if (unitIndex1Based === 2) return 10;
      if (unitIndex1Based === 3) return 20;
      if (unitIndex1Based === 4) return 30;
      if (unitIndex1Based === 5) return 40;
      return 50;
    }
    const found = CFG.videos.descuentoPorUnidad.find(
      (d) => d.unidad === unitIndex1Based
    );
    if (found) return found.descuentoPct;
    const last =
      CFG.videos.descuentoPorUnidad[CFG.videos.descuentoPorUnidad.length - 1];
    return last ? last.descuentoPct : 50;
  }

  function getMonthDiscountPct(months) {
    const found = CFG.mesesOpciones.find((m) => m.meses === Number(months));
    return found ? found.descuentoPct : 0;
  }

  function calculateVideosQuote(modeId, qtyPerMonth, months) {
    const mode = CFG.videos.modalidades[modeId];
    if (!mode || !qtyPerMonth || qtyPerMonth < 1) {
      return { totalFinal: 0, totalSaved: 0, totalRaw: 0, monthlyWithDisc: 0 };
    }

    const base = mode.precioBase;
    let monthlyWithVolumeDisc = 0;
    for (let i = 1; i <= qtyPerMonth; i++) {
      const discPct = getVideoUnitDiscountPct(i);
      monthlyWithVolumeDisc += base * (1 - discPct / 100);
    }

    const m = months || 1;
    const totalRaw = base * qtyPerMonth * m;
    const subtotalMonths = monthlyWithVolumeDisc * m;
    const monthDiscPct = getMonthDiscountPct(m);
    const totalFinal = subtotalMonths * (1 - monthDiscPct / 100);
    const totalSaved = totalRaw - totalFinal;

    return {
      mode,
      baseUnitPrice: base,
      monthlyWithDisc: monthlyWithVolumeDisc,
      totalFinal,
      totalSaved,
      totalRaw,
      effectivePerMonth: totalFinal / m,
      effectivePerVideo: totalFinal / (qtyPerMonth * m),
      monthDiscountPct: monthDiscPct,
    };
  }

  function calculateCMQuote(planId, months) {
    if (!planId || planId === "skip") {
      return { totalFinal: 0, totalSaved: 0, totalRaw: 0 };
    }
    const plan = CFG.cm.planes.find((p) => p.id === planId);
    if (!plan) return { totalFinal: 0, totalSaved: 0, totalRaw: 0 };

    const m = months || 1;
    const totalRaw = plan.precioMensual * m;
    const monthDiscPct = getMonthDiscountPct(m);
    const totalFinal = totalRaw * (1 - monthDiscPct / 100);
    const totalSaved = totalRaw - totalFinal;

    return {
      plan,
      totalFinal,
      totalSaved,
      totalRaw,
      effectivePerMonth: totalFinal / m,
      monthDiscountPct: monthDiscPct,
    };
  }

  function calculateTiendaQuote(choice) {
    if (!choice || choice === "skip") return { totalFinal: 0, label: "" };
    const wspObj = CFG.tienda?.opciones?.find((o) => o.id === "catalogoWsp");
    const nubeObj = CFG.tienda?.opciones?.find((o) => o.id === "tiendaNube");
    const wsp = wspObj ? wspObj.precioUnico : 50000;
    const nube = nubeObj ? nubeObj.precioUnico : 50000;
    const ambos =
      CFG.tienda?.precioAmbos !== undefined
        ? CFG.tienda.precioAmbos
        : wsp + nube;

    if (choice === "catalogoWsp") {
      return { totalFinal: wsp, label: "Catálogo en WhatsApp Business" };
    }
    if (choice === "tiendaNube") {
      return {
        totalFinal: nube,
        label: "Tienda Online (Tienda Nube / Empretienda)",
      };
    }
    if (choice === "ambos") {
      return {
        totalFinal: ambos,
        label: "Catálogo WhatsApp + Tienda Online",
      };
    }
    return { totalFinal: 0, label: "" };
  }

  function calculateRunningTotals() {
    let totalFinal = 0;
    let totalSaved = 0;

    // Solo sumamos videos si ya eligió modalidad
    if (state.videoMode) {
      const vq = calculateVideosQuote(
        state.videoMode,
        state.videoQty,
        state.videoMonths
      );
      totalFinal += vq.totalFinal;
      totalSaved += vq.totalSaved;
    }

    // Solo sumamos CM si ya eligió un plan activo
    if (state.cmPlanId && state.cmPlanId !== "skip") {
      const cmq = calculateCMQuote(state.cmPlanId, state.cmMonths);
      totalFinal += cmq.totalFinal;
      totalSaved += cmq.totalSaved;
    }

    // Solo sumamos tienda si ya eligió una opción
    if (state.tiendaChoice && state.tiendaChoice !== "skip") {
      const tq = calculateTiendaQuote(state.tiendaChoice);
      totalFinal += tq.totalFinal;
    }

    return { totalFinal, totalSaved };
  }

  // ==========================================================================
  // 2. PARSEADOR DE PARÁMETROS DE URL
  // ==========================================================================

  function parseUrlParameters() {
    const rawSearch = window.location.search.replace(/^\?/, "");
    const rawHash = window.location.hash.replace(/^#/, "");
    const combined = [rawSearch, rawHash].filter(Boolean).join("&");

    const params = new URLSearchParams(combined);
    const keysLower = Array.from(params.keys()).map((k) => k.toLowerCase());

    const hasV =
      keysLower.includes("v") ||
      keysLower.includes("vg") ||
      keysLower.includes("ve");
    const hasCM = keysLower.includes("cm");
    const hasTO = keysLower.includes("to");
    const hasINU = keysLower.includes("inu");
    const hasREF = keysLower.includes("ref");

    if (hasV || hasCM || hasTO || hasINU || hasREF) {
      state.hasExplicitParams = true;
      state.enabledModules.v = hasV;
      state.enabledModules.cm = hasCM;
      state.enabledModules.to = hasTO;
      state.enabledModules.inu = hasINU;
      state.enabledModules.ref = hasREF;
    } else {
      state.hasExplicitParams = false;
      state.enabledModules.v = false;
      state.enabledModules.cm = false;
      state.enabledModules.to = false;
      state.enabledModules.inu = false;
      state.enabledModules.ref = false;
    }

    const clientParam = params.get("c") || params.get("cliente") || "";
    state.clientName = clientParam.trim();

    const bizParam =
      params.get("b") ||
      params.get("biz") ||
      params.get("negocio") ||
      params.get("emprendimiento") ||
      "";
    state.businessName = bizParam.trim();

    const noteParam = params.get("nota") || "";
    state.customNote = noteParam.trim();

    const uberParam = parseInt(params.get("uber") || "0", 10);
    if (!isNaN(uberParam) && uberParam > 0) {
      state.uberOneWay = uberParam;
    }

    if (keysLower.includes("admin")) {
      setTimeout(() => openAdminModal(), 200);
    }
  }

  // ==========================================================================
  // 3. COLA DINÁMICA DE PASOS SEGÚN PARÁMETROS Y RESPUESTAS
  // ==========================================================================

  function getStepsQueue() {
    const queue = [];

    // Si no vinieron parámetros en la URL:
    // El paso 1 pregunta nombre y emprendimiento, y el paso 2 qué servicios quiere cotizar
    if (!state.hasExplicitParams) {
      queue.push({ id: "client_info", title: "Tus datos" });
      queue.push({ id: "select_services", title: "Servicios a cotizar" });
    }

    const wantsV = state.hasExplicitParams
      ? state.enabledModules.v
      : state.selectedServices.v;
    const wantsCM = state.hasExplicitParams
      ? state.enabledModules.cm
      : state.selectedServices.cm;
    const wantsTO = state.hasExplicitParams
      ? state.enabledModules.to
      : state.selectedServices.to;
    const wantsINU = state.hasExplicitParams
      ? state.enabledModules.inu
      : state.selectedServices.inu;
    const wantsREF = state.hasExplicitParams
      ? state.enabledModules.ref
      : state.selectedServices.ref;

    // Pasos de Videos
    if (wantsV) {
      queue.push({ id: "v_mode", title: "Modalidad de Videos" });
      queue.push({ id: "v_qty", title: "Cantidad de Videos" });
      queue.push({ id: "v_months", title: "Meses de Videos" });
    }

    // Pasos de CM
    if (wantsCM) {
      queue.push({ id: "cm_plan", title: "Plan de Redes (CM)" });
      if (state.cmPlanId && state.cmPlanId !== "skip") {
        queue.push({ id: "cm_months", title: "Meses de CM" });
      }
    }

    // Pasos de Tienda / Catálogo
    if (wantsTO) {
      queue.push({ id: "to_choice", title: "Catálogo / Tienda" });
    }

    // Paso de Beneficios / Cupones (Inucorn y/o Referidos en la misma pantalla)
    if (wantsINU || wantsREF) {
      queue.push({ id: "benefits_banner", title: "Beneficios y Descuentos" });
    }

    // Paso final: Resumen y cierre
    queue.push({ id: "summary", title: "Resumen y Cierre" });

    return queue;
  }

  function getCurrentStep() {
    const queue = getStepsQueue();
    if (state.currentStepIndex >= queue.length) {
      state.currentStepIndex = queue.length - 1;
    }
    if (state.currentStepIndex < 0) {
      state.currentStepIndex = 0;
    }
    return queue[state.currentStepIndex];
  }

  function advanceStep() {
    const queue = getStepsQueue();
    if (state.currentStepIndex < queue.length - 1) {
      state.currentStepIndex++;
      renderCurrentStep();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function prevStep() {
    if (state.currentStepIndex > 0) {
      state.currentStepIndex--;
      renderCurrentStep();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // ==========================================================================
  // 4. RENDERIZADO DEL PASO ACTUAL
  // ==========================================================================

  function renderHeaderAndNav() {
    const queue = getStepsQueue();
    const currentStep = getCurrentStep();
    const totalSteps = queue.length;
    const currentNumber = state.currentStepIndex + 1;

    // Barra de progreso
    const progressLabel = document.getElementById("progress-label");
    const progressBarFill = document.getElementById("progress-bar-fill");
    const btnBack = document.getElementById("btn-back");
    const brandBadge = document.getElementById("header-brand-badge");

    if (currentStep.id === "summary") {
      progressLabel.textContent = "Listo para enviar";
      progressBarFill.style.width = "100%";
    } else {
      progressLabel.textContent = `Paso ${currentNumber} de ${totalSteps}`;
      const pct = Math.round((currentNumber / totalSteps) * 100);
      progressBarFill.style.width = `${pct}%`;
    }

    // Botón volver
    btnBack.style.visibility = state.currentStepIndex > 0 ? "visible" : "hidden";

    // Nombre de marca o cliente
    if (state.clientName && state.businessName) {
      brandBadge.textContent = `${state.clientName} (${state.businessName})`;
    } else if (state.clientName) {
      brandBadge.textContent = state.clientName;
    } else if (state.businessName) {
      brandBadge.textContent = state.businessName;
    } else {
      brandBadge.textContent = "Fran Estuvo Acá";
    }
  }

  function renderBottomBar() {
    const bottomBar = document.getElementById("wizard-bottom-bar");
    const currentStep = getCurrentStep();

    // En el paso de resumen final ocultamos la barra flotante (el botón principal está en el centro)
    if (currentStep.id === "summary") {
      bottomBar.style.display = "none";
      return;
    }
    bottomBar.style.display = "block";

    const amountEl = document.getElementById("bottom-amount");
    const savingsEl = document.getElementById("bottom-savings");
    const labelEl = document.getElementById("bottom-label");

    // Si está en el formulario de datos o selector inicial de servicios, no calculamos montos todavía
    if (currentStep.id === "client_info" || currentStep.id === "select_services") {
      labelEl.textContent = "Presupuesto en armado";
      amountEl.textContent = currentStep.id === "client_info" ? "Tus datos" : "Marcá tus opciones";
      savingsEl.style.display = "none";
      return;
    }

    const totals = calculateRunningTotals();
    if (totals.totalFinal > 0) {
      labelEl.textContent = "Total acumulado";
      amountEl.textContent = formatARS(totals.totalFinal);
      if (totals.totalSaved > 0) {
        savingsEl.textContent = `Ahorrás ${formatARS(totals.totalSaved)}`;
        savingsEl.style.display = "inline-block";
      } else {
        savingsEl.style.display = "none";
      }
    } else {
      labelEl.textContent = "Presupuesto en armado";
      amountEl.textContent = "Elegí tu opción";
      savingsEl.style.display = "none";
    }
  }

  function renderCurrentStep() {
    renderHeaderAndNav();
    renderBottomBar();

    const area = document.getElementById("step-render-area");
    const step = getCurrentStep();

    let html = "";
    switch (step.id) {
      case "client_info":
        html = renderStep_ClientInfo();
        break;
      case "select_services":
        html = renderStep_SelectServices();
        break;
      case "v_mode":
        html = renderStep_VMode();
        break;
      case "v_qty":
        html = renderStep_VQty();
        break;
      case "v_months":
        html = renderStep_VMonths();
        break;
      case "cm_plan":
        html = renderStep_CMPlan();
        break;
      case "cm_months":
        html = renderStep_CMMonths();
        break;
      case "to_choice":
        html = renderStep_TOChoice();
        break;
      case "benefits_banner":
      case "inu_banner":
        html = renderStep_Benefits();
        break;
      case "summary":
        html = renderStep_Summary();
        break;
    }

    area.innerHTML = `<div class="step-screen">${html}</div>`;
  }

  // ==========================================================================
  // 5. VISTAS DE CADA PASO ("ONE-PAGES" CONCENTRADAS)
  // ==========================================================================

  // Paso 0: Formulario de datos iniciales (Solo si entra a la URL limpia sin parámetros)
  function renderStep_ClientInfo() {
    return `
      <div class="step-header">
        <div class="step-sticker-badge">¡Te damos la bienvenida!</div>
        <h1 class="step-question-title">¿Cómo te llamás y cuál es tu proyecto?</h1>
        <p class="step-question-subtitle">
          Completá tus datos para personalizar cada etapa de tu propuesta y preparar el mensaje listo para WhatsApp.
        </p>
      </div>

      <div class="client-info-card">
        <div class="lead-form-group">
          <label for="lead-client-name" class="lead-label">
            👤 Tu nombre o apodo <span class="label-req">*</span>
          </label>
          <input 
            type="text" 
            id="lead-client-name" 
            class="lead-input" 
            placeholder="Ej: Marcos / Laura" 
            value="${state.clientName || ""}" 
            autocomplete="name"
          />
        </div>

        <div class="lead-form-group">
          <label for="lead-business-name" class="lead-label">
            🏪 Nombre de tu negocio o emprendimiento
          </label>
          <input 
            type="text" 
            id="lead-business-name" 
            class="lead-input" 
            placeholder="Ej: Panadería Central / Taller Mecánico" 
            value="${state.businessName || ""}" 
            autocomplete="organization"
          />
        </div>

        <div class="lead-tip-box">
          💡 <strong>Tip:</strong> Si todavía estás en etapa de idea o no tenés nombre definitivo, podés dejarlo en blanco o poner tu rubro.
        </div>

        <button type="button" class="btn-primary" style="width:100%; justify-content:center; padding:16px; font-size:1.15rem; margin-top:10px;" data-action="submit-client-info">
          Elegir servicios a cotizar ➔
        </button>
      </div>
    `;
  }

  // Paso 1: Selector de servicios (Solo si entra a la URL limpia sin parámetros)
  function renderStep_SelectServices() {
    const isV = state.selectedServices.v;
    const isCM = state.selectedServices.cm;
    const isTO = state.selectedServices.to;
    const isInu = state.selectedServices.inu;
    const isRef = state.selectedServices.ref;

    let greetingText = "";
    if (state.clientName && state.businessName) {
      greetingText = `¡Hola ${state.clientName} (${state.businessName})! 👋`;
    } else if (state.clientName) {
      greetingText = `¡Hola ${state.clientName}! 👋`;
    } else if (state.businessName) {
      greetingText = `¡Hola gente de ${state.businessName}! 👋`;
    }

    return `
      <div class="step-header">
        ${greetingText ? `<div class="step-greeting-pill">${greetingText}</div>` : ""}
        <h1 class="step-question-title">¿Qué servicios te gustaría cotizar?</h1>
        <p class="step-question-subtitle">Marcá las opciones que te interesen para tu negocio y avanzaremos paso a paso para armar tu propuesta a medida.</p>
        ${state.customNote ? `<div class="step-custom-note">💬 Nota de Fran: "${state.customNote}"</div>` : ""}
      </div>

      <div class="options-stack">
        <div class="module-select-card ${isV ? "selected" : ""}" data-action="toggle-service-pick" data-service="v">
          <div class="module-checkbox-icon">${isV ? "✓" : ""}</div>
          <div>
            <div class="decision-card-title">🎬 Videos para Redes Sociales</div>
            <div class="decision-card-desc">Videos mostrando tu negocio en acción o edición profesional de tus propios crudos.</div>
          </div>
        </div>

        <div class="module-select-card ${isCM ? "selected" : ""}" data-action="toggle-service-pick" data-service="cm">
          <div class="module-checkbox-icon">${isCM ? "✓" : ""}</div>
          <div>
            <div class="decision-card-title">📱 Manejo de Redes (Community Manager)</div>
            <div class="decision-card-desc">Tu vidriera digital abierta, publicaciones semanales y presencia en Google Maps.</div>
          </div>
        </div>

        <div class="module-select-card ${isTO ? "selected" : ""}" data-action="toggle-service-pick" data-service="to">
          <div class="module-checkbox-icon">${isTO ? "✓" : ""}</div>
          <div>
            <div class="decision-card-title">🛒 Catálogo Digital / Tienda Online</div>
            <div class="decision-card-desc">Armado en WhatsApp Business o Tienda Nube / Empretienda (Pago por única vez).</div>
          </div>
        </div>

        <div class="module-select-card inucorn-select-card ${isInu ? "selected" : ""}" data-action="toggle-service-pick" data-service="inu">
          <div class="module-checkbox-icon inucorn-chk-icon">${isInu ? "✓" : ""}</div>
          <div>
            <div class="decision-card-title inucorn-text-title">🎁 Descuento especial en imprenta y papelería Inucorn</div>
            <div class="decision-card-desc">${CFG.inucorn?.descuentoPct || 10}% OFF en folletería, tarjetas, stickers y cartelería para tu local o packaging con el código de Fran.</div>
          </div>
        </div>

        <div class="module-select-card referral-select-card ${isRef ? "selected" : ""}" data-action="toggle-service-pick" data-service="ref">
          <div class="module-checkbox-icon referral-chk-icon">${isRef ? "✓" : ""}</div>
          <div style="flex:1;">
            <div class="decision-card-title referral-text-title">🤝 ${CFG.referidos?.descuentoPct || 25}% OFF en tu pedido con tu código de referido</div>
            <div class="decision-card-desc">
              Accedé a ${CFG.referidos?.descuentoPct || 25}% OFF recomendando o ingresando el código de un amigo.
              <a href="javascript:void(0)" class="referral-terms-link" data-action="open-referral-terms">Ver términos y condiciones</a>
            </div>
          </div>
        </div>
      </div>

      <button type="button" class="btn-primary" style="width:100%; justify-content:center; padding:16px; font-size:1.15rem;" data-action="confirm-services">
        Comenzar Recorrido ➔
      </button>
    `;
  }

  // Paso V1: Modalidad de Videos
  function renderStep_VMode() {
    const isGrabo = state.videoMode === "graboEdiPubli";
    const isEdi = state.videoMode === "ediPubli";

    return `
      <div class="step-header">
        ${state.clientName ? `<div class="step-greeting-pill">Presupuesto para ${state.clientName}</div>` : ""}
        <h1 class="step-question-title">¿Querés que Fran grabe los videos o los grabás vos y Fran los edita?</h1>
        <p class="step-question-subtitle">Elegí si preferís el servicio completo donde Fran va a tu negocio o si vos aportás los videos desde tu celular.</p>
        ${state.customNote ? `<div class="step-custom-note">💬 Nota de Fran: "${state.customNote}"</div>` : ""}
      </div>

      <div class="options-stack">
        <!-- Opción 1: GraboEdiPubli -->
        <div class="decision-card ${isGrabo ? "selected" : ""}" data-action="choose-v-mode" data-mode="graboEdiPubli">
          <div class="decision-card-header">
            <div class="decision-card-title">
              <span>Fran va, graba, edita y publica</span>
            </div>
            <span class="card-badge badge-primary">Servicio Completo</span>
          </div>

          <p class="decision-card-desc">
            Fran va personalmente a tu empresa o local, filma tus productos o servicios en acción, luego se edita de forma profesional y se comparte en redes para que la gente vea cómo trabajás.
          </p>

          <div class="decision-card-footer">
            <span class="decision-card-price">Desde ${formatARS(CFG.videos.modalidades.graboEdiPubli.precioBase)} <small style="font-size:0.85rem; font-weight:600; color:var(--text-muted);">por video base</small></span>
            <span class="decision-card-notice">⚠️ No incluye viáticos (se coordinan según zona)</span>
          </div>
        </div>

        <!-- Opción 2: EdiPubli -->
        <div class="decision-card ${isEdi ? "selected" : ""}" data-action="choose-v-mode" data-mode="ediPubli">
          <div class="decision-card-header">
            <div class="decision-card-title">
              <span>Vos aportás los videos, Fran edita y publica</span>
            </div>
            <span class="card-badge badge-success">Más Económico</span>
          </div>

          <p class="decision-card-desc">
            Vos grabás con tu celular cuando estás trabajando, le pasás los videos sueltos a Fran por WhatsApp y él los transforma en un video profesional con subtítulos y música listo para publicar.
          </p>

          <div class="decision-card-footer">
            <span class="decision-card-price">Desde ${formatARS(CFG.videos.modalidades.ediPubli.precioBase)} <small style="font-size:0.85rem; font-weight:600; color:var(--text-muted);">por video base</small></span>
            <span style="font-size:0.82rem; font-weight:700; color:var(--success);">✅ Sin costos de traslado</span>
          </div>
        </div>
      </div>
    `;
  }

  // Paso V2: Cantidad mensual de videos
  function renderStep_VQty() {
    const isGrabo = state.videoMode === "graboEdiPubli";
    const modeName = isGrabo
      ? "Fran grabe, edite y suba"
      : "Fran edite y suba con tu material";

    const quickQtys = [1, 2, 3, 4, 5, 6];
    const cardsHTML = quickQtys
      .map((q) => {
        const sim = calculateVideosQuote(state.videoMode, q, 1);
        const disc = getVideoUnitDiscountPct(q);
        const isSel = state.videoQty === q;
        return `
          <div class="qty-pill-card ${isSel ? "selected" : ""}" data-action="choose-v-qty" data-qty="${q}">
            <div class="qty-pill-number">${q} ${q === 1 ? "video" : "videos"}</div>
            <div class="qty-pill-price">${formatARS(sim.monthlyWithDisc)} / mes</div>
            <span class="qty-pill-discount">
              ${q === 1 ? "Precio base" : `${q}° video al ${disc}% OFF`}
            </span>
          </div>
        `;
      })
      .join("");

    return `
      <div class="step-header">
        <h1 class="step-question-title">¿Cuántos videos por mes querés que ${modeName}?</h1>
        <p class="step-question-subtitle">A mayor cantidad mensual, mayor descuento: cada video adicional te sale más barato que el anterior (¡hasta ${getVideoUnitDiscountPct(6)}% OFF a partir del 6°!).</p>
      </div>

      <div class="qty-grid-compact">
        ${cardsHTML}
      </div>

      <div class="manual-stepper-box">
        <div>
          <div style="font-weight:900; font-size:1.05rem;">¿Querés más de 6 videos al mes?</div>
          <div style="font-size:0.85rem; color:var(--text-muted);">Del 6° en adelante van todos al ${getVideoUnitDiscountPct(6)}% OFF</div>
        </div>
        <div class="stepper-controls">
          <button type="button" class="stepper-btn" data-action="adjust-v-qty" data-delta="-1">−</button>
          <span class="stepper-display">${state.videoQty} videos</span>
          <button type="button" class="stepper-btn" data-action="adjust-v-qty" data-delta="1">+</button>
        </div>
      </div>

      <button type="button" class="btn-primary" style="width:100%; justify-content:center; padding:15px; margin-top:20px; font-size:1.1rem;" data-action="confirm-v-qty">
        Continuar con ${state.videoQty} ${state.videoQty === 1 ? "video" : "videos"}/mes ➔
      </button>
    `;
  }

  // Paso V3: Meses de Videos (Congelar precio o mensual)
  function renderStep_VMonths() {
    const primaryCardsHTML = [
      // 1 Mes / Mensual
      (() => {
        const quote = calculateVideosQuote(state.videoMode, state.videoQty, 1);
        const isSel = state.videoMonths === 1;
        return `
          <div class="month-pill-card ${isSel ? "selected" : ""}" data-action="choose-v-months" data-months="1">
            <div class="month-pill-header">
              <span class="month-pill-title">Mensual</span>
              <span class="month-pill-badge badge-neutral">Sin permanencia</span>
            </div>
            <div class="month-pill-hero-price">${formatARS(quote.effectivePerMonth)} <small>/ mes</small></div>
            <div class="month-pill-subdetail">Abonás por mes</div>
          </div>
        `;
      })(),
      // 3 Meses
      (() => {
        const quote = calculateVideosQuote(state.videoMode, state.videoQty, 3);
        const isSel = state.videoMonths === 3;
        return `
          <div class="month-pill-card ${isSel ? "selected" : ""}" data-action="choose-v-months" data-months="3">
            <div class="month-pill-header">
              <span class="month-pill-title">3 Meses</span>
              <span class="month-pill-badge">⭐ -${quote.monthDiscountPct}% OFF</span>
            </div>
            <div class="month-pill-hero-price">${formatARS(quote.effectivePerMonth)} <small>/ mes</small></div>
            <div class="month-pill-subdetail">Total: ${formatARS(quote.totalFinal)}<br/>(Ahorro ${formatARS(quote.totalSaved)})</div>
          </div>
        `;
      })(),
      // 6 Meses
      (() => {
        const quote = calculateVideosQuote(state.videoMode, state.videoQty, 6);
        const isSel = state.videoMonths === 6;
        return `
          <div class="month-pill-card ${isSel ? "selected" : ""}" data-action="choose-v-months" data-months="6">
            <div class="month-pill-header">
              <span class="month-pill-title">6 Meses</span>
              <span class="month-pill-badge">🔥 -${quote.monthDiscountPct}% OFF</span>
            </div>
            <div class="month-pill-hero-price">${formatARS(quote.effectivePerMonth)} <small>/ mes</small></div>
            <div class="month-pill-subdetail">Total: ${formatARS(quote.totalFinal)}<br/>(Ahorro ${formatARS(quote.totalSaved)})</div>
          </div>
        `;
      })(),
    ].join("");

    const extraCardsHTML = [
      // 9 Meses
      (() => {
        const quote = calculateVideosQuote(state.videoMode, state.videoQty, 9);
        const isSel = state.videoMonths === 9;
        return `
          <div class="month-pill-card ${isSel ? "selected" : ""}" data-action="choose-v-months" data-months="9">
            <div class="month-pill-header">
              <span class="month-pill-title">9 Meses</span>
              <span class="month-pill-badge" style="background:#fef3c7; color:#92400e;">🚀 -${quote.monthDiscountPct}% OFF</span>
            </div>
            <div class="month-pill-hero-price">${formatARS(quote.effectivePerMonth)} <small>/ mes</small></div>
            <div class="month-pill-subdetail">Total: ${formatARS(quote.totalFinal)}<br/>(Ahorro ${formatARS(quote.totalSaved)})</div>
          </div>
        `;
      })(),
      // 12 Meses
      (() => {
        const quote = calculateVideosQuote(state.videoMode, state.videoQty, 12);
        const isSel = state.videoMonths === 12;
        return `
          <div class="month-pill-card ${isSel ? "selected" : ""}" data-action="choose-v-months" data-months="12">
            <div class="month-pill-header">
              <span class="month-pill-title">12 Meses</span>
              <span class="month-pill-badge" style="background:#fef3c7; color:#92400e;">👑 -${quote.monthDiscountPct}% OFF</span>
            </div>
            <div class="month-pill-hero-price">${formatARS(quote.effectivePerMonth)} <small>/ mes</small></div>
            <div class="month-pill-subdetail">Total: ${formatARS(quote.totalFinal)}<br/>(Ahorro ${formatARS(quote.totalSaved)})</div>
          </div>
        `;
      })(),
    ].join("");

    return `
      <div class="step-header">
        <h1 class="step-question-title">¿Querés congelar precio o abonar por mes?</h1>
        <p class="step-question-subtitle">
          Podés abonar por mes sin compromiso, o congelar el precio por adelantado para asegurar tu valor sin aumentos por inflación y con descuento.
        </p>
      </div>

      <div class="months-grid-3x1">
        ${primaryCardsHTML}
      </div>

      <div class="extra-months-box">
        <div class="extra-months-header">
          <div>
            <div style="font-weight:900; font-size:1.05rem;">¿Querés congelar por más de 6 meses?</div>
            <div style="font-size:0.85rem; color:var(--text-muted);">Planes semestrales o anuales con el mayor porcentaje de descuento</div>
          </div>
        </div>
        <div class="extra-months-grid">
          ${extraCardsHTML}
        </div>
      </div>
    `;
  }

  // Paso CM1: Elección de Plan de Redes (CM)
  function renderStep_CMPlan() {
    const wantsVideosAlso = state.hasExplicitParams
      ? state.enabledModules.v
      : state.selectedServices.v;

    const cardsHTML = CFG.cm.planes
      .map((plan) => {
        const isSel = state.cmPlanId === plan.id;
        return `
          <div class="decision-card ${isSel ? "selected" : ""}" data-action="choose-cm-plan" data-plan="${plan.id}">
            <div class="decision-card-header">
              <div class="decision-card-title">
                <span>${plan.nombre}</span>
              </div>
              <span class="card-badge ${plan.destacado ? "badge-warning" : "badge-primary"}">${plan.badge}</span>
            </div>

            <p class="decision-card-desc">${plan.enCriollo}</p>

            <ul style="list-style:none; padding:0; margin:6px 0;">
              ${plan.resumenCorto.map((r) => `<li style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:4px;">${r}</li>`).join("")}
            </ul>

            <details class="mini-accordion" onclick="event.stopPropagation()">
              <summary>Ver qué incluye este plan ▾</summary>
              <ul>
                ${plan.detalleCompleto.map((d) => `<li>${d}</li>`).join("")}
              </ul>
            </details>

            <div class="decision-card-footer">
              <span class="decision-card-price">${formatARS(plan.precioMensual)} <small style="font-size:0.85rem; font-weight:600; color:var(--text-muted);">/ mes base</small></span>
              <span style="font-size:0.85rem; font-weight:800; color:var(--success);">Hasta ${getMonthDiscountPct(12)}% OFF congelando</span>
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <div class="step-header">
        <h1 class="step-question-title">¿Qué nivel de presencia querés para tus redes sociales?</h1>
        <p class="step-question-subtitle">Fran se ocupa de tu vidriera digital, tus publicaciones y de que tu negocio aparezca en Google Maps.</p>
      </div>

      <div class="options-stack">
        ${cardsHTML}

        ${
          wantsVideosAlso
            ? `
          <div class="decision-card ${state.cmPlanId === "skip" ? "selected" : ""}" data-action="choose-cm-plan" data-plan="skip" style="border-style:dashed;">
            <div class="decision-card-title" style="color:var(--text-muted);">
              <span>No sumar CM por ahora</span>
            </div>
            <p class="decision-card-desc" style="font-size:0.88rem;">Continuar la cotización solo con los videos.</p>
          </div>
        `
            : ""
        }
      </div>
    `;
  }

  // Paso CM2: Meses de CM
  function renderStep_CMMonths() {
    const plan = CFG.cm.planes.find((p) => p.id === state.cmPlanId);
    if (!plan) return "";

    const primaryCardsHTML = [
      // 1 Mes / Mensual
      (() => {
        const quote = calculateCMQuote(state.cmPlanId, 1);
        const isSel = state.cmMonths === 1;
        return `
          <div class="month-pill-card ${isSel ? "selected" : ""}" data-action="choose-cm-months" data-months="1">
            <div class="month-pill-header">
              <span class="month-pill-title">Mensual</span>
              <span class="month-pill-badge badge-neutral">Sin permanencia</span>
            </div>
            <div class="month-pill-hero-price">${formatARS(quote.effectivePerMonth)} <small>/ mes</small></div>
            <div class="month-pill-subdetail">Abonás por mes</div>
          </div>
        `;
      })(),
      // 3 Meses
      (() => {
        const quote = calculateCMQuote(state.cmPlanId, 3);
        const isSel = state.cmMonths === 3;
        return `
          <div class="month-pill-card ${isSel ? "selected" : ""}" data-action="choose-cm-months" data-months="3">
            <div class="month-pill-header">
              <span class="month-pill-title">3 Meses</span>
              <span class="month-pill-badge">⭐ -${quote.monthDiscountPct}% OFF</span>
            </div>
            <div class="month-pill-hero-price">${formatARS(quote.effectivePerMonth)} <small>/ mes</small></div>
            <div class="month-pill-subdetail">Total: ${formatARS(quote.totalFinal)}<br/>(Ahorro ${formatARS(quote.totalSaved)})</div>
          </div>
        `;
      })(),
      // 6 Meses
      (() => {
        const quote = calculateCMQuote(state.cmPlanId, 6);
        const isSel = state.cmMonths === 6;
        return `
          <div class="month-pill-card ${isSel ? "selected" : ""}" data-action="choose-cm-months" data-months="6">
            <div class="month-pill-header">
              <span class="month-pill-title">6 Meses</span>
              <span class="month-pill-badge">🔥 -${quote.monthDiscountPct}% OFF</span>
            </div>
            <div class="month-pill-hero-price">${formatARS(quote.effectivePerMonth)} <small>/ mes</small></div>
            <div class="month-pill-subdetail">Total: ${formatARS(quote.totalFinal)}<br/>(Ahorro ${formatARS(quote.totalSaved)})</div>
          </div>
        `;
      })(),
    ].join("");

    const extraCardsHTML = [
      // 9 Meses
      (() => {
        const quote = calculateCMQuote(state.cmPlanId, 9);
        const isSel = state.cmMonths === 9;
        return `
          <div class="month-pill-card ${isSel ? "selected" : ""}" data-action="choose-cm-months" data-months="9">
            <div class="month-pill-header">
              <span class="month-pill-title">9 Meses</span>
              <span class="month-pill-badge" style="background:#fef3c7; color:#92400e;">🚀 -${quote.monthDiscountPct}% OFF</span>
            </div>
            <div class="month-pill-hero-price">${formatARS(quote.effectivePerMonth)} <small>/ mes</small></div>
            <div class="month-pill-subdetail">Total: ${formatARS(quote.totalFinal)}<br/>(Ahorro ${formatARS(quote.totalSaved)})</div>
          </div>
        `;
      })(),
      // 12 Meses
      (() => {
        const quote = calculateCMQuote(state.cmPlanId, 12);
        const isSel = state.cmMonths === 12;
        return `
          <div class="month-pill-card ${isSel ? "selected" : ""}" data-action="choose-cm-months" data-months="12">
            <div class="month-pill-header">
              <span class="month-pill-title">12 Meses</span>
              <span class="month-pill-badge" style="background:#fef3c7; color:#92400e;">👑 -${quote.monthDiscountPct}% OFF</span>
            </div>
            <div class="month-pill-hero-price">${formatARS(quote.effectivePerMonth)} <small>/ mes</small></div>
            <div class="month-pill-subdetail">Total: ${formatARS(quote.totalFinal)}<br/>(Ahorro ${formatARS(quote.totalSaved)})</div>
          </div>
        `;
      })(),
    ].join("");

    return `
      <div class="step-header">
        <h1 class="step-question-title">¿Querés congelar el valor de ${plan.nombre} o abonar por mes?</h1>
        <p class="step-question-subtitle">
          Podés abonar por mes sin compromiso, o congelar el costo mensual por adelantado sin aumentos por inflación.
        </p>
      </div>

      <div class="months-grid-3x1">
        ${primaryCardsHTML}
      </div>

      <div class="extra-months-box">
        <div class="extra-months-header">
          <div>
            <div style="font-weight:900; font-size:1.05rem;">¿Querés congelar por más de 6 meses?</div>
            <div style="font-size:0.85rem; color:var(--text-muted);">Planes semestrales y anuales con congelamiento total de precio</div>
          </div>
        </div>
        <div class="extra-months-grid">
          ${extraCardsHTML}
        </div>
      </div>

      <div style="text-align:center; margin-top:18px;">
        <button type="button" class="btn-skip-freeze" data-action="skip-cm-freeze">
          ⚪ No congelar precio, avanzar mensual ➔
        </button>
      </div>
    `;
  }

  // Paso TO: Catálogo / Tienda
  function renderStep_TOChoice() {
    const wspObj = CFG.tienda?.opciones?.find((o) => o.id === "catalogoWsp");
    const nubeObj = CFG.tienda?.opciones?.find((o) => o.id === "tiendaNube");
    const wspPrice = wspObj ? wspObj.precioUnico : 50000;
    const nubePrice = nubeObj ? nubeObj.precioUnico : 50000;
    const ambosPrice =
      CFG.tienda?.precioAmbos !== undefined
        ? CFG.tienda.precioAmbos
        : wspPrice + nubePrice;

    return `
      <div class="step-header">
        <h1 class="step-question-title">¿Querés sumar tu Catálogo Digital o Tienda Online?</h1>
        <p class="step-question-subtitle">Un catálogo digital es un mostrador abierto las 24 hs: mandás un solo link y el cliente ve fotos, características y precios listos para encargarte. (Pago por única vez).</p>
      </div>

      <div class="options-stack">
        <!-- Catálogo WhatsApp -->
        <div class="decision-card ${state.tiendaChoice === "catalogoWsp" ? "selected" : ""}" data-action="choose-to" data-choice="catalogoWsp">
          <div class="decision-card-header">
            <div class="decision-card-title">Catálogo en WhatsApp Business</div>
            <span class="card-badge badge-primary">Pago Único</span>
          </div>
          <p class="decision-card-desc">
            Fotografía de hasta 30 productos en tu local o predio + armado completo del catálogo dentro de tu WhatsApp Business con precios y descripciones vendedoras.
          </p>
          <div class="decision-card-footer">
            <span class="decision-card-price">${formatARS(wspPrice)} <small style="font-size:0.85rem; color:var(--text-muted);">(pago único)</small></span>
            <span class="decision-card-notice">⚠️ Traslado se coordina aparte según zona</span>
          </div>
        </div>

        <!-- Tienda Nube / Empretienda -->
        <div class="decision-card ${state.tiendaChoice === "tiendaNube" ? "selected" : ""}" data-action="choose-to" data-choice="tiendaNube">
          <div class="decision-card-header">
            <div class="decision-card-title">Tienda Online (Tienda Nube / Empretienda)</div>
            <span class="card-badge badge-primary">Pago Único</span>
          </div>
          <p class="decision-card-desc">
            Configuración completa de tu propia página web de ventas, conexión de medios de pago (Mercado Pago), medios de envío y carga de hasta 30 productos.
          </p>
          <div class="decision-card-footer">
            <span class="decision-card-price">${formatARS(nubePrice)} <small style="font-size:0.85rem; color:var(--text-muted);">(pago único)</small></span>
            <span class="decision-card-notice">⚠️ Traslado se coordina aparte según zona</span>
          </div>
        </div>

        <!-- Ambos -->
        <div class="decision-card ${state.tiendaChoice === "ambos" ? "selected" : ""}" data-action="choose-to" data-choice="ambos">
          <div class="decision-card-header">
            <div class="decision-card-title">Ambos servicios (Catálogo WhatsApp + Tienda Online)</div>
            <span class="card-badge badge-warning">Combo Completo</span>
          </div>
          <p class="decision-card-desc">Tu catálogo adentro de WhatsApp para vender por chat + tu página web con carrito para cobrar con tarjeta.</p>
          <div class="decision-card-footer">
            <span class="decision-card-price">${formatARS(ambosPrice)} <small style="font-size:0.85rem; color:var(--text-muted);">(pago único)</small></span>
          </div>
        </div>

        <!-- Omitir -->
        <div class="decision-card ${state.tiendaChoice === "skip" ? "selected" : ""}" data-action="choose-to" data-choice="skip" style="border-style:dashed;">
          <div class="decision-card-title" style="color:var(--text-muted);">No necesito catálogo ni tienda por ahora</div>
          <p class="decision-card-desc" style="font-size:0.88rem;">Continuar sin sumar este servicio.</p>
        </div>
      </div>
    `;
  }

  // Paso de Beneficios y Cupones (Inucorn y/o Referidos en la misma pantalla)
  function renderStep_Benefits() {
    const wantsINU = state.hasExplicitParams
      ? state.enabledModules.inu
      : state.selectedServices.inu;
    const wantsREF = state.hasExplicitParams
      ? state.enabledModules.ref
      : state.selectedServices.ref;

    const inuDisc = CFG.inucorn?.descuentoPct || 10;
    const refDisc = CFG.referidos?.descuentoPct || 25;

    let inuHTML = "";
    if (wantsINU) {
      const inu = CFG.inucorn;
      inuHTML = `
        <div class="inucorn-step-card">
          <div style="font-size:1.1rem; font-weight:800; color:#5b21b6;">🎁 ${inuDisc}% OFF en Imprenta Inucorn</div>
          <p style="font-size:0.88rem; color:#6b21a8; line-height:1.4;">${inu.descripcion}</p>
          <div class="inucorn-coupon-box">${inu.codigoCupon}</div>

          <label class="inucorn-interest-card" for="chk-inu-interest">
            <input 
              type="checkbox" 
              id="chk-inu-interest" 
              class="inucorn-interest-checkbox" 
              ${state.inucornInterested ? "checked" : ""} 
            />
            <span class="inucorn-interest-title">¡Me interesa!</span>
          </label>
        </div>
      `;
    }

    let refHTML = "";
    if (wantsREF) {
      refHTML = `
        <div class="referral-step-card">
          <div style="font-size:1.15rem; font-weight:900; color:#92400e;">🤝 Programa de Referidos<br/>(${refDisc}% OFF)</div>
          <p style="font-size:0.88rem; color:#b45309; line-height:1.4;">
            Descuento válido al cancelar el saldo, bajo condición de seña previa del referido.
            <br/>
            <a href="javascript:void(0)" class="referral-terms-link" data-action="open-referral-terms">Ver términos y condiciones</a>
          </p>

          <!-- Input para código preexistente -->
          <div class="referral-input-box">
            <label for="input-referred-code" style="display:block; font-size:0.9rem; font-weight:800; color:#78350f; margin-bottom:6px;">
              ¿Tenés el código de un amigo que te recomendó?
            </label>
            <input 
              type="text" 
              id="input-referred-code" 
              class="lead-input referral-input" 
              placeholder="Ingresá el código acá" 
              value="${state.inputReferredCode || ""}" 
              maxlength="10"
            />
          </div>

          <!-- Código autogenerado para compartir -->
          <div class="referral-code-display-box">
            <div style="font-size:0.82rem; font-weight:800; color:#92400e; text-transform:uppercase;">Tu código de referente:</div>
            <div class="referral-badge-code">${state.myReferralCode}</div>
          </div>

          <!-- Checkbox para querer recomendar -->
          <label class="referral-want-toggle" for="chk-want-refer">
            <input 
              type="checkbox" 
              id="chk-want-refer" 
              class="referral-want-checkbox" 
              ${state.wantToRefer ? "checked" : ""} 
            />
            <span style="font-size:1.05rem; font-weight:800; color:#92400e;">¡Lo quiero!<br/>Recomendaré a alguien</span>
          </label>
        </div>
      `;
    }

    let titleText = "🎁 ¡Tus Beneficios y Descuentos!";
    if (wantsINU && !wantsREF) {
      titleText = `🎁 ¡Tenés ${inuDisc}% OFF en Imprenta Inucorn!`;
    } else if (wantsREF && !wantsINU) {
      titleText = `🤝 ¡${refDisc}% OFF con Código de Referido!`;
    }

    return `
      <div class="step-header">
        <h1 class="step-question-title">${titleText}</h1>
        <p class="step-question-subtitle">Aprovechá estos beneficios especiales para sumar a tu cotización con Fran.</p>
      </div>

      <div style="display:flex; flex-direction:column; gap:16px;">
        ${inuHTML}
        ${refHTML}
      </div>

      <button type="button" class="btn-primary" style="width:100%; justify-content:center; padding:16px; margin-top:24px; font-size:1.15rem;" data-action="advance-step">
        Ver Resumen de mi Presupuesto ➔
      </button>
    `;
  }

  // Paso Final: Resumen y Cierre por WhatsApp
  function renderStep_Summary() {
    const totals = calculateRunningTotals();
    const items = [];
    let requiresTravel = false;

    // Item Videos
    if (state.videoMode) {
      const vq = calculateVideosQuote(
        state.videoMode,
        state.videoQty,
        state.videoMonths
      );
      if (vq.mode.requiereTraslado) requiresTravel = true;
      items.push(`
        <div class="final-summary-item">
          <div>
            <div class="final-item-title">🎬 Videos (${vq.mode.nombreCorto})</div>
            <div class="final-item-desc">
              ${state.videoQty} ${state.videoQty === 1 ? "video" : "videos"}/mes por ${state.videoMonths} ${state.videoMonths === 1 ? "mes" : "meses"} (${state.videoQty * state.videoMonths} videos totales)
              <br/>Equivale a ${formatARS(vq.effectivePerMonth)}/mes (${formatARS(vq.effectivePerVideo)} por video)
            </div>
          </div>
          <div class="final-item-price">
            <div>${formatARS(vq.totalFinal)}</div>
            ${vq.totalSaved > 0 ? `<div style="font-size:0.78rem; color:var(--success); font-weight:800;">Ahorrás ${formatARS(vq.totalSaved)}</div>` : ""}
          </div>
        </div>
      `);
    }

    // Item CM
    if (state.cmPlanId && state.cmPlanId !== "skip") {
      const cmq = calculateCMQuote(state.cmPlanId, state.cmMonths);
      items.push(`
        <div class="final-summary-item">
          <div>
            <div class="final-item-title">📱 Redes Sociales (${cmq.plan.nombre})</div>
            <div class="final-item-desc">Plan por ${state.cmMonths} ${state.cmMonths === 1 ? "mes" : "meses"} (${formatARS(cmq.effectivePerMonth)}/mes)</div>
          </div>
          <div class="final-item-price">
            <div>${formatARS(cmq.totalFinal)}</div>
            ${cmq.totalSaved > 0 ? `<div style="font-size:0.78rem; color:var(--success); font-weight:800;">Ahorrás ${formatARS(cmq.totalSaved)}</div>` : ""}
          </div>
        </div>
      `);
    }

    // Item Tienda
    if (state.tiendaChoice && state.tiendaChoice !== "skip") {
      const tq = calculateTiendaQuote(state.tiendaChoice);
      requiresTravel = true;
      items.push(`
        <div class="final-summary-item">
          <div>
            <div class="final-item-title">🛒 ${tq.label}</div>
            <div class="final-item-desc">Pago por única vez (hasta 30 productos)</div>
          </div>
          <div class="final-item-price">
            <div>${formatARS(tq.totalFinal)}</div>
          </div>
        </div>
      `);
    }

    // Item Inucorn (si lo seleccionó y mantuvo el checkbox tildado)
    const wantsINU = state.hasExplicitParams
      ? state.enabledModules.inu
      : state.selectedServices.inu;
    if (wantsINU && state.inucornInterested) {
      items.push(`
        <div class="final-summary-item" style="border-left: 3px solid var(--inucorn-purple); padding-left: 10px;">
          <div>
            <div class="final-item-title inucorn-text-title">🎁 Beneficio Imprenta Inucorn (${CFG.inucorn?.descuentoPct || 10}% OFF)</div>
            <div class="final-item-desc">Descuento reservado para coordinar con Fran (Código: <strong>${CFG.inucorn.codigoCupon}</strong>)</div>
          </div>
          <div class="final-item-price" style="color:var(--inucorn-purple); font-size:1rem;">
            Incluido
          </div>
        </div>
      `);
    }

    // Item Referidos (si lo seleccionó y tiene código ingresado o quiere recomendar)
    const wantsREF = state.hasExplicitParams
      ? state.enabledModules.ref
      : state.selectedServices.ref;
    if (wantsREF && (state.wantToRefer || state.inputReferredCode)) {
      const details = [];
      if (state.inputReferredCode) {
        details.push(`Código de quien te recomendó: <strong>${state.inputReferredCode}</strong>`);
      }
      if (state.wantToRefer) {
        details.push(`Tu código personal: <strong>${state.myReferralCode}</strong>`);
      }
      items.push(`
        <div class="final-summary-item" style="border-left: 3px solid #f59e0b; padding-left: 10px;">
          <div>
            <div class="final-item-title" style="color:#b45309;">🤝 Descuento por Referidos (${CFG.referidos?.descuentoPct || 25}% OFF)</div>
            <div class="final-item-desc">${details.join(" • ")} (a aplicar al cancelar el saldo)</div>
          </div>
          <div class="final-item-price" style="color:#d97706; font-size:1rem;">
            Registrado
          </div>
        </div>
      `);
    }

    // Aclaración de Traslado
    let travelBoxHTML = "";
    if (requiresTravel) {
      if (state.uberOneWay > 0) {
        travelBoxHTML = `
          <div style="background:#f8fafc; border:1px solid var(--border); border-radius:var(--radius-sm); padding:10px 14px; font-size:0.88rem;">
            🚗 <strong>Traslado estimado (Uber ida y vuelta):</strong> ${formatARS(state.uberOneWay * 2)} por visita presencial.
          </div>
        `;
      } else {
        travelBoxHTML = `
          <div style="background:#f8fafc; border:1px solid var(--border); border-radius:var(--radius-sm); padding:10px 14px; font-size:0.88rem;">
            🚗 <strong>Nota sobre Traslado:</strong> En grabaciones o sesiones presenciales, el traslado se coordina aparte según zona.
          </div>
        `;
      }
    }

    const wspUrl = buildFranWhatsAppUrl();

    let clientGreeting = "¡Presupuesto Completado! 🎉";
    if (state.clientName && state.businessName) {
      clientGreeting = `¡Propuesta para ${state.clientName} (${state.businessName})! 🎉`;
    } else if (state.clientName) {
      clientGreeting = `¡Propuesta para ${state.clientName}! 🎉`;
    } else if (state.businessName) {
      clientGreeting = `¡Propuesta para ${state.businessName}! 🎉`;
    }

    return `
      <div class="step-header" style="text-align:center;">
        <div class="step-greeting-pill">${clientGreeting}</div>
        <h1 class="step-question-title">Tu propuesta a medida está lista</h1>
        <p class="step-question-subtitle">Revisá el resumen y tocale el botón verde para coordinar directamente con Fran por WhatsApp.</p>
      </div>

      <div class="final-summary-card">
        ${items.join("")}
        ${travelBoxHTML}

        <div style="background:var(--warning-bg); border:1px solid var(--warning-border); padding:10px 14px; border-radius:var(--radius-sm); font-size:0.88rem; color:#92400e; font-weight:600;">
          🔒 <strong>Precio congelado:</strong> Al contratar por meses adelantados congelás este valor hoy sin aumentos por inflación.
        </div>

        <div class="final-total-box">
          <div>
            <div style="font-size:0.85rem; font-weight:800; text-transform:uppercase; color:#94a3b8;">TOTAL PRESUPUESTADO</div>
            ${
              totals.totalSaved > 0
                ? `<div style="font-size:0.95rem; font-weight:900; color:#4ade80; margin-top:2px;">🎉 Ahorrás ${formatARS(totals.totalSaved)}</div>`
                : ""
            }
          </div>
          <div class="final-total-amount">${formatARS(totals.totalFinal)}</div>
        </div>

        <a href="${wspUrl}" target="_blank" rel="noopener noreferrer" class="final-whatsapp-btn">
          <span>💬 Enviar este presupuesto por WhatsApp a Fran</span>
        </a>

        <button type="button" class="btn-secondary" style="width:100%; justify-content:center; padding:12px;" data-action="restart-flow">
          🔄 Volver al inicio o cambiar respuestas
        </button>
      </div>
    `;
  }

  function buildFranWhatsAppUrl() {
    const totals = calculateRunningTotals();
    const lines = [];

    if (state.clientName && state.businessName) {
      lines.push(`¡Hola Fran! Soy *${state.clientName}* de *${state.businessName}*.`);
    } else if (state.clientName) {
      lines.push(`¡Hola Fran! Soy *${state.clientName}*.`);
    } else if (state.businessName) {
      lines.push(`¡Hola Fran! Te escribo de parte de *${state.businessName}*.`);
    } else {
      lines.push(`¡Hola Fran!`);
    }

    lines.push(
      `Completé tu presupuestador web paso a paso y me interesa esta propuesta:`
    );
    lines.push(``);

    if (state.videoMode) {
      const vq = calculateVideosQuote(
        state.videoMode,
        state.videoQty,
        state.videoMonths
      );
      const totalVids = state.videoQty * state.videoMonths;
      lines.push(
        `*VIDEOS (${vq.mode.nombreCorto}):* ${state.videoQty} ${
          state.videoQty === 1 ? "video" : "videos"
        }/mes x ${state.videoMonths} ${
          state.videoMonths === 1 ? "mes" : "meses"
        } (${totalVids} ${totalVids === 1 ? "video" : "videos"} en total) -> *${formatARS(
          vq.totalFinal
        )}*`
      );
    }

    if (state.cmPlanId && state.cmPlanId !== "skip") {
      const cmq = calculateCMQuote(state.cmPlanId, state.cmMonths);
      lines.push(
        `*REDES SOCIALES (${cmq.plan.nombre}):* Plan por ${
          state.cmMonths
        } ${state.cmMonths === 1 ? "mes" : "meses"} (${formatARS(cmq.effectivePerMonth)}/mes) -> *${formatARS(
          cmq.totalFinal
        )}*`
      );
    }

    if (state.tiendaChoice && state.tiendaChoice !== "skip") {
      const tq = calculateTiendaQuote(state.tiendaChoice);
      lines.push(`*${tq.label}:* Pago único -> *${formatARS(tq.totalFinal)}*`);
    }

    lines.push(``);
    lines.push(`*TOTAL COTIZADO:* *${formatARS(totals.totalFinal)}*`);
    if (totals.totalSaved > 0) {
      lines.push(`*(Ahorro aplicado: ${formatARS(totals.totalSaved)})*`);
    }

    if (state.uberOneWay > 0) {
      lines.push(
        `*Traslado estimado (Uber ida y vuelta):* ${formatARS(
          state.uberOneWay * 2
        )} por visita`
      );
    }

    const wantsINU = state.hasExplicitParams
      ? state.enabledModules.inu
      : state.selectedServices.inu;
    if (wantsINU && state.inucornInterested) {
      lines.push(``);
      lines.push(`Además, me interesa el descuento de Imprenta Inucorn`);
    }

    const wantsREF = state.hasExplicitParams
      ? state.enabledModules.ref
      : state.selectedServices.ref;
    if (wantsREF) {
      if (state.inputReferredCode) {
        lines.push(``);
        lines.push(`Mi código de referido es ${state.inputReferredCode}`);
      }
      if (state.wantToRefer) {
        lines.push(``);
        lines.push(`Mi código de referente es ${state.myReferralCode}`);
      }
    }

    lines.push(``);
    lines.push(`¿Coordinamos para avanzar?`);

    return `https://wa.me/${CFG.whatsappNumber}?text=${encodeURIComponent(
      lines.join("\n")
    )}`;
  }

  // ==========================================================================
  // 6. CONTROLADORES DE EVENTOS
  // ==========================================================================

  function setupEventListeners() {
    document.body.addEventListener("click", (e) => {
      const target = e.target.closest("[data-action]");
      if (!target) return;

      const action = target.getAttribute("data-action");

      switch (action) {
        case "open-referral-terms": {
          e.stopPropagation();
          openReferralTermsModal();
          break;
        }

        case "close-referral-terms": {
          closeReferralTermsModal();
          break;
        }

        case "submit-client-info": {
          const nameInput = document.getElementById("lead-client-name");
          const bizInput = document.getElementById("lead-business-name");
          const nameVal = nameInput ? nameInput.value.trim() : "";
          const bizVal = bizInput ? bizInput.value.trim() : "";

          if (!nameVal && !bizVal) {
            alert("¡Contanos al menos tu nombre para saber cómo llamarte!");
            if (nameInput) nameInput.focus();
            return;
          }

          state.clientName = nameVal;
          state.businessName = bizVal;
          advanceStep();
          break;
        }

        case "prev-step": {
          prevStep();
          break;
        }

        case "advance-step": {
          advanceStep();
          break;
        }

        case "restart-flow": {
          state.currentStepIndex = 0;
          renderCurrentStep();
          window.scrollTo({ top: 0, behavior: "smooth" });
          break;
        }

        case "toggle-service-pick": {
          const s = target.getAttribute("data-service");
          state.selectedServices[s] = !state.selectedServices[s];
          renderCurrentStep();
          break;
        }

        case "confirm-services": {
          if (
            !state.selectedServices.v &&
            !state.selectedServices.cm &&
            !state.selectedServices.to &&
            !state.selectedServices.inu &&
            !state.selectedServices.ref
          ) {
            alert("Elegí al menos un servicio o beneficio para comenzar.");
            return;
          }
          advanceStep();
          break;
        }

        case "choose-v-mode": {
          state.videoMode = target.getAttribute("data-mode");
          // Pequeño retardo de 120ms para feedback táctil y avanzar automáticamente
          setTimeout(() => advanceStep(), 120);
          break;
        }

        case "choose-v-qty": {
          state.videoQty = parseInt(target.getAttribute("data-qty"), 10);
          setTimeout(() => advanceStep(), 120);
          break;
        }

        case "adjust-v-qty": {
          const delta = parseInt(target.getAttribute("data-delta"), 10);
          state.videoQty = Math.max(1, Math.min(30, state.videoQty + delta));
          renderCurrentStep();
          break;
        }

        case "confirm-v-qty": {
          advanceStep();
          break;
        }

        case "choose-v-months": {
          state.videoMonths = parseInt(target.getAttribute("data-months"), 10);
          setTimeout(() => advanceStep(), 120);
          break;
        }

        case "skip-v-freeze": {
          state.videoMonths = 1;
          setTimeout(() => advanceStep(), 100);
          break;
        }

        case "confirm-v-months": {
          advanceStep();
          break;
        }

        case "choose-cm-plan": {
          state.cmPlanId = target.getAttribute("data-plan");
          setTimeout(() => advanceStep(), 120);
          break;
        }

        case "choose-cm-months": {
          state.cmMonths = parseInt(target.getAttribute("data-months"), 10);
          setTimeout(() => advanceStep(), 120);
          break;
        }

        case "skip-cm-freeze": {
          state.cmMonths = 1;
          setTimeout(() => advanceStep(), 100);
          break;
        }

        case "confirm-cm-months": {
          advanceStep();
          break;
        }

        case "choose-to": {
          state.tiendaChoice = target.getAttribute("data-choice");
          setTimeout(() => advanceStep(), 120);
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

        case "switch-admin-tab": {
          const tab = target.getAttribute("data-tab");
          if (tab) switchAdminTab(tab);
          break;
        }

        case "save-admin-prices": {
          saveAdminPrices();
          break;
        }

        case "reset-admin-prices": {
          resetAdminPrices();
          break;
        }

        case "copy-admin-config": {
          copyAdminConfigToClipboard();
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

    // Enter key para enviar inputs del paso inicial
    document.body.addEventListener("keydown", (e) => {
      if (
        e.key === "Enter" &&
        (e.target.id === "lead-client-name" ||
          e.target.id === "lead-business-name")
      ) {
        e.preventDefault();
        const submitBtn = document.querySelector(
          '[data-action="submit-client-info"]'
        );
        if (submitBtn) submitBtn.click();
      }
    });

    // Checkbox de interés de Inucorn y de Referidos
    document.body.addEventListener("change", (e) => {
      if (e.target.id === "chk-inu-interest") {
        state.inucornInterested = e.target.checked;
      }
      if (e.target.id === "chk-want-refer") {
        state.wantToRefer = e.target.checked;
      }
    });

    // Input de código de referido preexistente
    document.body.addEventListener("input", (e) => {
      if (e.target.id === "input-referred-code") {
        state.inputReferredCode = e.target.value.trim();
      }
    });

    // Inputs de Mantenimiento / Admin
    const adminInputs = [
      "adm-chk-v",
      "adm-chk-cm",
      "adm-chk-to",
      "adm-chk-inu",
      "adm-chk-ref",
      "adm-client-name",
      "adm-business-name",
      "adm-client-note",
      "adm-uber-cost",
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

  // ==========================================================================
  // 7. MODALES Y MANTENIMIENTO PROTEGIDO (SHA-256)
  // ==========================================================================

  function openReferralTermsModal() {
    document.getElementById("referral-terms-modal")?.classList.remove("hidden");
  }

  function closeReferralTermsModal() {
    document.getElementById("referral-terms-modal")?.classList.add("hidden");
  }

  async function sha256Hex(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function openAdminModal() {
    document.getElementById("admin-modal").classList.remove("hidden");
  }

  function closeAdminModal() {
    document.getElementById("admin-modal").classList.add("hidden");
  }

  async function verifyAdminPin() {
    const input = document.getElementById("admin-pin-input");
    const errorEl = document.getElementById("admin-pin-error");
    const pin = (input.value || "").trim();

    const salted = `${CFG.adminPinSalt}${pin}${CFG.adminPinSuffix}`;
    const hash = await sha256Hex(salted);

    if (hash === CFG.adminPinHash) {
      errorEl.style.display = "none";
      document.getElementById("admin-login-view").style.display = "none";
      document.getElementById("admin-panel-view").style.display = "block";
      populateAdminPriceInputs();
      updateAdminGeneratedUrl();
    } else {
      errorEl.style.display = "block";
      errorEl.textContent = "Contraseña incorrecta.";
    }
  }

  function switchAdminTab(tab) {
    document.querySelectorAll(".admin-tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === tab);
    });
    const pricesView = document.getElementById("admin-tab-prices");
    const linksView = document.getElementById("admin-tab-links");
    if (pricesView)
      pricesView.style.display = tab === "prices" ? "block" : "none";
    if (linksView)
      linksView.style.display = tab === "links" ? "block" : "none";
  }

  function populateAdminPriceInputs() {
    // Videos
    const vGrabo = document.getElementById("adm-price-v-grabo");
    if (vGrabo && CFG.videos?.modalidades?.graboEdiPubli) {
      vGrabo.value = CFG.videos.modalidades.graboEdiPubli.precioBase;
    }

    const vEdi = document.getElementById("adm-price-v-edi");
    if (vEdi && CFG.videos?.modalidades?.ediPubli) {
      vEdi.value = CFG.videos.modalidades.ediPubli.precioBase;
    }

    // CM
    const cmPres = document.getElementById("adm-price-cm-presencia");
    if (cmPres) {
      cmPres.value =
        CFG.cm?.planes?.find((p) => p.id === "presencia")?.precioMensual ||
        180000;
    }

    const cmCrec = document.getElementById("adm-price-cm-crecimiento");
    if (cmCrec) {
      cmCrec.value =
        CFG.cm?.planes?.find((p) => p.id === "crecimiento")?.precioMensual ||
        280000;
    }

    const cmTot = document.getElementById("adm-price-cm-total");
    if (cmTot) {
      cmTot.value =
        CFG.cm?.planes?.find((p) => p.id === "total")?.precioMensual || 400000;
    }

    // Tienda
    const toWsp = document.getElementById("adm-price-to-wsp");
    if (toWsp) {
      toWsp.value =
        CFG.tienda?.opciones?.find((o) => o.id === "catalogoWsp")
          ?.precioUnico || 50000;
    }

    const toNube = document.getElementById("adm-price-to-nube");
    if (toNube) {
      toNube.value =
        CFG.tienda?.opciones?.find((o) => o.id === "tiendaNube")?.precioUnico ||
        50000;
    }

    const toAmbos = document.getElementById("adm-price-to-ambos");
    if (toAmbos) {
      toAmbos.value =
        CFG.tienda?.precioAmbos !== undefined ? CFG.tienda.precioAmbos : 100000;
    }

    // Meses
    const m2 = document.getElementById("adm-disc-m-2");
    if (m2) m2.value = getMonthDiscountPct(2);

    const m3 = document.getElementById("adm-disc-m-3");
    if (m3) m3.value = getMonthDiscountPct(3);

    const m6 = document.getElementById("adm-disc-m-6");
    if (m6) m6.value = getMonthDiscountPct(6);

    const m9 = document.getElementById("adm-disc-m-9");
    if (m9) m9.value = getMonthDiscountPct(9);

    const m12 = document.getElementById("adm-disc-m-12");
    if (m12) m12.value = getMonthDiscountPct(12);

    // Videos Vol
    const v2 = document.getElementById("adm-disc-v-2");
    if (v2) v2.value = getVideoUnitDiscountPct(2);

    const v3 = document.getElementById("adm-disc-v-3");
    if (v3) v3.value = getVideoUnitDiscountPct(3);

    const v4 = document.getElementById("adm-disc-v-4");
    if (v4) v4.value = getVideoUnitDiscountPct(4);

    const v5 = document.getElementById("adm-disc-v-5");
    if (v5) v5.value = getVideoUnitDiscountPct(5);

    const v6 = document.getElementById("adm-disc-v-6");
    if (v6) v6.value = getVideoUnitDiscountPct(6);

    // Alianzas
    const inu = document.getElementById("adm-disc-inu");
    if (inu) inu.value = CFG.inucorn?.descuentoPct || 10;

    const ref = document.getElementById("adm-disc-ref");
    if (ref) ref.value = CFG.referidos?.descuentoPct || 25;
  }

  function saveAdminPrices() {
    const customConfig = {
      videos: {
        graboEdiPubli:
          parseInt(
            document.getElementById("adm-price-v-grabo")?.value,
            10
          ) || 50000,
        ediPubli:
          parseInt(document.getElementById("adm-price-v-edi")?.value, 10) ||
          35000,
        descuentos: {
          2:
            parseInt(document.getElementById("adm-disc-v-2")?.value, 10) || 10,
          3:
            parseInt(document.getElementById("adm-disc-v-3")?.value, 10) || 20,
          4:
            parseInt(document.getElementById("adm-disc-v-4")?.value, 10) || 30,
          5:
            parseInt(document.getElementById("adm-disc-v-5")?.value, 10) || 40,
          6:
            parseInt(document.getElementById("adm-disc-v-6")?.value, 10) || 50,
        },
      },
      cm: {
        presencia:
          parseInt(
            document.getElementById("adm-price-cm-presencia")?.value,
            10
          ) || 180000,
        crecimiento:
          parseInt(
            document.getElementById("adm-price-cm-crecimiento")?.value,
            10
          ) || 280000,
        total:
          parseInt(
            document.getElementById("adm-price-cm-total")?.value,
            10
          ) || 400000,
      },
      tienda: {
        catalogoWsp:
          parseInt(
            document.getElementById("adm-price-to-wsp")?.value,
            10
          ) || 50000,
        tiendaNube:
          parseInt(
            document.getElementById("adm-price-to-nube")?.value,
            10
          ) || 50000,
        ambos:
          parseInt(
            document.getElementById("adm-price-to-ambos")?.value,
            10
          ) || 100000,
      },
      meses: {
        2: parseInt(document.getElementById("adm-disc-m-2")?.value, 10) || 10,
        3: parseInt(document.getElementById("adm-disc-m-3")?.value, 10) || 20,
        6: parseInt(document.getElementById("adm-disc-m-6")?.value, 10) || 30,
        9: parseInt(document.getElementById("adm-disc-m-9")?.value, 10) || 35,
        12:
          parseInt(document.getElementById("adm-disc-m-12")?.value, 10) || 40,
      },
      inucorn: {
        descuentoPct:
          parseInt(document.getElementById("adm-disc-inu")?.value, 10) || 10,
      },
      referidos: {
        descuentoPct:
          parseInt(document.getElementById("adm-disc-ref")?.value, 10) || 25,
      },
    };

    localStorage.setItem("FEA_CUSTOM_CONFIG", JSON.stringify(customConfig));
    applyConfigOverrides(customConfig);

    const statusEl = document.getElementById("admin-prices-status");
    if (statusEl) {
      statusEl.className = "admin-status-message success";
      statusEl.textContent =
        "✅ ¡Precios y descuentos guardados y aplicados con éxito en todo el cotizador!";
      statusEl.style.display = "block";
      setTimeout(() => {
        statusEl.style.display = "none";
      }, 3500);
    }

    renderCurrentStep();
  }

  function resetAdminPrices() {
    if (
      !confirm(
        "¿Seguro que querés restablecer todos los precios y descuentos a los valores originales de fábrica?"
      )
    ) {
      return;
    }
    localStorage.removeItem("FEA_CUSTOM_CONFIG");

    applyConfigOverrides({
      videos: {
        graboEdiPubli:
          DEFAULT_CFG.videos.modalidades.graboEdiPubli.precioBase,
        ediPubli: DEFAULT_CFG.videos.modalidades.ediPubli.precioBase,
        descuentos: { 2: 10, 3: 20, 4: 30, 5: 40, 6: 50 },
      },
      cm: {
        presencia: DEFAULT_CFG.cm.planes[0].precioMensual,
        crecimiento: DEFAULT_CFG.cm.planes[1].precioMensual,
        total: DEFAULT_CFG.cm.planes[2].precioMensual,
      },
      tienda: {
        catalogoWsp: DEFAULT_CFG.tienda.opciones[0].precioUnico,
        tiendaNube: DEFAULT_CFG.tienda.opciones[1].precioUnico,
        ambos: DEFAULT_CFG.tienda.precioAmbos || 100000,
      },
      meses: { 2: 10, 3: 20, 6: 30, 9: 35, 12: 40 },
      inucorn: { descuentoPct: DEFAULT_CFG.inucorn.descuentoPct },
      referidos: {
        descuentoPct: DEFAULT_CFG.referidos
          ? DEFAULT_CFG.referidos.descuentoPct
          : 25,
      },
    });

    populateAdminPriceInputs();

    const statusEl = document.getElementById("admin-prices-status");
    if (statusEl) {
      statusEl.className = "admin-status-message info";
      statusEl.textContent = "🔄 Valores restablecidos a los de fábrica.";
      statusEl.style.display = "block";
      setTimeout(() => {
        statusEl.style.display = "none";
      }, 3500);
    }

    renderCurrentStep();
  }

  function copyAdminConfigToClipboard() {
    const codeSnippet = `// Valores actualizados para config.js:
videos: {
  modalidades: {
    graboEdiPubli: { precioBase: ${CFG.videos.modalidades.graboEdiPubli.precioBase} },
    ediPubli: { precioBase: ${CFG.videos.modalidades.ediPubli.precioBase} }
  },
  descuentoPorUnidad: ${JSON.stringify(CFG.videos.descuentoPorUnidad, null, 4)}
},
cm: {
  planes: [
    { id: "presencia", precioMensual: ${CFG.cm.planes.find((p) => p.id === "presencia")?.precioMensual} },
    { id: "crecimiento", precioMensual: ${CFG.cm.planes.find((p) => p.id === "crecimiento")?.precioMensual} },
    { id: "total", precioMensual: ${CFG.cm.planes.find((p) => p.id === "total")?.precioMensual} }
  ]
},
tienda: {
  precioAmbos: ${CFG.tienda.precioAmbos},
  opciones: [
    { id: "catalogoWsp", precioUnico: ${CFG.tienda.opciones.find((o) => o.id === "catalogoWsp")?.precioUnico} },
    { id: "tiendaNube", precioUnico: ${CFG.tienda.opciones.find((o) => o.id === "tiendaNube")?.precioUnico} }
  ]
},
mesesOpciones: ${JSON.stringify(CFG.mesesOpciones.map((m) => ({ meses: m.meses, descuentoPct: m.descuentoPct })), null, 4)},
inucorn: { descuentoPct: ${CFG.inucorn.descuentoPct} },
referidos: { descuentoPct: ${CFG.referidos?.descuentoPct || 25} }
`;

    navigator.clipboard.writeText(codeSnippet);
    const statusEl = document.getElementById("admin-prices-status");
    if (statusEl) {
      statusEl.className = "admin-status-message info";
      statusEl.textContent =
        "📋 ¡Código copiado al portapapeles! Listo para pegar en config.js.";
      statusEl.style.display = "block";
      setTimeout(() => {
        statusEl.style.display = "none";
      }, 3500);
    }
  }

  function updateAdminGeneratedUrl() {
    const baseUrl = window.location.origin + window.location.pathname;
    const chkV = document.getElementById("adm-chk-v")?.checked;
    const chkCM = document.getElementById("adm-chk-cm")?.checked;
    const chkTO = document.getElementById("adm-chk-to")?.checked;
    const chkINU = document.getElementById("adm-chk-inu")?.checked;
    const chkREF = document.getElementById("adm-chk-ref")?.checked;
    const client = document.getElementById("adm-client-name").value.trim();
    const bizEl = document.getElementById("adm-business-name");
    const biz = bizEl ? bizEl.value.trim() : "";
    const note = document.getElementById("adm-client-note").value.trim();
    const uber = parseInt(
      document.getElementById("adm-uber-cost").value.trim() || "0",
      10
    );

    const parts = [];
    if (chkV) parts.push("v");
    if (chkCM) parts.push("cm");
    if (chkTO) parts.push("to");
    if (chkINU) parts.push("inu");
    if (chkREF) parts.push("ref");
    if (client) parts.push(`c=${encodeURIComponent(client)}`);
    if (biz) parts.push(`b=${encodeURIComponent(biz)}`);
    if (note) parts.push(`nota=${encodeURIComponent(note)}`);
    if (uber > 0) parts.push(`uber=${uber}`);

    const finalUrl =
      parts.length > 0 ? `${baseUrl}?${parts.join("&")}` : baseUrl;
    document.getElementById("adm-generated-url").textContent = finalUrl;
    return finalUrl;
  }

  // Inicialización
  document.addEventListener("DOMContentLoaded", () => {
    loadPersistedConfig();
    parseUrlParameters();
    setupEventListeners();
    renderCurrentStep();
  });
})();
