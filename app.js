/**
 * ============================================================================
 * RECORRIDO STEP-BY-STEP (ONE-PAGE FLOW) - FRAN ESTUVO ACÁ
 * ============================================================================
 */

(function () {
  const CFG = window.COTIZADOR_CONFIG;

  // Estado global
  const state = {
    // Parámetros de URL
    enabledModules: { v: false, cm: false, to: false, inu: false },
    hasExplicitParams: false,
    clientName: "",
    businessName: "",
    customNote: "",
    uberOneWay: 0,

    // Decisiones del cliente
    selectedServices: { v: false, cm: false, to: false, inu: false }, // Usado si entra sin parámetros
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
    if (unitIndex1Based <= 1) return 0;
    if (unitIndex1Based === 2) return 10;
    if (unitIndex1Based === 3) return 20;
    if (unitIndex1Based === 4) return 30;
    if (unitIndex1Based === 5) return 40;
    return 50; // Del 6° en adelante 50% c/u
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
    if (choice === "catalogoWsp") {
      return { totalFinal: 50000, label: "Catálogo en WhatsApp Business" };
    }
    if (choice === "tiendaNube") {
      return {
        totalFinal: 50000,
        label: "Tienda Online (Tienda Nube / Empretienda)",
      };
    }
    if (choice === "ambos") {
      return {
        totalFinal: 100000,
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

    if (hasV || hasCM || hasTO || hasINU) {
      state.hasExplicitParams = true;
      state.enabledModules.v = hasV;
      state.enabledModules.cm = hasCM;
      state.enabledModules.to = hasTO;
      state.enabledModules.inu = hasINU;
    } else {
      state.hasExplicitParams = false;
      state.enabledModules.v = false;
      state.enabledModules.cm = false;
      state.enabledModules.to = false;
      state.enabledModules.inu = false;
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

    // Paso de Inucorn (si está en la URL o si lo seleccionó en servicios iniciales)
    if (wantsINU) {
      queue.push({ id: "inu_banner", title: "Beneficio Imprenta" });
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
      case "inu_banner":
        html = renderStep_InuBanner();
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
            <div class="decision-card-title inucorn-text-title">🎁 Descuento especial en imprenta y papelería (Inucorn)</div>
            <div class="decision-card-desc">10% OFF en folletería, tarjetas, stickers y cartelería para tu local o packaging con el código de Fran.</div>
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
            <span class="decision-card-price">Desde $50.000 <small style="font-size:0.85rem; font-weight:600; color:var(--text-muted);">por video base</small></span>
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
            <span class="decision-card-price">Desde $35.000 <small style="font-size:0.85rem; font-weight:600; color:var(--text-muted);">por video base</small></span>
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
        <p class="step-question-subtitle">A mayor cantidad mensual, mayor descuento: cada video adicional te sale más barato que el anterior (¡hasta 50% OFF a partir del 6°!).</p>
      </div>

      <div class="qty-grid-compact">
        ${cardsHTML}
      </div>

      <div class="manual-stepper-box">
        <div>
          <div style="font-weight:900; font-size:1.05rem;">¿Querés más de 6 videos al mes?</div>
          <div style="font-size:0.85rem; color:var(--text-muted);">Del 6° en adelante van todos al 50% OFF</div>
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
              <span class="month-pill-badge">⭐ -20% OFF</span>
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
              <span class="month-pill-badge">🔥 -30% OFF</span>
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
              <span class="month-pill-badge" style="background:#fef3c7; color:#92400e;">🚀 -35% OFF</span>
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
              <span class="month-pill-title">12 Meses (1 Año)</span>
              <span class="month-pill-badge" style="background:#fef3c7; color:#92400e;">👑 -40% OFF</span>
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
              <span style="font-size:0.85rem; font-weight:800; color:var(--success);">Hasta 40% OFF congelando</span>
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
              <span class="month-pill-badge">⭐ -20% OFF</span>
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
              <span class="month-pill-badge">🔥 -30% OFF</span>
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
              <span class="month-pill-badge" style="background:#fef3c7; color:#92400e;">🚀 -35% OFF</span>
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
              <span class="month-pill-title">12 Meses (1 Año)</span>
              <span class="month-pill-badge" style="background:#fef3c7; color:#92400e;">👑 -40% OFF</span>
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
            <span class="decision-card-price">$50.000 <small style="font-size:0.85rem; color:var(--text-muted);">(pago único)</small></span>
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
            <span class="decision-card-price">$50.000 <small style="font-size:0.85rem; color:var(--text-muted);">(pago único)</small></span>
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
            <span class="decision-card-price">$100.000 <small style="font-size:0.85rem; color:var(--text-muted);">(pago único)</small></span>
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

  // Paso INU: Cupón Inucorn
  function renderStep_InuBanner() {
    const inu = CFG.inucorn;
    const clientLabel = state.clientName || (state.businessName || "un cliente");
    const msg = `Hola! Soy ${clientLabel} y escribo de parte de Fran Estuvo Acá porque me gustaría solicitar un presupuesto!`;
    const inuWspUrl = `https://wa.me/${inu.whatsappNumber}?text=${encodeURIComponent(msg)}`;

    return `
      <div class="step-header">
        <h1 class="step-question-title">🎁 ¡Tenés 10% OFF en Imprenta Inucorn!</h1>
        <p class="step-question-subtitle">${inu.descripcion}</p>
      </div>

      <div class="inucorn-step-card">
        <div style="font-size:1.1rem; font-weight:800; color:#5b21b6;">Tu código de descuento exclusivo:</div>
        <div class="inucorn-coupon-box">${inu.codigoCupon}</div>
        
        <a href="${inuWspUrl}" target="_blank" rel="noopener noreferrer" class="inucorn-wsp-btn">
          <span>💬 Contactar a Inucorn ↗</span>
          <small style="font-size:0.75rem; opacity:0.9;">(Se abre en pestaña nueva de WhatsApp)</small>
        </a>
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

    // Item Inucorn (si lo seleccionó)
    const wantsINU = state.hasExplicitParams
      ? state.enabledModules.inu
      : state.selectedServices.inu;
    if (wantsINU) {
      items.push(`
        <div class="final-summary-item" style="border-left: 3px solid var(--inucorn-purple); padding-left: 10px;">
          <div>
            <div class="final-item-title inucorn-text-title">🎁 Beneficio Imprenta Inucorn (10% OFF)</div>
            <div class="final-item-desc">Código exclusivo reservado: <strong>${CFG.inucorn.codigoCupon}</strong></div>
          </div>
          <div class="final-item-price" style="color:var(--inucorn-purple); font-size:1rem;">
            Activado
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

    const wantsINU = state.hasExplicitParams
      ? state.enabledModules.inu
      : state.selectedServices.inu;
    if (wantsINU) {
      lines.push(`*Beneficio Imprenta Inucorn:* 10% OFF activado (Código: ${CFG.inucorn.codigoCupon})`);
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
            !state.selectedServices.inu
          ) {
            alert("Elegí al menos un servicio para comenzar.");
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

    // Inputs de Mantenimiento / Admin
    const adminInputs = [
      "adm-chk-v",
      "adm-chk-cm",
      "adm-chk-to",
      "adm-chk-inu",
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
  // 7. MODO ADMIN / MANTENIMIENTO PROTEGIDO (SHA-256)
  // ==========================================================================

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
    if (client) parts.push(`c=${encodeURIComponent(client)}`);
    if (biz) parts.push(`b=${encodeURIComponent(biz)}`);
    if (note) parts.push(`nota=${encodeURIComponent(note)}`);
    if (uber > 0) parts.push(`uber=${uber}`);
    if (uber > 0) parts.push(`uber=${uber}`);

    const finalUrl =
      parts.length > 0 ? `${baseUrl}?${parts.join("&")}` : baseUrl;
    document.getElementById("adm-generated-url").textContent = finalUrl;
    return finalUrl;
  }

  // Inicialización
  document.addEventListener("DOMContentLoaded", () => {
    parseUrlParameters();
    setupEventListeners();
    renderCurrentStep();
  });
})();
