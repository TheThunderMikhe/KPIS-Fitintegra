"use strict";

/* Cifras de la red. Solo se calculan fórmulas verificadas:
   avance = ingresos_2026 / meta
   crec. vs 2025 = ingresos_2026 / ingresos_2025 - 1
   crec. vs 2024 = ingresos_2026 / ingresos_2024 - 1, o -1 si la base es 0
   % venta = venta / ingresos_2026, y la venta vacía cuenta como 0
   El estatus no se recalcula. */

const INPUT_FIELDS = [
  { key: "meta", label: "Meta", kind: "money", group: "resultado" },
  { key: "ingresos_2026", label: "Ingresos 2026", kind: "money", group: "resultado" },
  { key: "ingresos_2025", label: "Ingresos 2025", kind: "money", group: "resultado" },
  { key: "ingresos_2024", label: "Ingresos 2024", kind: "money", group: "resultado" },
  { key: "venta", label: "Venta", kind: "money", group: "resultado" },
  { key: "gastos_sin_inversion", label: "Gastos sin inversión", kind: "money", group: "resultado" },
  { key: "status", label: "Estatus", kind: "status", group: "resultado" },
  { key: "usuarios_activos_mes_anterior", label: "Usuarios activos mes anterior", kind: "count", group: "usuarios" },
  { key: "usuarios_activos", label: "Usuarios activos", kind: "count", group: "usuarios" },
  { key: "altas_digitales", label: "Altas digitales", kind: "count", group: "usuarios" },
  { key: "altas_tradicionales", label: "Altas tradicionales", kind: "count", group: "usuarios" },
  { key: "altas_seguimiento", label: "Altas de seguimiento", kind: "count", group: "usuarios" },
  { key: "inversion", label: "Inversión", kind: "money", group: "marketing" },
  { key: "alcance", label: "Alcance", kind: "count", group: "marketing" },
  { key: "conversaciones", label: "Conversaciones", kind: "count", group: "marketing" },
  { key: "recurente", label: "Recurrente", kind: "money", group: "canales", hint: "En Notion la columna se llama Recurente." },
  { key: "recuperado", label: "Recuperado", kind: "money", group: "canales" },
  { key: "pago_adelantado", label: "Pago adelantado", kind: "money", group: "canales" },
  { key: "retail", label: "Retail", kind: "money", group: "canales" },
  { key: "eventos", label: "Eventos", kind: "money", group: "canales" },
  { key: "agregadores", label: "Agregadores", kind: "money", group: "canales" },
  { key: "cargos_domiciliados", label: "Cargos domiciliados", kind: "money", group: "canales" },
  { key: "numero", label: "Número", kind: "count", group: "otro", hint: "Columna Número de Notion." },
];

const GROUPS = [
  { id: "resultado", label: "Resultado" },
  { id: "usuarios", label: "Usuarios y altas" },
  { id: "marketing", label: "Marketing" },
  { id: "canales", label: "Composición del ingreso" },
  { id: "otro", label: "Otros" },
];

const STATUS_CLASS = {
  "Hasta 50%": "badge-50",
  "Hasta 75%": "badge-75",
  "Hasta 90%": "badge-90",
  "Hasta 99%": "badge-99",
  "100%+": "badge-100",
};

const STATUS_RANK = {
  "Hasta 50%": 1,
  "Hasta 75%": 2,
  "Hasta 90%": 3,
  "Hasta 99%": 4,
  "100%+": 5,
};

const moneyFmt = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const countFmt = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat("es-MX", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const growthFmt = new Intl.NumberFormat("es-MX", {
  style: "percent",
  signDisplay: "exceptZero",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const axisPctFmt = new Intl.NumberFormat("es-MX", {
  style: "percent",
  maximumFractionDigits: 0,
});

const THEME_KEY = "fit-integra-tema";

let currentRows = [];
let currentCols = [];
let sortState = { id: "avance", dir: "desc" };
let avanceChart = null;
let lastNarrow = null;
let focusSlug = null;

document.getElementById("btn-imprimir").addEventListener("click", () => window.print());
document.getElementById("btn-tema").addEventListener("click", toggleTheme);
document.getElementById("tabla-head").addEventListener("click", onSort);
document.getElementById("unit-switch").addEventListener("click", onUnitClick);
window.addEventListener("hashchange", () => {
  if (currentRows.length) applySelection();
});
window.addEventListener("resize", () => {
  window.clearTimeout(onResize._timer);
  onResize._timer = window.setTimeout(onResize, 150);
});
syncThemeButton();
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
  if (storedTheme()) return;
  setTheme(event.matches ? "dark" : "light", false);
});

load().then(render).catch((error) => {
  const detail = error && error.message ? error.message : "Error al leer los datos.";
  showError(detail + " Si abriste el HTML como archivo, sírvelo en local: python3 -m http.server");
});

async function load() {
  const response = await fetch("data/kpis.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("No se pudo leer data/kpis.json (" + response.status + ").");
  }
  return response.json();
}

function render(data) {
  if (!data || !Array.isArray(data.unidades)) {
    throw new Error("data/kpis.json no trae la lista unidades.");
  }
  const rows = data.unidades.map(derive).filter(Boolean);
  if (!rows.length) {
    throw new Error("data/kpis.json no trae unidades con nombre.");
  }
  assignSlugs(rows);
  currentRows = rows;
  paintHeader(data);
  applySelection();
  document.getElementById("error-banner").hidden = true;
  document.getElementById("contenido").setAttribute("aria-busy", "false");
}

function assignSlugs(rows) {
  const seen = new Set();
  rows.forEach((row) => {
    let base = slugify(row.unidad) || "unidad";
    let slug = base;
    let n = 2;
    while (seen.has(slug)) {
      slug = base + "-" + n;
      n += 1;
    }
    seen.add(slug);
    row.slug = slug;
  });
}

function slugify(name) {
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readHash() {
  const raw = location.hash.replace(/^#/, "");
  if (!raw) return "";
  try {
    return decodeURIComponent(raw).trim().toLowerCase();
  } catch (error) {
    return raw.trim().toLowerCase();
  }
}

function activeUnit() {
  const slug = readHash();
  if (!slug || slug === "global") return null;
  return currentRows.find((row) => row.slug === slug) || null;
}

function applySelection() {
  const unit = activeUnit();
  paintSwitch(unit);
  paintScope(unit);
  const rows = unit ? [unit] : currentRows;
  paintNetwork(rows, unit);
  paintOther(rows, unit);
  renderChart(currentRows, unit);
  currentCols = buildColumns(rows);
  if (!currentCols.some((col) => col.id === sortState.id)) {
    const first = currentCols[0];
    sortState = { id: first.id, dir: first.prefer || "asc" };
  }
  paintTable(rows, unit);
  paintPending(rows, unit);
}

function onUnitClick(event) {
  const button = event.target.closest("button[data-slug]");
  if (!button) return;
  const slug = button.dataset.slug;
  focusSlug = slug;
  const current = readHash() || "global";
  if (current === slug) {
    applySelection();
    return;
  }
  location.hash = slug;
}

function paintSwitch(unit) {
  const host = document.getElementById("unit-switch");
  host.replaceChildren();
  const items = [{ slug: "global", label: "Global" }].concat(
    currentRows.map((row) => ({ slug: row.slug, label: row.unidad }))
  );
  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "unit-pill";
    button.dataset.slug = item.slug;
    button.textContent = item.label;
    const pressed = unit ? item.slug === unit.slug : item.slug === "global";
    button.setAttribute("aria-pressed", pressed ? "true" : "false");
    host.append(button);
  });
  if (focusSlug) {
    const again = host.querySelector('[data-slug="' + CSS.escape(focusSlug) + '"]');
    focusSlug = null;
    if (again) again.focus();
  }
}

function paintScope(unit) {
  document.getElementById("titulo-red").textContent = unit ? unit.unidad : "Totales de la red";
  document.getElementById("lead-red").textContent = unit
    ? "Cifras de " + unit.unidad + ". Los porcentajes usan las mismas fórmulas que el total de la red."
    : "Totales de las " + currentRows.length + " unidades. El crecimiento compara la suma de 2026 con la suma del año base, no el promedio de cada unidad.";
  document.getElementById("titulo-otras").textContent = unit ? "Otras cifras" : "Otras cifras con captura";
  document.getElementById("lead-otras").textContent = unit
    ? "Solo lo que " + unit.unidad + " trae capturado. No se calcula utilidad."
    : "Solo se suman las unidades que traen dato. No se calcula utilidad.";
  document.getElementById("titulo-tabla").textContent = unit ? unit.unidad : "Detalle por unidad";
  document.getElementById("lead-tabla").textContent = unit
    ? "Cifras de " + unit.unidad + ". El estatus es captura manual y puede no coincidir con el avance."
    : "Selecciona un encabezado para ordenar. El estatus es captura manual y puede no coincidir con el avance.";
  const periodo = document.getElementById("periodo-badge").textContent;
  document.getElementById("titulo-grafica").textContent = unit
    ? "Avance de meta · " + unit.unidad
    : "Avance de meta por unidad";
  document.getElementById("chart-lead").textContent = unit
    ? unit.unidad + " va en color. El resto de la red queda en gris, de mayor a menor avance."
    : "Cada barra es ingresos 2026 entre la meta. " + periodo + ". Ordenado de mayor a menor avance.";

  const status = document.getElementById("kpi-status");
  status.replaceChildren();
  if (!unit) {
    status.hidden = true;
    return;
  }
  status.hidden = false;
  if (unit.status) status.append(statusBadge(unit.status));
  else status.textContent = "Estatus pendiente de captura";
}

function storedTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === "light" || saved === "dark" ? saved : "";
  } catch (error) {
    return "";
  }
}

function setTheme(theme, persist) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      /* el tema sigue aplicado en esta visita */
    }
  }
  syncThemeButton();
  if (currentRows.length) renderChart(currentRows, activeUnit());
}

function toggleTheme() {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  setTheme(next, true);
}

function syncThemeButton() {
  const button = document.getElementById("btn-tema");
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  button.setAttribute("aria-pressed", dark ? "true" : "false");
  button.setAttribute("aria-label", dark ? "Activar modo claro" : "Activar modo oscuro");
  button.title = dark ? "Modo claro" : "Modo oscuro";
}

function cssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function derive(raw) {
  if (!raw || typeof raw !== "object") return null;
  const unidad = String(raw.unidad ?? "").trim();
  if (!unidad) return null;
  const row = { unidad };
  INPUT_FIELDS.forEach((field) => {
    if (field.kind === "status") {
      const value = raw[field.key];
      row[field.key] = value == null || String(value).trim() === "" ? null : String(value).trim();
    } else {
      row[field.key] = num(raw[field.key]);
    }
  });
  const ingresos = row.ingresos_2026;
  const meta = row.meta;
  const base25 = row.ingresos_2025;
  const base24 = row.ingresos_2024;
  const venta = row.venta;
  row.avance = ingresos == null || meta == null || meta === 0 ? null : ingresos / meta;
  row.crec25 = ingresos == null || base25 == null || base25 === 0 ? null : ingresos / base25 - 1;
  row.crec24 = ingresos == null || base24 == null ? null : (base24 === 0 ? -1 : ingresos / base24 - 1);
  row.pctVenta = ingresos == null || ingresos === 0 ? null : (venta == null ? 0 : venta) / ingresos;
  const anterior = Array.isArray(raw.dato_anterior) ? raw.dato_anterior : [];
  row.anterior = new Set(anterior.filter((key) => typeof key === "string" && key.trim()).map((key) => key.trim()));
  return row;
}

function esAnterior(row, key) {
  return !!(row && row.anterior && row.anterior.has(key));
}

function anteriorMark() {
  const sup = document.createElement("sup");
  sup.className = "marca";
  sup.title = "Dato anterior";
  sup.textContent = "*";
  return sup;
}

function setFigure(el, text, anterior) {
  el.replaceChildren(document.createTextNode(text));
  if (anterior) el.append(anteriorMark());
}

function paintAnteriorNote(id, rows, key, unit) {
  const note = document.getElementById(id);
  const names = rows.filter((row) => esAnterior(row, key)).map((row) => row.unidad);
  if (unit && esAnterior(unit, key)) {
    note.hidden = false;
    note.textContent = "Dato anterior.";
    return;
  }
  if (!unit && names.length) {
    note.hidden = false;
    note.textContent = "Dato anterior en " + lista(names) + ".";
    return;
  }
  note.hidden = true;
  note.textContent = "";
}

function num(value) {
  if (value == null || value === "" || typeof value === "boolean") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function paintHeader(data) {
  const periodo = data.periodo || "Periodo sin definir";
  document.title = "Resumen comercial · " + periodo + " · Fit Integra";
  document.getElementById("periodo-badge").textContent = periodo;
  document.getElementById("actualizacion").textContent = "Última actualización: " + formatStamp(data.ultima_actualizacion);
  const corte = document.getElementById("corte");
  corte.textContent = data.corte || "";
  corte.hidden = !data.corte;
  document.getElementById("fuente-foot").textContent = data.fuente || "Sin fuente";
}

function formatStamp(value) {
  if (typeof value !== "string" || !value.trim()) return "sin fecha";
  const zone = "America/Mexico_City";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 18, 0, 0));
    return new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: zone }).format(date);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: zone }).format(date);
  const time = new Intl.DateTimeFormat("es-MX", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: zone,
  }).format(date);
  return day + ", " + time + " (hora del centro de México)";
}

function paintNetwork(rows, unit) {
  const paired = rows.filter((row) => row.ingresos_2026 != null && row.meta != null && row.meta !== 0);
  const ingresos = paired.reduce((sum, row) => sum + row.ingresos_2026, 0);
  const meta = paired.reduce((sum, row) => sum + row.meta, 0);
  const avance = meta === 0 ? null : ingresos / meta;
  const gap = meta - ingresos;

  const ingresosAnterior = unit ? esAnterior(unit, "ingresos_2026") : false;
  setFigure(
    document.getElementById("kpi-ingresos"),
    paired.length ? moneyFmt.format(ingresos) : "—",
    ingresosAnterior && paired.length
  );
  document.getElementById("kpi-meta").textContent = paired.length ? "Meta " + moneyFmt.format(meta) : "Sin meta capturada";
  setAvance(document.getElementById("kpi-avance"), avance, ingresosAnterior);

  const track = document.getElementById("kpi-track");
  const bar = document.getElementById("kpi-bar");
  bar.className = "fill";
  if (avance == null) {
    bar.style.width = "0";
    track.removeAttribute("aria-valuenow");
    track.removeAttribute("aria-valuetext");
  } else {
    bar.classList.add("fill-" + bandKey(avance));
    bar.style.width = Math.max(0, Math.min(avance, 1)) * 100 + "%";
    const points = avance * 100;
    track.setAttribute("aria-valuemax", String(Math.max(100, Math.ceil(points))));
    track.setAttribute("aria-valuenow", String(Math.round(points)));
    track.setAttribute("aria-valuetext", pctFmt.format(avance));
  }
  document.getElementById("etiqueta-avance").textContent = unit
    ? "Avance de meta de " + unit.unidad
    : "Avance de meta de la red";

  const faltante = document.getElementById("kpi-faltante");
  faltante.classList.remove("delta-pos", "delta-neg");
  if (!paired.length) {
    faltante.textContent = "";
  } else if (gap > 0.005) {
    faltante.textContent = "Faltan " + moneyFmt.format(gap) + " para la meta.";
    faltante.classList.add("delta-neg");
  } else if (gap < -0.005) {
    faltante.textContent = "Supera la meta por " + moneyFmt.format(-gap) + ".";
    faltante.classList.add("delta-pos");
  } else {
    faltante.textContent = "En la meta.";
  }
  paintAnteriorNote("nota-anterior-ingresos", rows, "ingresos_2026", unit);

  const crec25 = networkGrowth(rows, "ingresos_2026", "ingresos_2025", false);
  const crec24 = networkGrowth(rows, "ingresos_2026", "ingresos_2024", true);
  setDelta(document.getElementById("kpi-vs25"), crec25, (value) => growthFmt.format(value));
  setDelta(document.getElementById("kpi-vs24"), crec24, (value) => growthFmt.format(value));
  const base25 = unit ? "Ingresos 2025" : "Ingresos 2025 de la red";
  const base24 = unit ? "Ingresos 2024" : "Ingresos 2024 de la red";
  document.getElementById("kpi-vs25-base").textContent = baseLine(rows, "ingresos_2025", base25);
  document.getElementById("kpi-vs24-base").textContent = baseLine(rows, "ingresos_2024", base24);

  const ceros = rows.filter((row) => row.ingresos_2024 === 0).map((row) => row.unidad);
  const nota24 = document.getElementById("nota-2024");
  if (ceros.length) {
    nota24.hidden = false;
    const verbo = ceros.length === 1 ? "tiene" : "tienen";
    let text = lista(ceros) + " " + verbo + " ingresos 2024 en $0. Su crecimiento contra 2024 es −100%.";
    if (!unit) {
      text += " En el total de la red esos ingresos de 2026 sí entran y la base de 2024 no sube.";
    }
    nota24.textContent = text;
  } else {
    nota24.hidden = true;
    nota24.textContent = "";
  }

  const ventaRows = rows.filter((row) => row.ingresos_2026 != null && row.ingresos_2026 !== 0);
  const venta = ventaRows.reduce((sum, row) => sum + (row.venta == null ? 0 : row.venta), 0);
  const baseVenta = ventaRows.reduce((sum, row) => sum + row.ingresos_2026, 0);
  const ventaVacia = unit && unit.venta == null;
  const ventaAnterior = unit ? esAnterior(unit, "venta") && !ventaVacia : false;
  setFigure(
    document.getElementById("kpi-venta"),
    ventaVacia || !ventaRows.length ? "—" : moneyFmt.format(venta),
    ventaAnterior
  );
  document.getElementById("kpi-venta-pct").textContent = baseVenta ? pctFmt.format(venta / baseVenta) + " de los ingresos 2026" : "";
  paintAnteriorNote("nota-anterior-venta", rows, "venta", unit);
  const sinVenta = rows.filter((row) => row.venta == null).length;
  const notaVenta = document.getElementById("nota-venta");
  if (unit && unit.venta == null && unit.pctVenta != null) {
    notaVenta.hidden = false;
    notaVenta.textContent = "Sin captura de venta. En el porcentaje cuenta como cero.";
  } else if (!unit && sinVenta) {
    notaVenta.hidden = false;
    notaVenta.textContent = sinVenta + " de " + rows.length + " unidades sin captura. En el porcentaje cuentan como cero.";
  } else {
    notaVenta.hidden = true;
    notaVenta.textContent = "";
  }
}

function baseLine(rows, key, label) {
  const sum = sumField(rows, key);
  if (!sum.present) return "Sin base capturada.";
  let text = label + ": " + moneyFmt.format(sum.total);
  if (sum.missing) text += ". Faltan " + sum.missing + " unidades en la base.";
  return text;
}

function networkGrowth(rows, actualKey, baseKey, includeZeroBase) {
  const paired = rows.filter((row) => {
    if (row[actualKey] == null || row[baseKey] == null) return false;
    if (!includeZeroBase && row[baseKey] === 0) return false;
    return true;
  });
  if (!paired.length) return null;
  const actual = paired.reduce((sum, row) => sum + row[actualKey], 0);
  const base = paired.reduce((sum, row) => sum + row[baseKey], 0);
  if (base === 0) return includeZeroBase ? -1 : null;
  return actual / base - 1;
}

function paintOther(rows, unit) {
  paintSumCard("card-gastos", "kpi-gastos", "nota-gastos", rows, "gastos_sin_inversion", moneyFmt, (sum) => {
    if (unit) return "No se resta de los ingresos: no hay una utilidad verificada.";
    const cobertura = sum.present + " de " + rows.length + " unidades con captura.";
    return sum.missing
      ? cobertura + " No se resta de los ingresos: no hay una utilidad verificada."
      : "Todas las unidades traen captura. No se resta de los ingresos: no hay una utilidad verificada.";
  });
  paintSumCard("card-usuarios", "kpi-usuarios", "nota-usuarios", rows, "usuarios_activos_mes_anterior", countFmt, (sum) => {
    const mes = rows.every((row) => row.usuarios_activos == null)
      ? "Usuarios activos del mes en curso: pendiente."
      : "";
    if (unit) return mes;
    return "Suma de " + sum.present + " unidades." + (mes ? " " + mes : "");
  });
  const gastos = document.getElementById("card-gastos");
  const usuarios = document.getElementById("card-usuarios");
  document.getElementById("seccion-otras").hidden = gastos.hidden && usuarios.hidden;
}

function paintSumCard(cardId, valueId, noteId, rows, key, formatter, noteText) {
  const card = document.getElementById(cardId);
  const sum = sumField(rows, key);
  if (!sum.present) {
    card.hidden = true;
    return;
  }
  card.hidden = false;
  document.getElementById(valueId).textContent = formatter.format(sum.total);
  document.getElementById(noteId).textContent = noteText(sum);
}

function sumField(rows, key) {
  let total = 0;
  let present = 0;
  rows.forEach((row) => {
    if (row[key] == null) return;
    total += row[key];
    present += 1;
  });
  return { total, present, missing: rows.length - present };
}

function renderChart(rows, unit) {
  const canvas = document.getElementById("chart-avance");
  const fallback = document.getElementById("chart-fallback");
  const chartRows = rows.filter((row) => row.avance != null).slice().sort((a, b) => b.avance - a.avance);
  const theme = chartTheme();
  document.getElementById("chart-resumen").textContent = chartRows.length
    ? "Avance de meta por unidad, de mayor a menor: " + chartRows.map((row) => row.unidad + " " + pctFmt.format(row.avance)).join(". ") + "."
    : "No hay avances para describir.";

  if (!chartRows.length || !window.Chart) {
    if (avanceChart) {
      avanceChart.destroy();
      avanceChart = null;
    }
    canvas.hidden = true;
    fallback.hidden = false;
    fallback.textContent = chartRows.length
      ? "No se pudo cargar la gráfica. La tabla de abajo tiene las mismas cifras."
      : "No hay avances para graficar.";
    return;
  }

  canvas.hidden = false;
  fallback.hidden = true;
  lastNarrow = window.matchMedia("(max-width: 640px)").matches;
  const ySize = lastNarrow ? 11 : 12;
  const maxAvance = Math.max.apply(null, chartRows.map((row) => row.avance));
  const xMax = Math.max(1.15, maxAvance * 1.12);

  if (avanceChart) avanceChart.destroy();
  try {
    avanceChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: chartRows.map((row) => row.unidad),
        datasets: [{
          label: "Avance de meta",
          data: chartRows.map((row) => row.avance),
          backgroundColor: chartRows.map((row) => (
            unit && row.unidad !== unit.unidad ? theme.muted : bandColor(row.avance)
          )),
          borderWidth: 0,
          borderRadius: 4,
          maxBarThickness: 22,
        }],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        locale: "es-MX",
        layout: { padding: { top: 18, right: 8, left: 0, bottom: 0 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipTitle,
            bodyColor: theme.tooltipBody,
            padding: 10,
            callbacks: {
              label(context) {
                const row = chartRows[context.dataIndex];
                return "Avance: " + pctFmt.format(row.avance);
              },
              afterBody(items) {
                const row = chartRows[items[0].dataIndex];
                const lineas = [
                  "Ingresos 2026: " + moneyFmt.format(row.ingresos_2026) + (esAnterior(row, "ingresos_2026") ? " (dato anterior)" : ""),
                  "Meta: " + moneyFmt.format(row.meta),
                ];
                if (row.venta != null) {
                  lineas.push("Venta: " + moneyFmt.format(row.venta) + (esAnterior(row, "venta") ? " (dato anterior)" : ""));
                }
                lineas.push("Estatus (manual): " + (row.status || "Sin captura"));
                return lineas;
              },
            },
          },
        },
        scales: {
          x: {
            min: 0,
            max: xMax,
            grid: { color: theme.grid },
            ticks: {
              color: theme.tick,
              callback: (value) => axisPctFmt.format(value),
            },
            title: {
              display: true,
              text: "Avance de meta",
              color: theme.axis,
              font: { size: 12, weight: "600", family: "Inter, system-ui, sans-serif" },
            },
          },
          y: {
            grid: { display: false },
            ticks: {
              autoSkip: false,
              color: (ctx) => {
                const label = ctx.tick && ctx.tick.label;
                if (unit && label === unit.unidad) return theme.selected;
                return theme.axis;
              },
              padding: 6,
              font: { size: ySize, weight: "600", family: "Inter, system-ui, sans-serif" },
            },
          },
        },
      },
      plugins: [metaGuide(chartRows, unit, theme)],
    });
    canvas.setAttribute("role", "img");
    canvas.setAttribute(
      "aria-label",
      unit
        ? "Gráfica de barras: avance de meta, con " + unit.unidad + " resaltada"
        : "Gráfica de barras: avance de meta por unidad"
    );
  } catch (error) {
    if (avanceChart) {
      avanceChart.destroy();
      avanceChart = null;
    }
    canvas.hidden = true;
    fallback.hidden = false;
    fallback.textContent = "No se pudo dibujar la gráfica. La tabla de abajo tiene las mismas cifras.";
  }
}

function chartTheme() {
  return {
    grid: cssVar("--chart-grid", "#e2e8f0"),
    tick: cssVar("--chart-tick", "#334155"),
    axis: cssVar("--chart-axis", "#0f172a"),
    guide: cssVar("--chart-guide", "#0f172a"),
    label: cssVar("--chart-label", "#0f172a"),
    labelInside: cssVar("--chart-label-inside", "#ffffff"),
    muted: cssVar("--chart-muted", "#cbd5e1"),
    mutedInk: cssVar("--chart-muted-ink", "#0f172a"),
    selected: cssVar("--chart-selected", "#065f46"),
    tooltipBg: cssVar("--tooltip-bg", "#0f172a"),
    tooltipTitle: cssVar("--tooltip-title", "#ffffff"),
    tooltipBody: cssVar("--tooltip-body", "#f8fafc"),
  };
}

function metaGuide(chartRows, unit, theme) {
  return {
    id: "guiaMeta",
    afterDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      const x = scales.x.getPixelForValue(1);
      ctx.save();
      if (x >= chartArea.left && x <= chartArea.right) {
        ctx.beginPath();
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = theme.guide;
        ctx.lineWidth = 1.25;
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = theme.guide;
        ctx.font = "700 11px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("Meta", x, chartArea.top - 2);
      }
      const meta = chart.getDatasetMeta(0);
      ctx.font = "700 12px 'JetBrains Mono', ui-monospace, monospace";
      ctx.textBaseline = "middle";
      meta.data.forEach((bar, index) => {
        const row = chartRows[index];
        if (!row) return;
        const label = pctFmt.format(row.avance);
        const width = ctx.measureText(label).width;
        const end = Math.max(bar.x, bar.base == null ? bar.x : bar.base);
        const roomInside = end - chartArea.left;
        const muted = unit && row.unidad !== unit.unidad;
        if (end + 8 + width > chartArea.right && roomInside > width + 16) {
          ctx.fillStyle = muted ? theme.mutedInk : theme.labelInside;
          ctx.textAlign = "right";
          ctx.fillText(label, end - 8, bar.y);
        } else {
          ctx.fillStyle = theme.label;
          ctx.textAlign = "left";
          ctx.fillText(label, Math.min(end + 8, chartArea.right - width), bar.y);
        }
      });
      ctx.restore();
    },
  };
}

function onResize() {
  updateScrollHint();
  const narrow = window.matchMedia("(max-width: 640px)").matches;
  if (narrow === lastNarrow || !currentRows.length) return;
  renderChart(currentRows, activeUnit());
}

function buildColumns(rows) {
  const base = baseColumns().filter((col) => col.visible(rows));
  const used = new Set(baseColumns().map((col) => col.key).filter(Boolean));
  INPUT_FIELDS.forEach((field) => {
    if (used.has(field.key) || field.kind === "status") return;
    if (!rows.some((row) => row[field.key] != null)) return;
    base.push(columnFromField(field));
  });
  return base;
}

function baseColumns() {
  return [
    {
      id: "unidad",
      label: "Unidad",
      kind: "text",
      prefer: "asc",
      align: "left",
      hint: "",
      value: (row) => row.unidad,
      visible: () => true,
      render: (row) => textEl(row.unidad, "unidad-nombre"),
      total: (rows) => textEl("Red (" + rows.length + ")", "unidad-nombre"),
    },
    {
      id: "status",
      key: "status",
      label: "Estatus",
      kind: "number",
      prefer: "asc",
      align: "left",
      hint: "Captura manual. No se calcula con el avance.",
      value: (row) => (row.status == null ? null : STATUS_RANK[row.status] ?? row.status),
      visible: (rows) => rows.some((row) => row.status != null),
      render: (row) => statusBadge(row.status),
      total: () => noteEl("Manual"),
    },
    moneyColumn("meta", "Meta", "Meta del periodo."),
    moneyColumn("ingresos_2026", "Ingresos 2026", "Ingresos capturados en 2026, mes a la fecha."),
    {
      id: "avance",
      label: "Avance de meta",
      kind: "number",
      prefer: "desc",
      align: "right",
      hint: "Ingresos 2026 / Meta.",
      value: (row) => row.avance,
      visible: (rows) => rows.some((row) => row.avance != null),
      render: (row) => avanceNode(row.avance, esAnterior(row, "ingresos_2026")),
      total: (rows) => avanceNode(networkAvance(rows)),
    },
    moneyColumn("ingresos_2025", "Ingresos 2025", "Ingresos del mismo corte en 2025."),
    {
      id: "crec_25",
      label: "Crecimiento vs 25",
      kind: "number",
      prefer: "desc",
      align: "right",
      hint: "Ingresos 2026 / Ingresos 2025 − 1.",
      value: (row) => row.crec25,
      visible: (rows) => rows.some((row) => row.crec25 != null),
      render: (row) => growthNode(row.crec25),
      total: (rows) => growthNode(networkGrowth(rows, "ingresos_2026", "ingresos_2025", false)),
    },
    moneyColumn("ingresos_2024", "Ingresos 2024", "Ingresos del mismo corte en 2024. $0 es un cero real, no un vacío."),
    {
      id: "crec_24",
      label: "Crecimiento vs 24",
      kind: "number",
      prefer: "desc",
      align: "right",
      hint: "Ingresos 2026 / Ingresos 2024 − 1. Si 2024 es 0, el resultado es −100%.",
      value: (row) => row.crec24,
      visible: (rows) => rows.some((row) => row.crec24 != null),
      render: (row, flags) => {
        const node = growthNode(row.crec24);
        if (row.crec24 != null && row.ingresos_2024 === 0) {
          node.append(mark("†"));
          flags.dagger = true;
        }
        return node;
      },
      total: (rows) => growthNode(networkGrowth(rows, "ingresos_2026", "ingresos_2024", true)),
    },
    {
      id: "venta",
      key: "venta",
      label: "Venta",
      kind: "number",
      prefer: "desc",
      align: "right",
      hint: "Venta capturada. Vacío no es cero.",
      value: (row) => row.venta,
      visible: (rows) => rows.some((row) => row.venta != null),
      render: (row) => moneyCell(row.venta, esAnterior(row, "venta")),
      total: (rows) => {
        const sum = sumField(rows, "venta");
        return moneyTotal(sum.total, sum.missing);
      },
    },
    {
      id: "pct_venta",
      label: "% Venta",
      kind: "number",
      prefer: "desc",
      align: "right",
      hint: "Venta / Ingresos 2026. Si la venta está vacía, cuenta como 0.",
      value: (row) => row.pctVenta,
      visible: (rows) => rows.some((row) => row.venta != null && row.pctVenta != null),
      render: (row, flags) => {
        if (row.pctVenta == null) return dash();
        const node = textEl(pctFmt.format(row.pctVenta));
        if (row.venta == null) {
          node.append(mark("‡"));
          flags.double = true;
        }
        return node;
      },
      total: (rows) => {
        const withIncome = rows.filter((row) => row.ingresos_2026 != null && row.ingresos_2026 !== 0);
        if (!withIncome.length) return dash();
        const venta = withIncome.reduce((sum, row) => sum + (row.venta == null ? 0 : row.venta), 0);
        const base = withIncome.reduce((sum, row) => sum + row.ingresos_2026, 0);
        const node = textEl(pctFmt.format(venta / base));
        if (withIncome.some((row) => row.venta == null)) {
          node.title = "Incluye como cero las unidades sin venta capturada.";
        }
        return node;
      },
    },
    {
      id: "gastos_sin_inversion",
      key: "gastos_sin_inversion",
      label: "Gastos sin inversión",
      kind: "number",
      prefer: "desc",
      align: "right",
      hint: "Gasto capturado, sin inversión. Vacío no es cero.",
      value: (row) => row.gastos_sin_inversion,
      visible: (rows) => rows.some((row) => row.gastos_sin_inversion != null),
      render: (row) => moneyCell(row.gastos_sin_inversion),
      total: (rows) => {
        const sum = sumField(rows, "gastos_sin_inversion");
        return moneyTotal(sum.total, sum.missing);
      },
    },
    {
      id: "usuarios_activos_mes_anterior",
      key: "usuarios_activos_mes_anterior",
      label: "Usuarios activos mes anterior",
      kind: "number",
      prefer: "desc",
      align: "right",
      hint: "Usuarios activos del mes anterior.",
      value: (row) => row.usuarios_activos_mes_anterior,
      visible: (rows) => rows.some((row) => row.usuarios_activos_mes_anterior != null),
      render: (row) => countCell(row.usuarios_activos_mes_anterior),
      total: (rows) => {
        const sum = sumField(rows, "usuarios_activos_mes_anterior");
        return countTotal(sum);
      },
    },
  ];
}

function moneyColumn(key, label, hint) {
  return {
    id: key,
    key,
    label,
    kind: "number",
    prefer: "desc",
    align: "right",
    hint,
    value: (row) => row[key],
    visible: (rows) => rows.some((row) => row[key] != null),
    render: (row) => moneyCell(row[key], esAnterior(row, key)),
    total: (rows) => {
      const sum = sumField(rows, key);
      if (!sum.present) return dash();
      return moneyTotal(sum.total, sum.missing);
    },
  };
}

function columnFromField(field) {
  return {
    id: field.key,
    key: field.key,
    label: field.label,
    kind: "number",
    prefer: "desc",
    align: "right",
    hint: field.hint || "",
    value: (row) => row[field.key],
    visible: () => true,
    render: (row) => (field.kind === "count" ? countCell(row[field.key]) : moneyCell(row[field.key], esAnterior(row, field.key))),
    total: (rows) => {
      const sum = sumField(rows, field.key);
      if (!sum.present) return dash();
      return field.kind === "count" ? countTotal(sum) : moneyTotal(sum.total, sum.missing);
    },
  };
}

function paintTable(rows, unit) {
  const source = rows || currentRows;
  const flags = { dagger: false, double: false };
  const head = document.getElementById("tabla-head");
  const body = document.getElementById("tabla-body");
  const foot = document.getElementById("tabla-foot");
  const table = document.getElementById("tabla-kpis");
  head.replaceChildren();
  body.replaceChildren();
  foot.replaceChildren();

  let caption = table.querySelector("caption");
  if (!caption) {
    caption = document.createElement("caption");
    caption.className = "sr-only";
    table.prepend(caption);
  }
  caption.textContent = unit
    ? "Detalle de " + unit.unidad + "."
    : "Detalle por unidad del resumen comercial. Active un encabezado para ordenar.";

  const headRow = document.createElement("tr");
  currentCols.forEach((col) => {
    const th = document.createElement("th");
    th.scope = "col";
    if (col.align === "right") th.classList.add("num");
    const active = sortState.id === col.id;
    th.setAttribute("aria-sort", active ? (sortState.dir === "asc" ? "ascending" : "descending") : "none");
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.sort = col.id;
    button.textContent = col.label;
    const hint = [col.hint, "Selecciona para ordenar"].filter(Boolean).join(" ");
    if (hint) button.title = hint;
    if (active) {
      const arrow = document.createElement("span");
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = sortState.dir === "asc" ? "↑" : "↓";
      button.append(arrow);
    }
    th.append(button);
    headRow.append(th);
  });
  head.append(headRow);

  const ordered = source.slice().sort(compareRows);
  ordered.forEach((row) => {
    const tr = document.createElement("tr");
    if (unit && row.slug === unit.slug) tr.classList.add("is-selected");
    currentCols.forEach((col, index) => {
      const cell = document.createElement(index === 0 ? "th" : "td");
      if (index === 0) cell.scope = "row";
      if (col.align === "right") cell.classList.add("num");
      cell.append(col.render(row, flags));
      tr.append(cell);
    });
    body.append(tr);
  });

  if (!unit) {
    const totalRow = document.createElement("tr");
    currentCols.forEach((col, index) => {
      const cell = document.createElement(index === 0 ? "th" : "td");
      if (index === 0) cell.scope = "row";
      if (col.align === "right") cell.classList.add("num");
      cell.append(col.total(source, flags));
      totalRow.append(cell);
    });
    foot.append(totalRow);
  }

  const col = currentCols.find((item) => item.id === sortState.id);
  const orden = document.getElementById("tabla-orden");
  if (col) orden.textContent = "Orden: " + col.label + ", " + dirLabel(col) + ".";
  paintNotes(flags, source);
  updateScrollHint();
  window.requestAnimationFrame(updateScrollHint);
}

function updateScrollHint() {
  const hint = document.querySelector(".scroll-hint");
  const wrap = document.querySelector(".table-wrap");
  if (!hint || !wrap) return;
  hint.hidden = wrap.scrollWidth <= wrap.clientWidth + 4;
}

function paintNotes(flags, rows) {
  const host = document.getElementById("tabla-notas");
  host.replaceChildren();
  addNote(host, "Los porcentajes se calculan al abrir la página a partir de data/kpis.json.");
  if (flags.dagger) {
    const names = rows.filter((row) => row.ingresos_2024 === 0 && row.crec24 != null).map((row) => row.unidad);
    addNote(host, "† " + lista(names) + ": ingresos 2024 en $0. La fórmula verificada devuelve −100%, no un dato vacío.");
  }
  if (flags.double) {
    const names = rows.filter((row) => row.venta == null && row.pctVenta != null).map((row) => row.unidad);
    addNote(host, "‡ " + lista(names) + ": sin venta capturada. La fórmula verificada cuenta ese vacío como 0%.");
  }
  [
    ["ingresos_2026", "Ingresos 2026"],
    ["venta", "Venta"],
  ].forEach(([key, label]) => {
    const names = rows.filter((row) => esAnterior(row, key)).map((row) => row.unidad);
    if (!names.length) return;
    addNote(host, "* " + label + " con dato anterior: " + lista(names) + ". Esta corrida no trajo un valor nuevo.");
  });
}

function addNote(host, text) {
  const p = document.createElement("p");
  p.className = "nota";
  p.textContent = text;
  host.append(p);
}

function onSort(event) {
  const button = event.target.closest("button[data-sort]");
  if (!button) return;
  const id = button.dataset.sort;
  const col = currentCols.find((item) => item.id === id);
  if (!col) return;
  if (sortState.id === id) sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
  else sortState = { id, dir: col.prefer || "desc" };
  paintTable(activeUnit() ? [activeUnit()] : currentRows, activeUnit());
  const again = document.querySelector('#tabla-head button[data-sort="' + id + '"]');
  if (again) again.focus();
}

function compareRows(a, b) {
  const col = currentCols.find((item) => item.id === sortState.id) || currentCols[0];
  const va = col.value(a);
  const vb = col.value(b);
  const aMissing = va == null || va === "";
  const bMissing = vb == null || vb === "";
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  let result;
  if (typeof va === "number" && typeof vb === "number") result = va - vb;
  else result = String(va).localeCompare(String(vb), "es", { sensitivity: "base", numeric: true });
  return sortState.dir === "asc" ? result : -result;
}

function dirLabel(col) {
  if (col.id === "status") {
    return sortState.dir === "asc" ? "de Hasta 50% hacia 100%+" : "de 100%+ hacia Hasta 50%";
  }
  if (col.kind === "text") {
    return sortState.dir === "asc" ? "de la A a la Z" : "de la Z a la A";
  }
  return sortState.dir === "asc" ? "de menor a mayor" : "de mayor a menor";
}

function paintPending(rows, unit) {
  const host = document.getElementById("pendiente-grupos");
  host.replaceChildren();
  const grouped = new Map();
  INPUT_FIELDS.forEach((field) => {
    if (!rows.every((row) => row[field.key] == null)) return;
    if (!grouped.has(field.group)) grouped.set(field.group, []);
    grouped.get(field.group).push(field);
  });
  if (!grouped.size) {
    const p = document.createElement("p");
    p.className = "nota";
    p.textContent = unit
      ? "No hay campos vacíos en " + unit.unidad + "."
      : "No hay columnas vacías en este corte.";
    host.append(p);
    return;
  }
  const intro = document.createElement("p");
  intro.className = "nota";
  intro.textContent = unit
    ? "Estos campos están vacíos en " + unit.unidad + ". No se muestran en la tabla ni como ceros."
    : "Estos campos están vacíos en las " + rows.length + " unidades. No se muestran en la tabla ni como ceros.";
  host.append(intro);
  GROUPS.forEach((group) => {
    const fields = grouped.get(group.id);
    if (!fields || !fields.length) return;
    const row = document.createElement("div");
    row.className = "pending-row";
    const label = document.createElement("span");
    label.className = "pending-group";
    label.textContent = group.label;
    row.append(label);
    fields.forEach((field) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = field.label;
      if (field.hint) chip.title = field.hint;
      row.append(chip);
    });
    host.append(row);
  });
}

function networkAvance(rows) {
  const paired = rows.filter((row) => row.ingresos_2026 != null && row.meta != null && row.meta !== 0);
  if (!paired.length) return null;
  const meta = paired.reduce((sum, row) => sum + row.meta, 0);
  if (meta === 0) return null;
  return paired.reduce((sum, row) => sum + row.ingresos_2026, 0) / meta;
}

function bandKey(value) {
  if (value >= 1) return "100";
  if (value >= 0.9) return "99";
  if (value >= 0.75) return "90";
  if (value >= 0.5) return "75";
  return "50";
}

function bandColor(value) {
  return { 50: "#b91c1c", 75: "#c2410c", 90: "#b45309", 99: "#047857", 100: "#1d4ed8" }[bandKey(value)];
}

function setDelta(el, value, formatter) {
  el.classList.remove("delta-pos", "delta-neg", "delta-zero");
  if (value == null || !Number.isFinite(value)) {
    el.textContent = "—";
    return;
  }
  el.textContent = formatter(value);
  el.classList.add(value > 0 ? "delta-pos" : value < 0 ? "delta-neg" : "delta-zero");
}

function setAvance(el, value, anterior) {
  ["text-b50", "text-b75", "text-b90", "text-b99", "text-b100"].forEach((name) => el.classList.remove(name));
  if (value == null || !Number.isFinite(value)) {
    el.textContent = "—";
    return;
  }
  el.replaceChildren(document.createTextNode(pctFmt.format(value)));
  if (anterior) el.append(anteriorMark());
  el.classList.add("text-b" + bandKey(value));
}

function textEl(value, className) {
  const span = document.createElement("span");
  if (className) span.className = className;
  span.textContent = value;
  return span;
}

function noteEl(value) {
  const span = document.createElement("span");
  span.className = "cell-note";
  span.textContent = value;
  return span;
}

function dash() {
  const wrap = document.createElement("span");
  const markEmpty = document.createElement("span");
  markEmpty.className = "pendiente";
  markEmpty.textContent = "—";
  markEmpty.title = "Sin captura";
  const sr = document.createElement("span");
  sr.className = "sr-only";
  sr.textContent = " Sin captura";
  wrap.append(markEmpty, sr);
  return wrap;
}

function mark(symbol) {
  const sup = document.createElement("sup");
  sup.className = "marca";
  sup.textContent = symbol;
  return sup;
}

function moneyCell(value, anterior) {
  if (value == null) return dash();
  const node = textEl(moneyFmt.format(value));
  if (!anterior) return node;
  const wrap = document.createElement("span");
  wrap.append(node, anteriorMark());
  return wrap;
}

function countCell(value) {
  if (value == null) return dash();
  return textEl(countFmt.format(value));
}

function moneyTotal(total, missing) {
  const wrap = document.createElement("div");
  wrap.className = "total-stack";
  wrap.append(textEl(moneyFmt.format(total)));
  if (missing > 0) wrap.append(noteEl(missing === 1 ? "Sin 1 unidad" : "Sin " + missing + " unidades"));
  return wrap;
}

function countTotal(sum) {
  const wrap = document.createElement("div");
  wrap.className = "total-stack";
  wrap.append(textEl(countFmt.format(sum.total)));
  if (sum.missing > 0) wrap.append(noteEl(sum.missing === 1 ? "Sin 1 unidad" : "Sin " + sum.missing + " unidades"));
  return wrap;
}

function growthNode(value) {
  if (value == null || !Number.isFinite(value)) return dash();
  const span = document.createElement("span");
  span.className = value > 0 ? "delta-pos" : value < 0 ? "delta-neg" : "delta-zero";
  span.textContent = growthFmt.format(value);
  return span;
}

function avanceNode(value, anterior) {
  if (value == null || !Number.isFinite(value)) return dash();
  const wrap = document.createElement("div");
  wrap.className = "avance";
  const track = document.createElement("span");
  track.className = "mini-track";
  track.setAttribute("aria-hidden", "true");
  const fill = document.createElement("span");
  fill.className = "mini-fill fill-" + bandKey(value);
  fill.style.width = Math.max(0, Math.min(value, 1)) * 100 + "%";
  track.append(fill);
  const label = document.createElement("span");
  label.className = "text-b" + bandKey(value);
  label.textContent = pctFmt.format(value);
  if (anterior) label.append(anteriorMark());
  wrap.append(track, label);
  return wrap;
}

function statusBadge(status) {
  if (status == null) return dash();
  const span = document.createElement("span");
  span.className = "badge " + (STATUS_CLASS[status] || "badge-unk");
  span.textContent = status;
  return span;
}

function lista(nombres) {
  if (nombres.length <= 1) return nombres[0] || "";
  if (nombres.length === 2) return nombres[0] + " y " + nombres[1];
  return nombres.slice(0, -1).join(", ") + " y " + nombres[nombres.length - 1];
}

function showError(message) {
  const banner = document.getElementById("error-banner");
  banner.hidden = false;
  banner.textContent = message;
  document.getElementById("contenido").setAttribute("aria-busy", "false");
  document.getElementById("tabla-body").replaceChildren();
}
