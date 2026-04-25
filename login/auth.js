// ============================================
// LOGIFLOW — Centralized Auth Module (Supabase)
// ============================================

const SUPABASE_URL = "https://odopvrjvubngjqegwcbu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kb3B2cmp2dWJuZ2pxZWd3Y2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzODM5MjUsImV4cCI6MjA4Mzk1OTkyNX0.fRk5SeF2V6tlrNCNPoJsTG8pTKJvz89ZE2zzRX8kQ4M";

// Initialize Supabase client
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// TRANSLATIONS (ES / UA)
// ============================================
let currentLang = localStorage.getItem("logiflow_lang") || "ua";

const AUTH_TRANSLATIONS = {
  es: {
    loginTitle: "Iniciar Sesión",
    subtitle: "Accede al ecosistema de logística inteligente",
    roleDriver: "Repartidor",
    roleDriverDesc: "Driver App",
    roleAdmin: "Administrador",
    roleAdminDesc: "Panel de Control",
    emailPlaceholder: "correo@empresa.com",
    passwordPlaceholder: "Contraseña",
    loginBtn: "Iniciar Sesión",
    verifying: "Verificando...",
    secureBadge: "Conexión segura con Supabase Auth",
    errSelectRole: "Por favor, selecciona un rol antes de continuar.",
    errEmptyFields: "Introduce tu email y contraseña.",
    errNoRole: "Este usuario no tiene un rol asignado. Contacta al administrador.",
    errDeniedAdmin: "⛔ Acceso denegado. Tu cuenta no tiene permisos de Administrador.",
    errDeniedDriver: "⛔ Acceso denegado. Tu cuenta no tiene permisos de Repartidor.",
    errGeneric: "Error de autenticación. Inténtalo de nuevo.",
    logout: "Cerrar Sesión",
  },
  ua: {
    loginTitle: "Увійти",
    subtitle: "Доступ до екосистеми логістики",
    roleDriver: "Водій",
    roleDriverDesc: "Додаток водія",
    roleAdmin: "Адміністратор",
    roleAdminDesc: "Панель керування",
    emailPlaceholder: "пошта@компанія.com",
    passwordPlaceholder: "Пароль",
    loginBtn: "Увійти",
    verifying: "Перевірка...",
    secureBadge: "Безпечне з'єднання через Supabase Auth",
    errSelectRole: "Будь ласка, оберіть роль перед продовженням.",
    errEmptyFields: "Введіть вашу електронну пошту та пароль.",
    errNoRole: "Цьому користувачу не призначено роль. Зверніться до адміністратора.",
    errDeniedAdmin: "⛔ Доступ заборонено. Ваш акаунт не має прав Адміністратора.",
    errDeniedDriver: "⛔ Доступ заборонено. Ваш акаунт не має прав Кур'єра.",
    errGeneric: "Помилка автентифікації. Спробуйте ще раз.",
    logout: "Вийти",
  }
};

function t(key) {
  return AUTH_TRANSLATIONS[currentLang]?.[key] || AUTH_TRANSLATIONS["es"]?.[key] || key;
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem("logiflow_lang", lang);
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });
  const btn = document.getElementById("lang-btn");
  if (btn) btn.textContent = lang === "es" ? "🇺🇦 UA" : "🇪🇸 ES";
  const loginBtn = document.getElementById("login-btn");
  if (loginBtn && !loginBtn.disabled) {
    loginBtn.innerHTML = `<i class="fas fa-sign-in-alt"></i> ${t("loginBtn")}`;
  }
}

function toggleLanguage() {
  setLanguage(currentLang === "es" ? "ua" : "es");
}

// ============================================
// HELPERS
// ============================================
function showError(el, message) {
  el.textContent = message;
  el.style.display = "flex";
  el.classList.remove("shake");
  void el.offsetWidth; // trigger reflow
  el.classList.add("shake");
}

// ============================================
// LOGIN HANDLER
// ============================================
async function handleLogin() {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const selectedRole = document.querySelector(".role-card.active")?.dataset.role;
  const errorEl = document.getElementById("login-error");
  const btnEl = document.getElementById("login-btn");

  errorEl.style.display = "none";
  errorEl.textContent = "";

  if (!selectedRole) {
    showError(errorEl, t("errSelectRole"));
    return;
  }
  if (!email || !password) {
    showError(errorEl, t("errEmptyFields"));
    return;
  }

  btnEl.disabled = true;
  btnEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t("verifying")}`;

  try {
    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });

    if (error) throw new Error(error.message);

    const userRole = data.user?.user_metadata?.role;
    if (!userRole) throw new Error(t("errNoRole"));

    // Logic for OWNER or matching roles
    if (userRole !== "owner") {
      if (selectedRole === "admin" && userRole !== "admin") {
        await _supabase.auth.signOut();
        throw new Error(t("errDeniedAdmin"));
      }
      if (selectedRole === "driver" && userRole !== "driver") {
        await _supabase.auth.signOut();
        throw new Error(t("errDeniedDriver"));
      }
    }

    // Redirect
    if (userRole === "owner") {
      window.location.href = selectedRole === "admin" ? "./admin/index.html" : "./delivery/index.html";
    } else if (userRole === "admin") {
      window.location.href = "./admin/index.html";
    } else if (userRole === "driver") {
      window.location.href = "./delivery/index.html";
    }
  } catch (err) {
    console.error("Login error:", err);
    showError(errorEl, err.message || t("errGeneric"));
    btnEl.disabled = false;
    btnEl.innerHTML = `<i class="fas fa-sign-in-alt"></i> ${t("loginBtn")}`;
  }
}

// ============================================
// LOGOUT & SESSION
// ============================================
async function handleLogout() {
  await _supabase.auth.signOut();
  window.location.href = "../login.html";
}