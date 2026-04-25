// ============================================
// LOGIFLOW — Admin Dashboard
// ============================================

const API_URL = "https://logiflow-api-07n7.onrender.com";

// ============================================
// TRANSLATIONS
// ============================================
let currentLang = localStorage.getItem("logiflow_lang") || "es";

const TRANSLATIONS = {
  es: {
    dashboard: "Dashboard",
    exportCSV: "Exportar CSV",
    adminMode: "Modo Administrador",
    panelTitle: "Panel de Control",
    totalPackages: "Total Paquetes",
    pendingPackages: "Pendientes",
    deliveredPackages: "Entregados",
    searchPlaceholder: "Buscar por código, dirección o repartidor...",
    allDrivers: "Todos los repartidores",
    filterAll: "Todos",
    filterPending: "Pendientes",
    filterDelivered: "Entregados",
    globalMap: "Ver Mapa Global",
    activityMonitor: "Monitor de Actividad",
    downloadReport: "Descargar Reporte",
    colId: "ID Paquete",
    colDest: "Destino",
    colStatus: "Estado Actual",
    colPhoto: "Foto",
    colAssigned: "Asignado a",
    unassigned: "Sin asignar",
    status_delivered: "ENTREGADO",
    status_pending: "PENDIENTE",
    status_incident: "INCIDENCIA",
    status_tomorrow: "MAÑANA",
  },
  ua: {
    dashboard: "Панель",
    exportCSV: "Експорт CSV",
    adminMode: "Режим адміна",
    panelTitle: "Панель керування",
    totalPackages: "Всього посилок",
    pendingPackages: "Очікується",
    deliveredPackages: "Доставлено",
    searchPlaceholder: "Пошук за кодом, адресою або кур'єром...",
    allDrivers: "Всі кур'єри",
    filterAll: "Всі",
    filterPending: "Очікується",
    filterDelivered: "Доставлено",
    globalMap: "Переглянути карту",
    activityMonitor: "Монітор активності",
    downloadReport: "Завантажити звіт",
    colId: "ID посилки",
    colDest: "Адреса",
    colStatus: "Поточний статус",
    colPhoto: "Фото",
    colAssigned: "Кур'єр",
    unassigned: "Не призначено",
    status_delivered: "ДОСТАВЛЕНО",
    status_pending: "ОЧІКУЄТЬСЯ",
    status_incident: "ІНЦИДЕНТ",
    status_tomorrow: "НА ЗАВТРА",
  }
};

function t(key) {
  return TRANSLATIONS[currentLang][key] || TRANSLATIONS["es"][key] || key;
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem("logiflow_lang", lang);

  // Update all data-i18n elements
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });

  // Update placeholders
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });

  // Update lang toggle button
  const btn = document.getElementById("lang-btn");
  if (btn) btn.textContent = lang === "es" ? "🇺🇦 UA" : "🇪🇸 ES";

  // Re-render with new translations
  renderAll(DELIVERIES);
  populateDriverFilter();
}

function toggleLanguage() {
  setLanguage(currentLang === "es" ? "ua" : "es");
}

// ============================================
// STATUS CONFIG
// ============================================
const STATUS_CONFIG = {
  delivered: { get label() { return t("status_delivered"); }, cssClass: "status-delivered" },
  pending: { get label() { return t("status_pending"); }, cssClass: "status-pending" },
  incident: { get label() { return t("status_incident"); }, cssClass: "status-incident" },
  tomorrow: { get label() { return t("status_tomorrow"); }, cssClass: "status-tomorrow" },
};

// ============================================
// APP STATE
// ============================================
let currentFilter = "all";
let globalMap = null;
let DELIVERIES = [];

// ============================================
// INIT
// ============================================
document.addEventListener("DOMContentLoaded", async () => {
  startClock();
  setLanguage(currentLang); // apply saved language on load
  await loadDeliveries();

  const btnExport = document.getElementById("btn-exportar");
  if (btnExport) btnExport.onclick = exportCSV;
});

// ============================================
// 1. LOAD FROM API
// ============================================
async function loadDeliveries() {
  try {
    const response = await fetch(`${API_URL}/api/deliveries`);
    const { data } = await response.json();

    DELIVERIES = data.map(({ delivery_id, address, status, driver_id, photo_url, lat, lng }) => ({
      id: delivery_id, address, status,
      driver: driver_id, photo_url, lat, lng
    }));

    renderAll(DELIVERIES);
    populateDriverFilter();

  } catch (error) {
    console.error("Error loading deliveries:", error);
  }
}

// ============================================
// 2. CLOCK — Ukraine time (Europe/Kyiv)
// ============================================
function startClock() {
  const elDate = document.getElementById("current-date");
  const elTime = document.getElementById("current-time-admin");

  const update = () => {
    const now = new Date();
    const locale = currentLang === "ua" ? "uk-UA" : "es-ES";
    const timezone = "Europe/Kyiv"; // UTC+3 Ukraine

    if (elDate) {
      elDate.textContent = now.toLocaleDateString(locale, {
        timeZone: timezone,
        weekday: "long", year: "numeric",
        month: "long", day: "numeric"
      }).toUpperCase();
    }

    if (elTime) {
      elTime.textContent = now.toLocaleTimeString(locale, {
        timeZone: timezone,
        hour: "2-digit", minute: "2-digit", second: "2-digit"
      });
    }
  };

  update();
  setInterval(update, 1000); // ← runs every second!
}

// ============================================
// 3. FILTER & SEARCH
// ============================================
function filterDeliveries() {
  const search = (document.getElementById("admin-search")?.value || "").toLowerCase();
  const selectedDriver = document.getElementById("filtro-repartidor")?.value || "all";

  const filtered = DELIVERIES.filter(({ id, address, status, driver }) => {
    const matchSearch = id.toLowerCase().includes(search) ||
      address.toLowerCase().includes(search);
    const matchStatus = currentFilter === "all" || status === currentFilter;
    const matchDriver = selectedDriver === "all" || driver === selectedDriver;
    return matchSearch && matchStatus && matchDriver;
  });

  renderAll(filtered);
}

function setFilter(status, btn) {
  currentFilter = status;
  document.querySelectorAll(".btn-filter").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  filterDeliveries();
}

// ============================================
// 4. RENDER TABLE
// ============================================
function renderTable(list) {
  const tbody = document.getElementById("admin-table-body");
  if (!tbody) return;

  tbody.innerHTML = list.map(({ id, address, status, photo_url, driver }) => {
    const config = STATUS_CONFIG[status] || { label: status.toUpperCase(), cssClass: "" };

    const photoHTML = photo_url
      ? `<img src="${photo_url}" onclick="window.open('${photo_url}', '_blank')"
           style="width:45px;height:45px;border-radius:10px;cursor:pointer;object-fit:cover;border:2px solid #6366f1;">`
      : `<i class="fas fa-camera" style="color:#e2e8f0;font-size:1.2rem;margin-left:10px;"></i>`;

    return `
      <tr>
        <td style="color:#6366f1;font-weight:800">#${id}</td>
        <td><i class="fas fa-location-dot" style="color:#cbd5e1;margin-right:8px"></i>${address}</td>
        <td><span class="status-badge ${config.cssClass}">${config.label}</span></td>
        <td style="text-align:center;">${photoHTML}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:30px;height:30px;background:#f1f5f9;border-radius:50%;
                        display:flex;align-items:center;justify-content:center;
                        font-size:0.6rem;font-weight:bold;color:#64748b">ID</div>
            <span style="font-weight:500;color:#1e293b">${driver || t("unassigned")}</span>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// ============================================
// 5. UPDATE COUNTERS — uses DELIVERIES global
// ============================================
function updateCounters() {
  const total = DELIVERIES.length;
  const delivered = DELIVERIES.filter(({ status }) => status === "delivered").length;
  const pending = total - delivered;

  // ✅ These IDs must match your HTML exactly!
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  set("total-entregas", total);    // Total
  set("total-pendents", pending);  // Pending
  set("total-fet", delivered); // Delivered
}

// ============================================
// 6. POPULATE DRIVER FILTER
// ============================================
function populateDriverFilter() {
  const selector = document.getElementById("filtro-repartidor");
  if (!selector) return;

  const drivers = [...new Set(DELIVERIES.map(({ driver }) => driver))].filter(Boolean);

  selector.innerHTML = `<option value="all">${t("allDrivers")}</option>` +
    drivers.map(d => `<option value="${d}">${d}</option>`).join("");
}

// ============================================
// 7. RENDER ALL
// ============================================
function renderAll(list) {
  renderTable(list);
  updateCounters(); // always uses global DELIVERIES for counters
}

// ============================================
// 8. GLOBAL MAP
// ============================================
function openGlobalMap() {
  const modal = document.getElementById("modal-mapa");
  modal.style.display = "block";

  setTimeout(() => {
    if (!globalMap) {
      globalMap = L.map("mapa-global", { zoomControl: false }).setView([46.4825, 30.7233], 12);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "©OpenStreetMap ©CartoDB"
      }).addTo(globalMap);
      L.control.zoom({ position: "bottomright" }).addTo(globalMap);
    } else {
      globalMap.invalidateSize();
    }

    globalMap.eachLayer(layer => {
      if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
        globalMap.removeLayer(layer);
      }
    });

    DELIVERIES.forEach(({ id, address, status, lat, lng }) => {
      if (!lat || !lng) return;
      const color = status === "delivered" ? "#10b981" : "#ef4444";
      const config = STATUS_CONFIG[status] || { label: status };

      L.circleMarker([lat, lng], {
        radius: 8, fillColor: color,
        color: "#fff", weight: 2, opacity: 1, fillOpacity: 0.9
      })
        .addTo(globalMap)
        .bindPopup(`
          <div style="font-family:sans-serif;padding:5px;">
            <strong style="color:${color}">#${id}</strong><br>
            <small style="color:#64748b">${address}</small><br>
            <b>${config.label}</b>
          </div>
        `);
    });
  }, 400);
}

function closeGlobalMap() {
  document.getElementById("modal-mapa").style.display = "none";
}

// ============================================
// 9. EXPORT CSV
// ============================================
function exportCSV() {
  const header = "ID,Address,Status,Driver\n";
  const rows = DELIVERIES.map(({ id, address, status, driver }) =>
    `"${id}","${address}","${status}","${driver}"`
  ).join("\n");

  const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "LogiFlow_Report.csv";
  link.click();
}