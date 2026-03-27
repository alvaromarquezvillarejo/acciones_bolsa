/**
 * app.js — Lógica del frontend de Stock Tracker.
 *
 * Se encarga de:
 *  1. Capturar los inputs del usuario (ticker, fechas).
 *  2. Realizar peticiones fetch al backend FastAPI.
 *  3. Renderizar tres gráficos ECharts por cada ticker analizado:
 *     - Precio + SMAs
 *     - RSI
 *     - MACD (histograma + líneas)
 *  4. Acumular gráficos sin eliminar los anteriores.
 */

// ──────────────────────────────────────────────
// Configuración
// ──────────────────────────────────────────────
const API_BASE = "http://localhost:8000";

// Colores consistentes para las series
const COLORS = {
  price: "#e2e8f0",
  sma8: "#facc15",
  sma20: "#fb923c",
  sma50: "#a78bfa",
  sma200: "#f87171",
  rsi: "#38bdf8",
  rsiOver: "rgba(239,68,68,0.15)",
  rsiUnder: "rgba(34,197,94,0.15)",
  macdLine: "#38bdf8",
  macdSignal: "#fb923c",
  macdHistUp: "#22c55e",
  macdHistDown: "#ef4444",
};

// ──────────────────────────────────────────────
// Referencias al DOM
// ──────────────────────────────────────────────
const tickerInput = document.getElementById("ticker");
const startDateInput = document.getElementById("start-date");
const endDateInput = document.getElementById("end-date");
const btnAnalyze = document.getElementById("btn-analyze");
const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error-msg");
const chartsArea = document.getElementById("charts-area");
const emptyState = document.getElementById("empty-state");
const tickerListEl = document.getElementById("ticker-list");

// Registro de tickers ya cargados
const loadedTickers = [];

// Instancias de ECharts para poder hacer resize
const chartInstances = [];

// ──────────────────────────────────────────────
// Valores por defecto de las fechas (último año)
// ──────────────────────────────────────────────
(function setDefaultDates() {
  const today = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(today.getFullYear() - 1);

  endDateInput.value = formatDate(today);
  startDateInput.value = formatDate(oneYearAgo);
})();

/** Formatea un Date como YYYY-MM-DD */
function formatDate(d) {
  return d.toISOString().split("T")[0];
}

// ──────────────────────────────────────────────
// Utilidades UI
// ──────────────────────────────────────────────

/** Muestra un mensaje de error en el panel lateral */
function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.remove("hidden");
}

/** Oculta el mensaje de error */
function hideError() {
  errorEl.classList.add("hidden");
  errorEl.textContent = "";
}

/** Muestra / oculta el spinner de carga */
function setLoading(state) {
  loadingEl.classList.toggle("hidden", !state);
  btnAnalyze.disabled = state;
  btnAnalyze.classList.toggle("opacity-50", state);
}

/** Actualiza la lista de tickers en el sidebar */
function updateTickerList(ticker) {
  loadedTickers.push(ticker);
  tickerListEl.innerHTML = loadedTickers
    .map(
      (t) =>
        `<li class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-accent inline-block"></span>
          <span class="text-slate-300 font-mono">${escapeHtml(t)}</span>
        </li>`
    )
    .join("");
}

/** Escapa texto para evitar inyección HTML */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

// ──────────────────────────────────────────────
// Petición al backend
// ──────────────────────────────────────────────

/**
 * Llama al endpoint /api/stock/{ticker} del backend.
 * @param {string} ticker
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate   - YYYY-MM-DD
 * @returns {Promise<Object>} datos del ticker
 */
async function fetchStockData(ticker, startDate, endDate) {
  const url = `${API_BASE}/api/stock/${encodeURIComponent(ticker)}?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Error ${res.status} del servidor`);
  }

  return res.json();
}

// ──────────────────────────────────────────────
// Creación de gráficos con ECharts
// ──────────────────────────────────────────────

/**
 * Crea un bloque de gráficos (precio+SMAs, RSI, MACD) para un ticker
 * y lo añade al área de gráficos sin borrar los anteriores.
 */
function renderCharts(data) {
  // Ocultar el empty state si existe
  if (emptyState) emptyState.remove();

  // Contenedor principal del ticker
  const wrapper = document.createElement("div");
  wrapper.className =
    "bg-card rounded-xl border border-slate-700 p-5 space-y-4 shadow-lg";

  // Título del bloque
  const title = document.createElement("h2");
  title.className = "text-xl font-bold text-white flex items-center gap-2";
  title.innerHTML = `<span class="text-accent font-mono">${escapeHtml(data.ticker)}</span>
    <span class="text-sm font-normal text-slate-400">
      ${escapeHtml(data.dates[0])} → ${escapeHtml(data.dates[data.dates.length - 1])}
    </span>`;
  wrapper.appendChild(title);

  // Helper para crear un div contenedor de gráfico
  function createChartContainer(height) {
    const div = document.createElement("div");
    div.style.width = "100%";
    div.style.height = height;
    wrapper.appendChild(div);
    return div;
  }

  // 1) Gráfico principal — Precio + SMAs
  const priceContainer = createChartContainer("420px");
  // 2) Gráfico RSI
  const rsiContainer = createChartContainer("220px");
  // 3) Gráfico MACD
  const macdContainer = createChartContainer("220px");

  chartsArea.appendChild(wrapper);

  // Inicializar ECharts DESPUÉS de insertar en el DOM
  const priceChart = echarts.init(priceContainer, "dark");
  const rsiChart = echarts.init(rsiContainer, "dark");
  const macdChart = echarts.init(macdContainer, "dark");

  chartInstances.push(priceChart, rsiChart, macdChart);

  // ── Opciones del gráfico de precio ──
  priceChart.setOption({
    backgroundColor: "transparent",
    title: {
      text: `Precio de Cierre y Medias Móviles`,
      textStyle: { color: "#e2e8f0", fontSize: 14 },
      left: "center",
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#1e293b",
      borderColor: "#334155",
      textStyle: { color: "#e2e8f0" },
    },
    legend: {
      data: ["Precio", "SMA 8", "SMA 20", "SMA 50", "SMA 200"],
      bottom: 0,
      textStyle: { color: "#94a3b8" },
    },
    grid: { top: 40, right: 20, bottom: 40, left: 60 },
    xAxis: {
      type: "category",
      data: data.dates,
      axisLabel: { color: "#64748b" },
      axisLine: { lineStyle: { color: "#334155" } },
    },
    yAxis: {
      type: "value",
      scale: true,
      splitLine: { lineStyle: { color: "#1e293b" } },
      axisLabel: { color: "#64748b" },
    },
    dataZoom: [
      { type: "inside", start: 0, end: 100 },
      { type: "slider", start: 0, end: 100, height: 20, bottom: 30,
        borderColor: "#334155", fillerColor: "rgba(56,189,248,0.15)",
        textStyle: { color: "#94a3b8" },
      },
    ],
    series: [
      {
        name: "Precio",
        type: "line",
        data: data.close,
        lineStyle: { width: 2, color: COLORS.price },
        itemStyle: { color: COLORS.price },
        symbol: "none",
        z: 5,
      },
      makeSMASeries("SMA 8", data.sma_8, COLORS.sma8),
      makeSMASeries("SMA 20", data.sma_20, COLORS.sma20),
      makeSMASeries("SMA 50", data.sma_50, COLORS.sma50),
      makeSMASeries("SMA 200", data.sma_200, COLORS.sma200),
    ],
  });

  // ── Opciones del gráfico RSI ──
  rsiChart.setOption({
    backgroundColor: "transparent",
    title: {
      text: "RSI (14)",
      textStyle: { color: "#e2e8f0", fontSize: 14 },
      left: "center",
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#1e293b",
      borderColor: "#334155",
      textStyle: { color: "#e2e8f0" },
    },
    grid: { top: 35, right: 20, bottom: 20, left: 60 },
    xAxis: {
      type: "category",
      data: data.dates,
      axisLabel: { color: "#64748b" },
      axisLine: { lineStyle: { color: "#334155" } },
      show: false,
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 100,
      splitLine: { lineStyle: { color: "#1e293b" } },
      axisLabel: { color: "#64748b" },
    },
    dataZoom: [{ type: "inside", start: 0, end: 100 }],
    visualMap: {
      show: false,
      pieces: [
        { gte: 70, color: "#ef4444" },
        { gte: 30, lt: 70, color: COLORS.rsi },
        { lt: 30, color: "#22c55e" },
      ],
      seriesIndex: 0,
    },
    series: [
      {
        name: "RSI",
        type: "line",
        data: data.rsi_14,
        lineStyle: { width: 2 },
        symbol: "none",
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { type: "dashed", width: 1 },
          data: [
            {
              yAxis: 70,
              label: { formatter: "70", color: "#ef4444", position: "insideEndTop" },
              lineStyle: { color: "#ef4444" },
            },
            {
              yAxis: 30,
              label: { formatter: "30", color: "#22c55e", position: "insideEndBottom" },
              lineStyle: { color: "#22c55e" },
            },
          ],
        },
        markArea: {
          silent: true,
          data: [
            [
              { yAxis: 70, itemStyle: { color: COLORS.rsiOver } },
              { yAxis: 100 },
            ],
            [
              { yAxis: 0, itemStyle: { color: COLORS.rsiUnder } },
              { yAxis: 30 },
            ],
          ],
        },
      },
    ],
  });

  // ── Opciones del gráfico MACD ──
  // Colorear barras del histograma según signo
  const histColors = data.macd_hist.map((v) =>
    v !== null && v >= 0 ? COLORS.macdHistUp : COLORS.macdHistDown
  );

  macdChart.setOption({
    backgroundColor: "transparent",
    title: {
      text: "MACD (12, 26, 9)",
      textStyle: { color: "#e2e8f0", fontSize: 14 },
      left: "center",
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#1e293b",
      borderColor: "#334155",
      textStyle: { color: "#e2e8f0" },
    },
    legend: {
      data: ["MACD", "Señal", "Histograma"],
      bottom: 0,
      textStyle: { color: "#94a3b8" },
    },
    grid: { top: 35, right: 20, bottom: 35, left: 60 },
    xAxis: {
      type: "category",
      data: data.dates,
      axisLabel: { color: "#64748b" },
      axisLine: { lineStyle: { color: "#334155" } },
      show: false,
    },
    yAxis: {
      type: "value",
      scale: true,
      splitLine: { lineStyle: { color: "#1e293b" } },
      axisLabel: { color: "#64748b" },
    },
    dataZoom: [{ type: "inside", start: 0, end: 100 }],
    series: [
      {
        name: "Histograma",
        type: "bar",
        data: data.macd_hist.map((v, i) => ({
          value: v,
          itemStyle: { color: histColors[i] },
        })),
        barWidth: "60%",
      },
      {
        name: "MACD",
        type: "line",
        data: data.macd,
        lineStyle: { width: 1.5, color: COLORS.macdLine },
        itemStyle: { color: COLORS.macdLine },
        symbol: "none",
      },
      {
        name: "Señal",
        type: "line",
        data: data.macd_signal,
        lineStyle: { width: 1.5, color: COLORS.macdSignal },
        itemStyle: { color: COLORS.macdSignal },
        symbol: "none",
      },
    ],
  });

  // Scroll automático hasta el nuevo bloque
  wrapper.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Crea la configuración de una serie SMA para ECharts.
 */
function makeSMASeries(name, data, color) {
  return {
    name,
    type: "line",
    data,
    lineStyle: { width: 1.2, color, type: "dashed" },
    itemStyle: { color },
    symbol: "none",
  };
}

// ──────────────────────────────────────────────
// Manejador principal del botón Analizar
// ──────────────────────────────────────────────
btnAnalyze.addEventListener("click", async () => {
  hideError();

  const ticker = tickerInput.value.trim().toUpperCase();
  const startDate = startDateInput.value;
  const endDate = endDateInput.value;

  // Validaciones básicas
  if (!ticker) {
    showError("Introduce un ticker válido (ej. AAPL, TSLA).");
    return;
  }
  if (!startDate || !endDate) {
    showError("Selecciona las fechas de inicio y fin.");
    return;
  }
  if (startDate >= endDate) {
    showError("La fecha de inicio debe ser anterior a la fecha de fin.");
    return;
  }

  setLoading(true);

  try {
    const data = await fetchStockData(ticker, startDate, endDate);
    renderCharts(data);
    updateTickerList(ticker);
    // Limpiar el input del ticker para facilitar nuevas búsquedas
    tickerInput.value = "";
    tickerInput.focus();
  } catch (err) {
    showError(err.message || "Error desconocido al obtener los datos.");
  } finally {
    setLoading(false);
  }
});

// Permitir lanzar el análisis con Enter
tickerInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnAnalyze.click();
});

// ──────────────────────────────────────────────
// Redimensionado responsivo de gráficos
// ──────────────────────────────────────────────
window.addEventListener("resize", () => {
  chartInstances.forEach((chart) => chart.resize());
});
