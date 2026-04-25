// ============================================
// LOGIFLOW — Route Guard (Supabase Auth)
// ============================================
const SUPABASE_URL_GUARD = "https://odopvrjvubngjqegwcbu.supabase.co";
const SUPABASE_ANON_KEY_GUARD = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kb3B2cmp2dWJuZ2pxZWd3Y2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzODM5MjUsImV4cCI6MjA4Mzk1OTkyNX0.fRk5SeF2V6tlrNCNPoJsTG8pTKJvz89ZE2zzRX8kQ4M";

// Hide page until auth is verified — prevents data leaks
document.documentElement.style.visibility = "hidden";


const _sbGuard = supabase.createClient(SUPABASE_URL_GUARD, SUPABASE_ANON_KEY_GUARD);

(async () => {
  try {
    const { data: { session } } = await _sbGuard.auth.getSession();

    const userRole = session.user?.user_metadata?.role;

    if (!session || (userRole !== "driver" && userRole !== "owner")) {
      console.error("Acceso denegado: Se requiere rol Driver u Owner");
      window.location.href = "../login/login.html";
      return;
    }

    // ✅ Auth passed — reveal the page
    document.documentElement.style.visibility = "visible";

  } catch (e) {
    console.error("Auth guard error:", e);
    window.location.replace("../login/login.html");
  }
})();

// ============================================
// LOGOUT — reusable from anywhere in the app
// ============================================
async function handleLogout() {
  try {
    await _sbGuard.auth.signOut();
  } catch (e) {
    console.error("Logout error:", e);
  }
  // Clear all app-related localStorage
  localStorage.removeItem("logiflow_lang");
  localStorage.removeItem("sb-odopvrjvubngjqegwcbu-auth-token");
  window.location.replace("../login/login.html");
}

// ============================================
// LOGIFLOW — Driver App
// ============================================

const API_URL = "https://logiflow-api-07n7.onrender.com";

// --- ODESSA COORDINATES ---
const DEFAULT_COORDS = [46.4825, 30.7233];
const BASE_LOCATION = { lat: 46.4825, lng: 30.7233 };

// --- APP STATE ---
let map, trafficLayer, markersLayer, routeLayer;
let deliveryPoints = [];
let selectedPhotoPointId = null;
let currentDriverId = null;
let capturedPhotoFile = null;

// ============================================
// TRANSLATIONS
// ============================================
let currentLang = localStorage.getItem("logiflow_lang") || "ua";

const TRANSLATIONS = {
  es: {
    appTitle: "Panel de Control de Reparto",
    access: "Acceso",
    driverIdPlaceholder: "ID Repartidor",
    syncRoute: "Sincronizar Mi Ruta",
    routeLoaded: "RUTA CARGADA",
    stops: "Paradas",
    rain: "Lluvia",
    traffic: "Tráfico",
    openGoogleMaps: "ABRIR RUTA COMPLETA",
    deliveryOrder: "Orden de Entrega",
    noRouteMsg: "Introduce tu ID para recibir la ruta...",
    enterDriverId: "Por favor, introduce tu ID de repartidor",
    loading: "Cargando...",
    driverNotFound: "ID no encontrado",
    error: "Error de conexión. Inténtalo de nuevo.",
    stop: "PARADA",
    delivered_btn: "Entregado",
    deliver: "Entregar",
    confirmDelivery: "¿Confirmar entrega de",
    confirm: "✅ Confirmar",
    cancel: "❌ Cancelar",
    uploading: "Subiendo...",
    incident: "Incidencia",
    incidentPrompt: "Motivo de la incidencia (Ej: Cliente ausente, Dirección incorrecta):",
    incidentSaved: "⚠️ Incidencia registrada.",
    noRouteAlert: "Primero sincroniza tu ruta.",
    noPendingAlert: "¡No hay entregas pendientes!",
    logout: "Cerrar Sesión",
  },
  ua: {
    appTitle: "Панель керування доставкою",
    access: "Вхід",
    driverIdPlaceholder: "Введіть ID",
    syncRoute: "Синхронізувати маршрут",
    routeLoaded: "МАРШРУТ ЗАВАНТАЖЕНО",
    stops: "Зупинки",
    rain: "Дощ",
    traffic: "Затори",
    openGoogleMaps: "ВІДКРИТИ ПОВНИЙ МАРШРУТ",
    logout: "Вийти",
    deliveryOrder: "Порядок доставки",
    noRouteMsg: "Введіть ID для отримання маршруту...",
    enterDriverId: "Введіть ID",
    loading: "Завантаження...",
    driverNotFound: "ID не знайдено",
    error: "Помилка з'єднання. Спробуйте ще раз.",
    stop: "ЗУПИНКА",
    delivered_btn: "Доставлено",
    deliver: "Доставити",
    confirmDelivery: "Підтвердити доставку",
    confirm: "✅ Підтвердити",
    cancel: "❌ Скасувати",
    uploading: "Завантаження...",
    incident: "Інцидент",
    incidentPrompt: "Причина інциденту (Напр: Клієнт відсутній, Неправильна адреса):",
    incidentSaved: "⚠️ Інцидент зареєстровано.",
    noRouteAlert: "Спочатку синхронізуйте маршрут.",
    noPendingAlert: "Немає очікуваних доставок!",
  }
};

function t(key) {
  return TRANSLATIONS[currentLang][key] || TRANSLATIONS["es"][key] || key;
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem("logiflow_lang", lang);

  // Update static HTML elements
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });

  // Update lang button
  const btn = document.getElementById("lang-btn");
  if (btn) btn.textContent = lang === "es" ? "🇺🇦 UA" : "🇪🇸 ES";

  // Re-render dynamic content
  if (deliveryPoints.length > 0) renderRanking();
}

function toggleLanguage() {
  setLanguage(currentLang === "es" ? "ua" : "es");
}

// ============================================
// INIT — single DOMContentLoaded!
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  setLanguage(currentLang); // apply saved language
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
// 1. CLOCK — Ukraine timezone
// ============================================
function startClock() {
  const el = document.getElementById("current-time");

  const update = () => {
    const locale = currentLang === "ua" ? "uk-UA" : "es-ES";
    const timezone = "Europe/Kyiv"; // UTC+3
    if (el) {
      el.textContent = new Date().toLocaleTimeString(locale, {
        timeZone: timezone,
        hour: "2-digit", minute: "2-digit", second: "2-digit"
      });
    }
  };

  update();
  setInterval(update, 1000);
}

// ============================================
// 2. MAP — Odessa center
// ============================================
function initMap() {
  try {
    map = L.map("map", { zoomControl: false }).setView(DEFAULT_COORDS, 13);
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
// 3. LOAD DRIVER ROUTE
// ============================================
async function loadDriverRoute() {
  const input = document.getElementById("repartidor-id");
  const btn = document.getElementById("btn-cargar-ruta");
  const driverId = input ? input.value.trim().toUpperCase() : "";

  if (!driverId) {
    alert(t("enterDriverId"));
    return;
  }

  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t("loading")}`;
    }

    const response = await fetch(`${API_URL}/api/driver/${driverId}`);
    const { data, success } = await response.json();

    if (!success || !data || data.length === 0) {
      alert(t("driverNotFound"));
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-sync-alt"></i> <span data-i18n="syncRoute">${t("syncRoute")}</span>`;
      }
      return;
    }

    currentDriverId = driverId;

    deliveryPoints = data.map(({ delivery_id, address, status, lat, lng }) => ({
      id: delivery_id, address, status, lat, lng
    }));

    const countEl = document.getElementById("delivery-count");
    if (countEl) countEl.textContent = deliveryPoints.length;

    optimizeRoute();

    if (btn) {
      btn.innerHTML = `<i class="fas fa-check"></i> ${t("routeLoaded")}`;
      btn.style.background = "#10b981";
      btn.disabled = false;
    }

  } catch (error) {
    console.error("Route loading error:", error);
    alert(t("error"));
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-sync-alt"></i> ${t("syncRoute")}`;
    }
  }
}

// ============================================
// 4. ROUTE OPTIMIZATION
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
        Math.pow(lat - currentPos.lat, 2) + Math.pow(lng - currentPos.lng, 2)
      );
      if (distance < minDistance) { minDistance = distance; nearestIndex = index; }
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
      Math.pow(point.lat - lastPos.lat, 2) + Math.pow(point.lng - lastPos.lng, 2)
    ) * 111;

    const minutesPerStop = (distance * 5) + 8;
    accumulatedTime = new Date(accumulatedTime.getTime() + minutesPerStop * 60000);

    const locale = currentLang === "ua" ? "uk-UA" : "es-ES";
    const timezone = "Europe/Kyiv";

    point.eta = accumulatedTime.toLocaleTimeString(locale, {
      timeZone: timezone,
      hour: "2-digit", minute: "2-digit"
    });

    lastPos = point;
  });
}

// ============================================
// 6. RENDER RANKING
// ============================================
function renderRanking() {
  const container = document.getElementById("delivery-ranking");
  if (!container) return;

  const visiblePoints = deliveryPoints.filter(({ id }) => id !== "START" && id !== "END");

  if (visiblePoints.length === 0) {
    container.innerHTML = `<p class="no-data">${t("noRouteMsg")}</p>`;
    return;
  }

  container.innerHTML = visiblePoints.map((point, index) => {
    const { id, address, status, eta, inTrafficZone } = point;
    const isDelivered = status === "delivered";
    const isIncident = status === "incident";

    const borderColor = inTrafficZone ? "#ef4444" : "#10b981";
    const btnIcon = isDelivered ? "fa-check-double" : "fa-camera";
    const btnText = isDelivered ? t("delivered_btn") : t("deliver");
    const btnClass = isDelivered ? "btn-skip-modern" : "btn-success";
    const origin = `${BASE_LOCATION.lat},${BASE_LOCATION.lng}`;

    return `
      <div class="ranking-item" id="item-${id}"
           style="opacity:${isDelivered ? 0.6 : 1}; border-left:5px solid ${borderColor};
                  padding:15px; margin-bottom:12px; background:white;
                  border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        <div style="display:flex; justify-content:space-between; align-items:start;">
          <div>
            <span style="background:#eef2ff; color:#6366f1; padding:4px 10px;
                         border-radius:8px; font-size:0.75rem; font-weight:800;
                         margin-bottom:8px; display:inline-block;">
              ${t("stop")} #${index + 1}
            </span>
            <br>
            <b style="font-size:1.1rem;">${id}</b> ${isIncident ? "⚠️" : ""}
            <br>
            <small style="color:#64748b;"><i class="fas fa-location-dot"></i> ${address}</small>
          </div>
          <div style="background:#fffbeb; color:#b45309; padding:6px 10px;
                      border-radius:10px; font-size:0.85rem; font-weight:700;">
            🕐 ${eta || "--:--"}
          </div>
        </div>
        <div style="display:flex; gap:8px; margin-top:15px;">
          <button id="btn-cam-${id}" class="btn-action ${btnClass}"
                  onclick="openCamera('${id}')"
                  style="flex:2; border:none; padding:12px; border-radius:8px;
                         font-weight:bold; cursor:pointer; display:flex;
                         align-items:center; justify-content:center; gap:8px;"
                  ${isDelivered ? "disabled" : ""}>
            <i class="fas ${btnIcon}"></i> ${btnText}
          </button>
          <button class="btn-action" onclick="registerIncident('${id}')"
                  style="background:#f59e0b; color:white; border:none;
                         flex:0.6; border-radius:8px; cursor:pointer;"
                  title="${t("incident")}">
            <i class="fas fa-exclamation-triangle"></i>
          </button>
          <button class="btn-action"
                  onclick="window.open('https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${point.lat},${point.lng}&travelmode=driving', '_blank')"
                  style="background:#34a853; color:white; border:none;
                         flex:0.6; border-radius:8px; cursor:pointer;">
            <i class="fas fa-location-arrow"></i>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

// ============================================
// 7. CAMERA + PHOTO PREVIEW
// ============================================
function openCamera(pointId) {
  selectedPhotoPointId = pointId;
  const input = document.getElementById("photo-input");
  if (input) input.click();
}

function handlePhotoCapture(e) {
  const file = e.target.files[0];
  if (!file || !selectedPhotoPointId) return;
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
          ${t("confirmDelivery")} ${selectedPhotoPointId}?
        </p>
        <div style="display:flex; gap:12px;">
          <button onclick="confirmDelivery('${selectedPhotoPointId}')"
                  style="background:#10b981; color:white; border:none;
                         padding:12px 24px; border-radius:8px;
                         font-weight:bold; cursor:pointer; font-size:1rem;">
            ${t("confirm")}
          </button>
          <button onclick="cancelPhotoPreview()"
                  style="background:#ef4444; color:white; border:none;
                         padding:12px 24px; border-radius:8px;
                         font-weight:bold; cursor:pointer; font-size:1rem;">
            ${t("cancel")}
          </button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", previewHTML);
  };
  reader.readAsDataURL(file);
  e.target.value = "";
}

async function confirmDelivery(pointId) {
  const modal = document.getElementById("photo-preview-modal");
  if (modal) modal.remove();

  const btn = document.getElementById(`btn-cam-${pointId}`);
  if (btn) btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t("uploading")}`;

  try {
    if (capturedPhotoFile) {
      const base64 = await compressImage(capturedPhotoFile);
      await fetch(`${API_URL}/api/photos/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, deliveryId: pointId })
      });
      capturedPhotoFile = null;
    }

    const response = await fetch(`${API_URL}/api/deliveries/${pointId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "delivered" })
    });
    if (!response.ok) throw new Error("Update failed");

    const point = deliveryPoints.find(({ id }) => id === pointId);
    if (point) point.status = "delivered";

    if (btn) {
      btn.style.background = "#10b981";
      btn.innerHTML = `<i class="fas fa-check"></i> ${t("delivered_btn").toUpperCase()}`;
      btn.disabled = true;
    }

    renderRanking();
    renderMapMarkers();
    drawRoute();

  } catch (error) {
    console.error("Delivery error:", error);
    alert(t("error"));
    capturedPhotoFile = null;
    if (btn) btn.innerHTML = `<i class="fas fa-camera"></i> ${t("deliver")}`;
  }

  selectedPhotoPointId = null;
}

function cancelPhotoPreview() {
  const modal = document.getElementById("photo-preview-modal");
  if (modal) modal.remove();
  selectedPhotoPointId = null;
}

// ============================================
// 8. INCIDENTS
// ============================================
async function registerIncident(pointId) {
  const reason = prompt(t("incidentPrompt"));
  if (!reason) return;

  try {
    await fetch(`${API_URL}/api/deliveries/${pointId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "incident" })
    });

    const point = deliveryPoints.find(({ id }) => id === pointId);
    if (point) { point.status = "incident"; point.incidentReason = reason; }

    alert(t("incidentSaved"));
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
    const colorMap = { delivered: "#64748b", pending: "#38bdf8", incident: "#f59e0b" };
    const color = colorMap[status] || "#38bdf8";
    L.circleMarker([lat, lng], { radius: 8, fillColor: color, color: "white", weight: 2, fillOpacity: 1 })
      .addTo(markersLayer)
      .bindTooltip(`<b>${id}</b><br>${address}`);
  });
}

// ============================================
// 10. ROUTE DRAWING
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
      if (group.getLayers().length > 0) map.fitBounds(group.getBounds().pad(0.1));
    }
  } catch (e) {
    console.error("Route drawing error:", e);
  }
}

// ============================================
// 11. TRAFFIC — disabled for Odessa
// ============================================
async function loadTraffic() {
  const statusEl = document.getElementById("traffic-status");
  if (statusEl) statusEl.textContent = "N/A";
}

// ============================================
// 12. WEATHER — Odessa coordinates
// ============================================
async function loadWeather() {
  try {
    // Odessa: lat=46.4825, lng=30.7233
    const response = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=46.4825&longitude=30.7233&hourly=precipitation_probability&forecast_days=1"
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
// 13. GOOGLE MAPS ROUTE
// ============================================
function openGoogleMapsRoute() {
  if (deliveryPoints.length === 0) { alert(t("noRouteAlert")); return; }
  const pending = deliveryPoints.filter(({ status }) => status !== "delivered");
  if (pending.length === 0) { alert(t("noPendingAlert")); return; }

  const origin = `${BASE_LOCATION.lat},${BASE_LOCATION.lng}`;
  const destination = `${pending[pending.length - 1].lat},${pending[pending.length - 1].lng}`;
  const waypoints = pending.slice(0, -1).map(({ lat, lng }) => `${lat},${lng}`).join("|");

  window.open(
    `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`,
    "_blank"
  );
}

// ============================================
// 14. MAP TOGGLES
// ============================================
function toggleTraffic() {
  const btn = document.getElementById("toggle-traffic");
  if (map.hasLayer(trafficLayer)) {
    map.removeLayer(trafficLayer);
    if (btn) btn.classList.remove("active");
  } else {
    map.addLayer(trafficLayer);
    if (btn) btn.classList.add("active");
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

// ============================================
// 15. IMAGE COMPRESSION
// ============================================
function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width, height = img.height;
        if (width > 800) { height = (height * 800) / width; width = 800; }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}