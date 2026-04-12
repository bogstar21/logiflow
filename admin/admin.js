// ============================================
// LOGIFLOW — Admin Dashboard
// Data source: Fake JSON (replace with API later)
// ============================================

// --- FAKE DATABASE ---
const DELIVERIES = [
  { id: "P01", address: "Calle Colón 1, Valencia",          status: "delivered",   driver: "DRV-001", lat: 39.4697, lng: -0.3774 },
  { id: "P02", address: "Avenida del Puerto 15, Valencia",  status: "pending",     driver: "DRV-002", lat: 39.4739, lng: -0.3732 },
  { id: "P03", address: "Plaza del Ayuntamiento 3",         status: "delivered",   driver: "DRV-001", lat: 39.4699, lng: -0.3763 },
  { id: "P04", address: "Calle Xàtiva 22, Valencia",        status: "incident",    driver: "DRV-003", lat: 39.4658, lng: -0.3780 },
  { id: "P05", address: "Gran Vía Marqués del Turia 48",    status: "pending",     driver: "DRV-002", lat: 39.4681, lng: -0.3810 },
  { id: "P06", address: "Calle Cirilo Amorós 55",           status: "tomorrow",    driver: "DRV-001", lat: 39.4710, lng: -0.3795 },
  { id: "P07", address: "Avenida Blasco Ibáñez 10",         status: "delivered",   driver: "DRV-003", lat: 39.4780, lng: -0.3600 },
  { id: "P08", address: "Calle Russafa 8, Valencia",        status: "pending",     driver: "DRV-002", lat: 39.4640, lng: -0.3750 },
  { id: "P09", address: "Plaza de España 2, Valencia",      status: "delivered",   driver: "DRV-001", lat: 39.4720, lng: -0.3830 },
  { id: "P10", address: "Calle San Vicente Mártir 71",      status: "incident",    driver: "DRV-003", lat: 39.4670, lng: -0.3760 },
];

// --- STATUS CONFIG ---
// One place to control all status labels and styles
const STATUS_CONFIG = {
  delivered: { label: "DELIVERED",  cssClass: "status-delivered" },
  pending:   { label: "PENDING",    cssClass: "status-pending"   },
  incident:  { label: "INCIDENT",   cssClass: "status-incident"  },
  tomorrow:  { label: "TOMORROW",   cssClass: "status-tomorrow"  },
};

// --- APP STATE ---
let currentFilter = "all";
let globalMap = null;

// ============================================
// INIT
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  startClock();
  renderAll(DELIVERIES);
  populateDriverFilter();

  // Export button
  const btnExport = document.getElementById("btn-exportar");
  if (btnExport) btnExport.onclick = exportCSV;
});

// ============================================
// 1. CLOCK
// ============================================

function startClock() {
  const elDate = document.getElementById("current-date");
  const elTime = document.getElementById("current-time-admin");

  const update = () => {
    const now = new Date();
    if (elDate) elDate.textContent = now.toLocaleDateString("es-ES", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    }).toUpperCase();
    if (elTime) elTime.textContent = now.toLocaleTimeString("es-ES");
  };

  update();
  setInterval(update, 1000);
}

// ============================================
// 2. FILTER & SEARCH
// ============================================

function filterDeliveries() {
  const searchInput = document.getElementById("admin-search");
  const search = searchInput ? searchInput.value.toLowerCase() : "";

  const driverSelect = document.getElementById("filtro-repartidor");
  const selectedDriver = driverSelect ? driverSelect.value : "all";

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
// 3. RENDER TABLE
// ============================================

function renderTable(list) {
  const tbody = document.getElementById("admin-table-body");
  if (!tbody) return;

  tbody.innerHTML = list.map(({ id, address, status, photo_url, driver }) => {
    const { label, cssClass } = STATUS_CONFIG[status] || { label: status.toUpperCase(), cssClass: "" };

    const photoHTML = photo_url
      ? `<img src="${photo_url}" onclick="window.open('${photo_url}', '_blank')"
           style="width:45px;height:45px;border-radius:10px;cursor:pointer;object-fit:cover;border:2px solid #6366f1;">`
      : `<i class="fas fa-camera" style="color:#e2e8f0;font-size:1.2rem;margin-left:10px;"></i>`;

    return `
      <tr>
        <td style="color:#6366f1;font-weight:800">#${id}</td>
        <td><i class="fas fa-location-dot" style="color:#cbd5e1;margin-right:8px"></i>${address}</td>
        <td><span class="status-badge ${cssClass}">${label}</span></td>
        <td style="text-align:center;">${photoHTML}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:30px;height:30px;background:#f1f5f9;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.6rem;font-weight:bold;color:#64748b">ID</div>
            <span style="font-weight:500;color:#1e293b">${driver || "Unassigned"}</span>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// ============================================
// 4. UPDATE COUNTERS
// ============================================

function updateCounters(list) {
  const total     = list.length;
  const delivered = list.filter(({ status }) => status === "delivered").length;
  const pending   = total - delivered;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  set("total-entregas", total);
  set("total-pendents", pending);
  set("total-fet",      delivered);
}

// ============================================
// 5. POPULATE DRIVER FILTER
// ============================================

function populateDriverFilter() {
  const selector = document.getElementById("filtro-repartidor");
  if (!selector) return;

  const drivers = [...new Set(DELIVERIES.map(({ driver }) => driver))].filter(Boolean);

  selector.innerHTML = `<option value="all">All Drivers</option>` +
    drivers.map(d => `<option value="${d}">${d}</option>`).join("");
}

// ============================================
// 6. RENDER ALL (table + counters)
// ============================================

function renderAll(list) {
  renderTable(list);
  updateCounters(list);
}

// ============================================
// 7. GLOBAL MAP
// ============================================

function openGlobalMap() {
  const modal = document.getElementById("modal-mapa");
  modal.style.display = "block";

  setTimeout(() => {
    if (!globalMap) {
      globalMap = L.map("mapa-global", { zoomControl: false }).setView([39.4697, -0.3774], 13);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "©OpenStreetMap ©CartoDB"
      }).addTo(globalMap);
      L.control.zoom({ position: "bottomright" }).addTo(globalMap);
    } else {
      globalMap.invalidateSize();
    }

    // Clear old markers
    globalMap.eachLayer(layer => {
      if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
        globalMap.removeLayer(layer);
      }
    });

    // Add delivery points
    DELIVERIES.forEach(({ id, address, status, lat, lng }) => {
      if (!lat || !lng) return;

      const color = status === "delivered" ? "#10b981" : "#ef4444";
      const { label } = STATUS_CONFIG[status] || { label: status };

      L.circleMarker([lat, lng], {
        radius: 8, fillColor: color,
        color: "#fff", weight: 2,
        opacity: 1, fillOpacity: 0.9
      })
      .addTo(globalMap)
      .bindPopup(`
        <div style="font-family:sans-serif;padding:5px;">
          <strong style="color:${color}">#${id}</strong><br>
          <small style="color:#64748b">${address}</small><br>
          <div style="margin-top:5px;font-weight:bold;">Status: ${label}</div>
        </div>
      `);
    });
  }, 400);
}

function closeGlobalMap() {
  document.getElementById("modal-mapa").style.display = "none";
}

// ============================================
// 8. EXPORT CSV
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
