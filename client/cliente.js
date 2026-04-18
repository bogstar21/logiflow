// ============================================
// LOGIFLOW — Customer Portal
// Data source: Real API (logiflow-api on Render)
// ============================================

// --- API CONFIG ---
const API_URL = "https://logiflow-api-07n7.onrender.com";

// --- STATUS CONFIG (code = English, label = Spanish) ---
const STATUS_CONFIG = {
  delivered: { label: "✅ Entregado", cssClass: "status-delivered", step: 3 },
  pending: { label: "🚚 En camino", cssClass: "status-pending", step: 2 },
  incident: { label: "⚠️ Incidencia", cssClass: "status-incident", step: 2 },
  tomorrow: { label: "📅 Para mañana", cssClass: "status-tomorrow", step: 1 },
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
// 3. SEARCH PACKAGE — now calls real API!
// ============================================

async function searchPackage() {
  const input = document.getElementById("track-id");
  const id = input ? input.value.toUpperCase().trim() : "";

  if (!id) {
    alert("Por favor, introduce un código (Ej: P07)");
    return;
  }

  try {
    // Show loading state
    const btnTrack = document.getElementById("btn-track");
    if (btnTrack) btnTrack.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    // Fetch from real API
    const response = await fetch(`${API_URL}/api/deliveries/${id}`);
    const { data, success } = await response.json();

    // Restore button
    if (btnTrack) btnTrack.innerHTML = '<i class="fas fa-arrow-right"></i>';

    if (!success || !data) {
      alert("Código no encontrado. Prueba con P01 - P10");
      return;
    }

    // Map Supabase column names to app names
    const package_ = {
      id: data.delivery_id,
      address: data.address,
      status: data.status,
      driver: data.driver_id,
      photo_url: data.photo_url,
      lat: data.lat,
      lng: data.lng
    };

    currentPackageId = id;
    renderPackageStatus(package_);
    updateMap(package_);

  } catch (error) {
    console.error("Search error:", error);
    alert("Error de conexión. Inténtalo de nuevo.");
  }
}

// ============================================
// 4. RENDER PACKAGE STATUS
// ============================================

function renderPackageStatus({ id, address, status, photo_url }) {
  const { label, cssClass, step } = STATUS_CONFIG[status] || {
    label: status, cssClass: "", step: 1
  };

  const container = document.getElementById("status-container");
  if (container) container.style.display = "block";

  const addressEl = document.getElementById("address-text");
  if (addressEl) addressEl.textContent = address;

  const statusLabel = document.getElementById("status-label");
  if (statusLabel) {
    statusLabel.className = `status-badge ${cssClass}`;
    statusLabel.textContent = label;
  }

  updateStepper(step);

  const actionsCard = document.getElementById("actions-card");
  if (actionsCard) {
    actionsCard.style.display = status === "delivered" ? "none" : "block";
  }

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
    document.getElementById("step-almacen"),
    document.getElementById("step-reparto"),
    document.getElementById("step-entregado"),
  ];

  steps.forEach((step, index) => {
    if (!step) return;
    step.classList.remove("active", "completed");

    const stepNumber = index + 1;
    if (stepNumber <= currentStep) {
      step.classList.add("completed");
      if (stepNumber === currentStep) step.classList.add("active");
    }
  });
}

// ============================================
// 6. MAP UPDATE
// ============================================

function updateMap({ lat, lng, id, address }) {
  if (!map || !lat || !lng) return;

  if (currentMarker) map.removeLayer(currentMarker);

  currentMarker = L.marker([lat, lng])
    .addTo(map)
    .bindPopup(`<b>Paquete ${id}</b><br>${address}`)
    .openPopup();

  map.flyTo([lat, lng], 15);
}

// ============================================
// 7. DELAY ACTIONS — now calls real API!
// ============================================

async function requestDelay(option) {
  if (!currentPackageId) return;

  const newStatus = option === "tomorrow" ? "tomorrow" : "pending";

  try {
    const response = await fetch(`${API_URL}/api/deliveries/${currentPackageId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });

    const { success } = await response.json();

    if (success) {
      const message = option === "tomorrow"
        ? "✅ ¡Notificado! Tu paquete se entregará mañana."
        : "✅ ¡Notificado! Tu paquete llegará esta tarde.";

      alert(message);
      await searchPackage(); // refresh from API
    }

  } catch (error) {
    console.error("Delay error:", error);
    alert("Error de conexión. Inténtalo de nuevo.");
  }
}