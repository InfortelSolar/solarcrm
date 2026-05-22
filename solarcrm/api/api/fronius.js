// js/fronius.js — Integração Fronius Solar.web para o SolarCRM
// Chama /api/fronius (proxy Vercel) e injeta os cards no dashboard
// Resiliente: não trava o app se falhar

const Fronius = (() => {
  const API = "/api/fronius";

  function statusLabel(s) {
    if (!s) return { text: "–", cls: "status-unknown" };
    const map = {
      running:  { text: "Online",   cls: "status-online"  },
      online:   { text: "Online",   cls: "status-online"  },
      error:    { text: "Erro",     cls: "status-error"   },
      offline:  { text: "Offline",  cls: "status-offline" },
      warning:  { text: "Alerta",   cls: "status-warning" },
    };
    return map[s.toLowerCase()] ?? { text: s, cls: "status-unknown" };
  }

  function fmt(val, unit, decimals = 2) {
    if (val === null || val === undefined) return "–";
    return `${parseFloat(val).toFixed(decimals)} ${unit}`;
  }

  function renderCard(plant) {
    const st = statusLabel(plant.status);
    const hasError = !!plant.error;

    return `
      <div class="plant-card fronius-card" data-id="${plant.id}">
        <div class="card-header">
          <span class="brand-badge fronius">Fronius</span>
          <span class="status-dot ${st.cls}" title="${st.text}"></span>
        </div>
        <h3 class="plant-name">${plant.name}</h3>
        ${hasError ? `<p class="card-error">⚠️ ${plant.error}</p>` : `
        <div class="card-metrics">
          <div class="metric">
            <span class="metric-label">Hoje</span>
            <span class="metric-value">${fmt(plant.eToday_kWh, "kWh")}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Agora</span>
            <span class="metric-value">${plant.powerNow_W !== null ? fmt(plant.powerNow_W / 1000, "kW") : "–"}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Pico</span>
            <span class="metric-value">${fmt(plant.peakPower_kWp, "kWp")}</span>
          </div>
        </div>
        `}
      </div>`;
  }

  async function load() {
    console.log("[Fronius] Carregando...");

    // Encontra o container do dashboard (mesmo padrão do gdash.js / solplanet.js)
    const container =
      document.getElementById("fronius-plants") ??
      document.getElementById("plants-container") ??
      document.querySelector(".plants-grid");

    if (!container) {
      console.warn("[Fronius] Container não encontrado, abortando.");
      return;
    }

    // Skeleton loader
    const skeletonId = "fronius-skeleton";
    container.insertAdjacentHTML(
      "beforeend",
      `<div id="${skeletonId}" class="loading-skeleton">Carregando Fronius…</div>`
    );

    try {
      const res = await fetch(API);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      document.getElementById(skeletonId)?.remove();

      if (!data.plants?.length) {
        container.insertAdjacentHTML(
          "beforeend",
          `<p class="no-data">Nenhuma planta Fronius encontrada.</p>`
        );
        return;
      }

      const html = data.plants.map(renderCard).join("");
      container.insertAdjacentHTML("beforeend", html);

      console.log(`[Fronius] ${data.plants.length} plantas carregadas.`);

      // Dispara evento para o app.js poder somar totais
      document.dispatchEvent(
        new CustomEvent("fronius:loaded", { detail: data })
      );
    } catch (err) {
      document.getElementById(skeletonId)?.remove();
      console.error("[Fronius] Falha ao carregar:", err.message);

      // Não trava o app — apenas mostra aviso discreto
      container.insertAdjacentHTML(
        "beforeend",
        `<div class="card-error-banner">
          ⚠️ Fronius indisponível: ${err.message}
        </div>`
      );
    }
  }

  return { load };
})();
