// ============================================
// LOGIFLOW — Customer Portal
// Data source: Fake JSON (replace with API later)
// ============================================

// --- FAKE DATABASE ---
// Same data as admin — in future this will come from your API
const DELIVERIES = [
  { id: "P01", address: "Calle Colón 1, Valencia",          status: "delivered", driver: "DRV-001", lat: 39.4697, lng: -0.3774, photo_url: null },
  { id: "P02", address: "Avenida del Puerto 15, Valencia",  status: "pending",   driver: "DRV-002", lat: 39.4739, lng: -0.3732, photo_url: null },
  { id: "P03", address: "Plaza del Ayuntamiento 3",         status: "delivered", driver: "DRV-001", lat: 39.4699, lng: -0.3763, photo_url: null },
  { id: "P04", address: "Calle Xàtiva 22, Valencia",        status: "incident",  driver: "DRV-003", lat: 39.4658, lng: -0.3780, photo_url: null },
  { id: "P05", address: "Gran Vía Marqués del Turia 48",    status: "pending",   driver: "DRV-002", lat: 39.4681, lng: -0.3810, photo_url: null },
  { id: "P06", address: "Calle Cirilo Amorós 55",           status: "tomorrow",  driver: "DRV-001", lat: 39.4710, lng: -0.3795, photo_url: null },
  { id: "P07", address: "Avenida Blasco Ibáñez 10",         status: "delivered", driver: "DRV-003", lat: 39.4780, lng: -0.3600, photo_url: null },
  { id: "P08", address: "Calle Russafa 8, Valencia",        status: "pending",   driver: "DRV-002", lat: 39.4640, lng: -0.3750, photo_url: null },
  { id: "P09", address: "Plaza de España 2, Valencia",      status: "delivered", driver: "DRV-001", lat: 39.4720, lng: -0.3830, photo_url: null },
  { id: "P10", address: "Calle San Vicente Mártir 71",      status: "incident",  driver: "DRV-003", lat: 39.4670, lng: -0.3760, photo_url: null },
];

// --- STATUS CONFIG (code = English, label = Spanish) ---
const STATUS_CONFIG = {
  delivered: { label: "✅ Entregado",      cssClass: "status-delivered", step: 3 },
  pending:   { label: "🚚 En camino",      cssClass: "status-pending",   step: 2 },
  incident:  { label: "⚠️ Incidencia",     cssClass: "status-incident",  step: 2 },
  tomorrow:  { label: "📅 Para mañana",    cssClass: "status-tomorrow",  step: 1 },
};

// --- APP STATE ---
let map = null;
let currentMarker = null;
let currentPackageId = null;

// ============================================
// INIT
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  startClock();
  initMap();

  const btnTrack = document.getElementById("btn-track");
  if (btnTrack) btnTrack.addEventListener("click", searchPackage);

  // Allow Enter key to search
  const inputTrack = document.getElementById("track-id");
  if (inputTrack) inputTrack.addEventListener("keyup", (e) => {
    if (e.key === "Enter") searchPackage();
  });
});

// ============================================
// 1. CLOCK
// ============================================

function startClock() {
  const el = document.getElementById("current-time");
  const update = () => { if (el) el.textContent = new Date().toLocaleTimeString("es-ES"); };
  update();
  setInterval(update, 1000);
}

// ============================================
// 2. MAP
// ============================================

function initMap() {
  try {
    map = L.map("map", { zoomControl: false }).setView([39.4697, -0.3774], 13);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "©OpenStreetMap ©CartoDB"
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
  } catch (e) {
    console.error("Map error:", e);
  }
}

// ============================================
// 3. SEARCH PACKAGE
// ============================================

function searchPackage() {
  const input = document.getElementById("track-id");
  const id = input ? input.value.toUpperCase().trim() : "";

  if (!id) {
    alert("Por favor, introduce un código (Ej: P07)");
    return;
  }

  // Find package in fake data
  const package_ = DELIVERIES.find(({ id: pkgId }) => pkgId === id);

  if (!package_) {
    alert("Código no encontrado. Prueba con P01 - P10");
    return;
  }

  // Save current package for delay actions
  currentPackageId = id;

  // Update UI
  renderPackageStatus(package_);
  updateMap(package_);
}

// ============================================
// 4. RENDER PACKAGE STATUS
// ============================================

function renderPackageStatus({ id, address, status, photo_url }) {
  const { label, cssClass, step } = STATUS_CONFIG[status] || {
    label: status, cssClass: "", step: 1
  };

  // Show status container
  const container = document.getElementById("status-container");
  if (container) container.style.display = "block";

  // Update address
  const addressEl = document.getElementById("address-text");
  if (addressEl) addressEl.textContent = address;

  // Update status badge
  const statusLabel = document.getElementById("status-label");
  if (statusLabel) {
    statusLabel.className = `status-badge ${cssClass}`;
    statusLabel.textContent = label;
  }

  // Update stepper
  updateStepper(step);

  // Show/hide action buttons
  const actionsCard = document.getElementById("actions-card");
  if (actionsCard) {
    actionsCard.style.display = status === "delivered" ? "none" : "block";
  }

  // Show delivery photo if exists
  const photoContainer = document.getElementById("foto-evidencia");
  const photoImg = document.getElementById("img-evidencia");
  if (photoContainer && photoImg) {
    if (photo_url && status === "delivered") {
      photoContainer.style.display = "block";
      photoImg.src = photo_url;
    } else {
      photoContainer.style.display = "none";
    }
  }
}

// ============================================
// 5. STEPPER
// ============================================

function updateStepper(currentStep) {
  const steps = [
    document.getElementById("step-almacen"),   // step 1
    document.getElementById("step-reparto"),    // step 2
    document.getElementById("step-entregado"),  // step 3
  ];

  steps.forEach((step, index) => {
    if (!step) return;
    step.classList.remove("active", "completed");

    const stepNumber = index + 1;
    if (stepNumber < currentStep) step.classList.add("completed");
    if (stepNumber === currentStep) step.classList.add("active");
  });
}

// ============================================
// 6. MAP UPDATE
// ============================================

function updateMap({ lat, lng, id, address }) {
  if (!map || !lat || !lng) return;

  // Remove old marker
  if (currentMarker) map.removeLayer(currentMarker);

  // Add new marker
  currentMarker = L.marker([lat, lng])
    .addTo(map)
    .bindPopup(`<b>Paquete ${id}</b><br>${address}`)
    .openPopup();

  map.flyTo([lat, lng], 15);
}

// ============================================
// 7. DELAY ACTIONS
// ============================================

function requestDelay(option) {
  if (!currentPackageId) return;

  // Find and update package in fake data
  const package_ = DELIVERIES.find(({ id }) => id === currentPackageId);
  if (!package_) return;

  if (option === "tomorrow") {
    package_.status = "tomorrow";
    alert("✅ ¡Notificado! Tu paquete se entregará mañana.");
  } else if (option === "afternoon") {
    package_.status = "pending";
    alert("✅ ¡Notificado! Tu paquete llegará esta tarde.");
  }

  // Refresh the UI with updated status
  renderPackageStatus(package_);
}
