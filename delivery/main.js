// ============================================
// LOGIFLOW — Driver App
// Data source: Real API (logiflow-api on Render)
// ============================================

// --- API CONFIG ---
const API_URL = "https://logiflow-api-07n7.onrender.com";

// --- BASE LOCATION (Valencia depot) ---
const BASE_LOCATION = { lat: 39.4632, lng: -0.3541 };
const VALENCIA_COORDS = [39.4699, -0.3763];

// --- APP STATE ---
let map, trafficLayer, markersLayer, routeLayer;
let deliveryPoints = [];
let selectedPhotoPointId = null;
let currentDriverId = null;
let capturedPhotoFile = null;

// ============================================
// INIT
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  startClock();
  loadWeather();

  const btnLoad = document.getElementById("btn-cargar-ruta");
  if (btnLoad) btnLoad.onclick = loadDriverRoute;

  const photoInput = document.getElementById("photo-input");
  if (photoInput) photoInput.addEventListener("change", handlePhotoCapture);

  const btnTraffic = document.getElementById("toggle-traffic");
  if (btnTraffic) btnTraffic.onclick = toggleTraffic;

  const btnRoute = document.getElementById("toggle-route");
  if (btnRoute) btnRoute.onclick = toggleRoute;

  setTimeout(() => {
    const btnMaps = document.getElementById("btn-google-maps");
    if (btnMaps) btnMaps.onclick = openGoogleMapsRoute;
  }, 1000);
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
    map = L.map("map", { zoomControl: false }).setView(VALENCIA_COORDS, 13);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "©OpenStreetMap ©CartoDB"
    }).addTo(map);

    trafficLayer = L.layerGroup().addTo(map);
    routeLayer = L.layerGroup().addTo(map);
    markersLayer = L.layerGroup().addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);
  } catch (e) {
    console.error("Map error:", e);
  }
}

// ============================================
// 3. LOAD DRIVER ROUTE — now calls real API!
// ============================================

async function loadDriverRoute() {
  const input = document.getElementById("repartidor-id");
  const btn = document.getElementById("btn-cargar-ruta");
  const driverId = input ? input.value.trim().toUpperCase() : "";

  if (!driverId) {
    alert("Introduce tu ID de repartidor (Ej: DRV-001)");
    return;
  }

  try {
    // Show loading state
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando...';
    }

    // Fetch from real API
    const response = await fetch(`${API_URL}/api/driver/${driverId}`);
    const { data, success } = await response.json();

    if (!success || !data || data.length === 0) {
      alert("ID no encontrado. Prueba: DRV-001, DRV-002 o DRV-003");
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sync-alt"></i> Sincronizar Mi Ruta';
      }
      return;
    }

    currentDriverId = driverId;

    // Map Supabase column names to app names
    deliveryPoints = data.map(({ delivery_id, address, status, lat, lng }) => ({
      id: delivery_id,
      address,
      status,
      lat,
      lng
    }));

    // Update counter
    const countEl = document.getElementById("delivery-count");
    if (countEl) countEl.textContent = deliveryPoints.length;

    // Optimize route and render
    optimizeRoute();

    // Update button
    if (btn) {
      btn.innerHTML = '<i class="fas fa-check"></i> RUTA CARGADA';
      btn.style.background = "#10b981";
      btn.disabled = false;
    }

  } catch (error) {
    console.error("Route loading error:", error);
    alert("Error de conexión. Inténtalo de nuevo.");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-sync-alt"></i> Sincronizar Mi Ruta';
    }
  }
}

// ============================================
// 4. ROUTE OPTIMIZATION (Nearest Neighbor)
// ============================================

function optimizeRoute() {
  if (deliveryPoints.length === 0) return;

  const delivered = deliveryPoints.filter(({ status }) => status === "delivered");
  const pending = deliveryPoints.filter(({ status }) => status === "pending" || status === "incident");

  let optimized = [];
  let remaining = [...pending];
  let currentPos = BASE_LOCATION;

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let minDistance = Infinity;

    remaining.forEach(({ lat, lng }, index) => {
      const distance = Math.sqrt(
        Math.pow(lat - currentPos.lat, 2) +
        Math.pow(lng - currentPos.lng, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = index;
      }
    });

    const nearest = remaining.splice(nearestIndex, 1)[0];
    optimized.push(nearest);
    currentPos = nearest;
  }

  deliveryPoints = [...delivered, ...optimized];

  calculateETA();
  renderRanking();
  renderMapMarkers();
  drawRoute();
}

// ============================================
// 5. ETA CALCULATION
// ============================================

function calculateETA() {
  const now = new Date();
  let accumulatedTime = now;
  let lastPos = BASE_LOCATION;

  deliveryPoints.forEach(point => {
    const distance = Math.sqrt(
      Math.pow(point.lat - lastPos.lat, 2) +
      Math.pow(point.lng - lastPos.lng, 2)
    ) * 111;

    const minutesPerStop = (distance * 5) + 8;
    accumulatedTime = new Date(accumulatedTime.getTime() + minutesPerStop * 60000);

    point.eta = accumulatedTime.toLocaleTimeString("es-ES", {
      hour: "2-digit", minute: "2-digit"
    });

    lastPos = point;
  });
}

// ============================================
// 6. RENDER RANKING LIST
// ============================================

function renderRanking() {
  const container = document.getElementById("delivery-ranking");
  if (!container) return;

  const visiblePoints = deliveryPoints.filter(({ id }) => id !== "START" && id !== "END");

  container.innerHTML = visiblePoints.map((point, index) => {
    const { id, address, status, eta, inTrafficZone } = point;
    const isDelivered = status === "delivered";
    const isIncident = status === "incident";

    const borderColor = inTrafficZone ? "#ef4444" : "#10b981";
    const btnIcon = isDelivered ? "fa-check-double" : "fa-camera";
    const btnText = isDelivered ? "Entregado" : "Entregar";
    const btnClass = isDelivered ? "btn-skip-modern" : "btn-success";
    const origin = `${BASE_LOCATION.lat},${BASE_LOCATION.lng}`;

    return `
      <div class="ranking-item" id="item-${id}"
           style="opacity:${isDelivered ? 0.6 : 1}; border-left: 5px solid ${borderColor}">
        <div style="display:flex; justify-content:space-between; align-items:start;">
          <div>
            <span style="background:#eef2ff; color:#6366f1; padding:4px 10px;
                         border-radius:8px; font-size:0.75rem; font-weight:800;
                         margin-bottom:8px; display:inline-block;">
              PARADA #${index + 1}
            </span>
            <br>
            <b>${id}</b> ${isIncident ? "⚠️" : ""}
            <br>
            <small><i class="fas fa-location-dot"></i> ${address}</small>
          </div>
          <div style="background:#fffbeb; color:#b45309; padding:6px 10px;
                      border-radius:10px; font-size:0.85rem; font-weight:700;">
            🕐 ${eta || "--:--"}
          </div>
        </div>
        <div style="display:flex; gap:8px; margin-top:15px;">
          <button id="btn-cam-${id}"
                  class="btn-action ${btnClass}"
                  onclick="openCamera('${id}')"
                  style="flex:2;" ${isDelivered ? "disabled" : ""}>
            <i class="fas ${btnIcon}"></i> ${btnText}
          </button>
          <button class="btn-action"
                  onclick="registerIncident('${id}')"
                  style="background:#f59e0b; color:white; flex:0.6;"
                  title="Incidencia">
            <i class="fas fa-exclamation-triangle"></i>
          </button>
          <button class="btn-action"
                  onclick="window.open('https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${point.lat},${point.lng}&travelmode=driving', '_blank')"
                  style="background:#34a853; color:white; flex:0.6;">
            <i class="fas fa-location-arrow"></i>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

// ============================================
// 7. CAMERA + PHOTO PREVIEW + MARK DELIVERED
// ============================================

function openCamera(pointId) {
  selectedPhotoPointId = pointId;
  const input = document.getElementById("photo-input");
  if (input) input.click();
}

function handlePhotoCapture(e) {
  const file = e.target.files[0];
  if (!file || !selectedPhotoPointId) return;

  // ✅ Save the file globally before clearing the input
  capturedPhotoFile = file;

  const reader = new FileReader();
  reader.onload = (event) => {
    const previewHTML = `
      <div id="photo-preview-modal"
           style="position:fixed; inset:0; background:rgba(0,0,0,0.8);
                  display:flex; flex-direction:column; align-items:center;
                  justify-content:center; z-index:9999; padding:20px;">
        <img src="${event.target.result}"
             style="max-width:100%; max-height:60vh; border-radius:12px;
                    border:3px solid #10b981; margin-bottom:20px;">
        <p style="color:white; margin-bottom:15px; font-weight:bold;">
          ¿Confirmar entrega de ${selectedPhotoPointId}?
        </p>
        <div style="display:flex; gap:12px;">
          <button onclick="confirmDelivery('${selectedPhotoPointId}')"
                  style="background:#10b981; color:white; border:none;
                         padding:12px 24px; border-radius:8px;
                         font-weight:bold; cursor:pointer; font-size:1rem;">
            ✅ Confirmar
          </button>
          <button onclick="cancelPhotoPreview()"
                  style="background:#ef4444; color:white; border:none;
                         padding:12px 24px; border-radius:8px;
                         font-weight:bold; cursor:pointer; font-size:1rem;">
            ❌ Cancelar
          </button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", previewHTML);
  };

  reader.readAsDataURL(file);
  e.target.value = ""; // Clear input safely
}

async function confirmDelivery(pointId) {
  const modal = document.getElementById("photo-preview-modal");
  if (modal) modal.remove();

  console.log("capturedPhotoFile:", capturedPhotoFile);
  console.log("pointId:", pointId);
  const btn = document.getElementById(`btn-cam-${pointId}`);
  if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo...';

  try {
    // 1. Si hay foto, la subimos primero
    if (capturedPhotoFile) {
      const base64 = await compressImage(capturedPhotoFile);

      await fetch(`${API_URL}/api/photos/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, deliveryId: pointId })
      });

      capturedPhotoFile = null; // Limpiamos la variable
    }

    // 2. AHORA (fuera del if), hacemos el PUT para cambiar el estado a "delivered"
    // Esto se ejecutará siempre, haya subido foto o no.
    const response = await fetch(`${API_URL}/api/deliveries/${pointId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "delivered" })
    });

    if (!response.ok) throw new Error("No se pudo actualizar el estado en el servidor");

    // 3. Actualizamos el estado local
    const point = deliveryPoints.find(({ id }) => id === pointId);
    if (point) point.status = "delivered";

    if (btn) {
      btn.style.background = "#10b981";
      btn.innerHTML = '<i class="fas fa-check"></i> ENTREGADO';
      btn.disabled = true;
    }

    renderRanking();
    renderMapMarkers();
    drawRoute();

  } catch (error) {
    console.error("Delivery error:", error);
    alert("Error al confirmar entrega: " + error.message);
    capturedPhotoFile = null;
    if (btn) btn.innerHTML = '<i class="fas fa-camera"></i> Entregar';
  }

  selectedPhotoPointId = null;
}

// Helper — converts file to base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function cancelPhotoPreview() {
  const modal = document.getElementById("photo-preview-modal");
  if (modal) modal.remove();
  selectedPhotoPointId = null;
}

// ============================================
// 8. INCIDENTS — now calls real API!
// ============================================

async function registerIncident(pointId) {
  const reason = prompt("Motivo de la incidencia (Ej: Cliente ausente, Dirección incorrecta):");
  if (!reason) return;

  try {
    await fetch(`${API_URL}/api/deliveries/${pointId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "incident" })
    });

    const point = deliveryPoints.find(({ id }) => id === pointId);
    if (point) {
      point.status = "incident";
      point.incidentReason = reason;
    }

    alert("⚠️ Incidencia registrada.");
    renderRanking();
    renderMapMarkers();

  } catch (error) {
    console.error("Incident error:", error);
  }
}

// ============================================
// 9. MAP MARKERS
// ============================================

function renderMapMarkers() {
  markersLayer.clearLayers();

  deliveryPoints.forEach(({ id, lat, lng, address, status }) => {
    const colorMap = {
      delivered: "#64748b",
      pending: "#38bdf8",
      incident: "#f59e0b",
    };
    const color = colorMap[status] || "#38bdf8";

    L.circleMarker([lat, lng], {
      radius: 8, fillColor: color,
      color: "white", weight: 2, fillOpacity: 1
    })
      .addTo(markersLayer)
      .bindTooltip(`<b>${id}</b><br>${address}`);
  });
}

// ============================================
// 10. ROUTE DRAWING (OSRM)
// ============================================

async function drawRoute() {
  routeLayer.clearLayers();
  if (deliveryPoints.length < 2) return;

  const coords = deliveryPoints.map(({ lng, lat }) => `${lng},${lat}`).join(";");

  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
    );
    const data = await response.json();

    if (data.code === "Ok") {
      L.geoJSON(data.routes[0].geometry, {
        style: { color: "#38bdf8", weight: 4, opacity: 0.8 }
      }).addTo(routeLayer);

      const group = new L.featureGroup(markersLayer.getLayers());
      if (group.getLayers().length > 0) {
        map.fitBounds(group.getBounds().pad(0.1));
      }
    }
  } catch (e) {
    console.error("Route drawing error:", e);
  }
}

// ============================================
// 11. TRAFFIC LAYER (Valencia Open Data)
// ============================================

async function loadTraffic() {
  const statusEl = document.getElementById("traffic-status");

  try {
    const url = "https://valencia.opendatasoft.com/api/explore/v2.1/catalog/datasets/estat-transit-temps-real-estado-trafico-tiempo-real/exports/geojson";
    const response = await fetch(url);
    if (!response.ok) throw new Error("Traffic API error");
    const data = await response.json();

    trafficLayer.clearLayers();

    L.geoJSON(data, {
      style: ({ properties: { estado } }) => ({
        color: estado >= 3 ? "#ef4444" : estado === 2 ? "#eab308" : "#22c55e",
        weight: 5,
        opacity: 0.9,
        lineCap: "round"
      })
    }).addTo(trafficLayer);

    if (deliveryPoints.length > 0) {
      deliveryPoints.forEach(point => {
        point.inTrafficZone = data.features.some(({ properties, geometry }) => {
          if (properties.estado < 3) return false;
          const [lng, lat] = geometry.coordinates[0][0];
          const distance = Math.sqrt(
            Math.pow(point.lat - lat, 2) +
            Math.pow(point.lng - lng, 2)
          );
          return distance < 0.005;
        });
      });
      optimizeRoute();
    }

    const heavyTraffic = data.features.filter(({ properties }) => properties.estado >= 3).length;
    if (statusEl) {
      statusEl.innerHTML = heavyTraffic > 15
        ? `<span style="color:#ef4444;">⚠️ ATASCO</span>`
        : `<span style="color:#22c55e;">LIVE</span>`;
    }

  } catch (e) {
    console.error("Traffic error:", e);
    if (statusEl) statusEl.textContent = "OFFLINE";
  }
}

// ============================================
// 12. WEATHER (Open-Meteo)
// ============================================

async function loadWeather() {
  try {
    const response = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=39.4699&longitude=-0.3763&hourly=precipitation_probability&forecast_days=1"
    );
    const data = await response.json();
    const currentHour = new Date().getHours();
    const rainProb = data.hourly.precipitation_probability[currentHour] || 0;

    const el = document.getElementById("rain-prob");
    if (el) el.textContent = `${rainProb}%`;
  } catch (e) {
    console.error("Weather error:", e);
  }
}

// ============================================
// 13. GOOGLE MAPS FULL ROUTE
// ============================================

function openGoogleMapsRoute() {
  if (deliveryPoints.length === 0) {
    alert("Primero sincroniza tu ruta.");
    return;
  }

  const pending = deliveryPoints.filter(({ status }) => status !== "delivered");

  if (pending.length === 0) {
    alert("¡No hay entregas pendientes!");
    return;
  }

  const origin = `${BASE_LOCATION.lat},${BASE_LOCATION.lng}`;
  const destination = `${pending[pending.length - 1].lat},${pending[pending.length - 1].lng}`;
  const waypoints = pending.slice(0, -1).map(({ lat, lng }) => `${lat},${lng}`).join("|");

  const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
  window.open(url, "_blank");
}

// ============================================
// 14. MAP LAYER TOGGLES
// ============================================

function toggleTraffic() {
  const btn = document.getElementById("toggle-traffic");
  if (map.hasLayer(trafficLayer)) {
    map.removeLayer(trafficLayer);
    if (btn) btn.classList.remove("active");
  } else {
    map.addLayer(trafficLayer);
    if (btn) btn.classList.add("active");
    loadTraffic();
  }
}

function toggleRoute() {
  const btn = document.getElementById("toggle-route");
  if (map.hasLayer(routeLayer)) {
    map.removeLayer(routeLayer);
    if (btn) btn.classList.remove("active");
  } else {
    map.addLayer(routeLayer);
    if (btn) btn.classList.add("active");
  }
}

// Compress image before uploading
function compressImage(file, maxSizeMB = 0.3) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");

        // Resize to max 800px wide
        let width = img.width;
        let height = img.height;
        if (width > 800) {
          height = (height * 800) / width;
          width = 800;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Compress to JPEG 0.7 quality
        const compressed = canvas.toDataURL("image/jpeg", 0.7);
        resolve(compressed);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}