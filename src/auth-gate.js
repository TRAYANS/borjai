import { loadRuntimeConfig, hasSupabaseConfig } from "./config.js";
import { createSupabaseClient } from "./db/supabaseClient.js";

const ACCESS_KEY = "borjai:access";
const SESSION_KEY = "borjai:supabase:session:v1";
const PENDING_KEY = "borjai:auth:pending:v1";
const AUTHENTICATED_KEY = "borjai:auth:permanent:v1";

function parseAuthHash() {
  const raw = String(location.hash || "").replace(/^#/, "");
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken) return null;
  const expiresIn = Number(params.get("expires_in") || 3600);
  const session = { access_token: accessToken, refresh_token: refreshToken, expires_at: Math.floor(Date.now() / 1000) + expiresIn, user: null, auth_type: params.get("type") || "" };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  history.replaceState(null, "", location.pathname + location.search);
  return session;
}
function esc(value) { return String(value || "").replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[c])); }

function screen(mode, message = "") {
  const activation = mode === "activate";
  const forgot = mode === "forgot";
  const recover = mode === "recover";
  const title = activation ? "Activa tu cuenta" : recover ? "Nueva contraseña" : forgot ? "Recuperar contraseña" : "Iniciar sesión";
  const copy = activation ? "Vincula esta instalación con tu correo y conserva tus datos en una única cuenta." : recover ? "Introduce una nueva contraseña para recuperar el acceso." : forgot ? "Te enviaremos un enlace seguro a tu correo para crear una nueva contraseña." : "Accede a tus datos financieros desde cualquier navegador o dispositivo.";
  document.body.innerHTML = `
    <main class="borjai-auth-shell"><section class="borjai-auth-card">
      <div class="borjai-auth-brand"><span>B</span>Borja<span>AI</span></div>
      <div class="borjai-auth-kicker">CUENTA PRIVADA</div><h1>${title}</h1><p class="borjai-auth-copy">${copy}</p>
      ${message ? `<div class="borjai-auth-message">${esc(message)}</div>` : ""}
      <form id="borjai-auth-form" class="borjai-auth-form">
        ${(!mode || mode === "login" || forgot || activation) ? `<label>Email<input id="auth-email" type="email" autocomplete="username" required placeholder="tu@email.com"></label>` : ""}
        ${(activation || mode === "login" || recover) ? `<label>Contraseña<input id="auth-password" type="password" autocomplete="${mode === "login" ? "current-password" : "new-password"}" minlength="10" required placeholder="Mínimo 10 caracteres"></label>` : ""}
        ${(activation || recover) ? `<label>Confirma contraseña<input id="auth-confirm" type="password" autocomplete="new-password" minlength="10" required placeholder="Repite la contraseña"></label>` : ""}
        <button class="borjai-auth-primary" type="submit">${activation ? "Activar mi cuenta" : recover ? "Guardar nueva contraseña" : forgot ? "Enviar enlace" : "Entrar"}</button>
      </form>
      <div class="borjai-auth-links">
        ${activation ? `<button type="button" data-mode="login">Ya tengo una cuenta</button>` : `<button type="button" data-mode="activate">Activar esta cuenta</button>`}
        ${!activation && !recover && !forgot ? `<button type="button" data-mode="forgot">He olvidado mi contraseña</button>` : ""}
        ${forgot || recover ? `<button type="button" data-mode="login">Volver a iniciar sesión</button>` : ""}
      </div><p id="borjai-auth-error" class="borjai-auth-error"></p>
    </section></main>
    <style>.borjai-auth-shell{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#090a0d;color:#fff;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:24px;box-sizing:border-box}.borjai-auth-card{width:min(430px,100%);padding:34px;border:1px solid #292c33;border-radius:24px;background:#111318;box-shadow:0 24px 80px rgba(0,0,0,.45)}.borjai-auth-brand{font-size:28px;font-weight:800;letter-spacing:-.04em;margin-bottom:28px}.borjai-auth-brand>span:first-child{display:inline-flex;width:34px;height:34px;align-items:center;justify-content:center;border-radius:10px;background:#f32d3a;margin-right:8px}.borjai-auth-brand>span:last-child{color:#f32d3a}.borjai-auth-kicker{font-size:11px;font-weight:800;letter-spacing:.14em;color:#f32d3a;margin-bottom:8px}.borjai-auth-card h1{font-size:30px;letter-spacing:-.03em;margin:0 0 8px}.borjai-auth-copy{color:#9da3ad;line-height:1.55;margin:0 0 24px}.borjai-auth-form{display:grid;gap:14px}.borjai-auth-form label{font-size:13px;color:#c9cdd4;font-weight:700}.borjai-auth-form input{display:block;width:100%;box-sizing:border-box;margin-top:7px;padding:13px 14px;border:1px solid #383c45;border-radius:11px;background:#090a0d;color:#fff;font:inherit;outline:none}.borjai-auth-form input:focus{border-color:#f32d3a;box-shadow:0 0 0 3px rgba(243,45,58,.12)}.borjai-auth-primary{border:0;border-radius:11px;padding:14px;background:#f32d3a;color:#fff;font-weight:800;font-size:15px;cursor:pointer;margin-top:4px}.borjai-auth-links{display:flex;flex-wrap:wrap;gap:14px;margin-top:18px}.borjai-auth-links button{border:0;background:none;color:#9da3ad;padding:0;cursor:pointer;font:inherit;font-size:13px}.borjai-auth-links button:hover{color:#fff}.borjai-auth-message{padding:12px 14px;border:1px solid #2d333c;border-radius:12px;background:#0d1014;color:#cfd3da;font-size:13px;line-height:1.45;margin-bottom:16px}.borjai-auth-error{min-height:20px;color:#ff6570;font-size:13px;margin:14px 0 0}</style>`;
  document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => screen(button.dataset.mode)));
  document.getElementById("borjai-auth-form").addEventListener("submit", async (event) => {
    event.preventDefault(); const error = document.getElementById("borjai-auth-error"); error.textContent = "";
    const email = document.getElementById("auth-email")?.value.trim().toLowerCase(); const password = document.getElementById("auth-password")?.value || ""; const confirm = document.getElementById("auth-confirm")?.value || "";
    try {
      if (forgot) { await client.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}${location.pathname}` }); screen("login", "Si existe una cuenta con ese correo, recibirás un enlace para restablecer la contraseña."); return; }
      if (recover) { if (password !== confirm) throw new Error("Las contraseñas no coinciden."); if (password.length < 10) throw new Error("Usa una contraseña de al menos 10 caracteres."); await client.auth.updateUser({ password }); localStorage.setItem(AUTHENTICATED_KEY, "1"); localStorage.setItem(ACCESS_KEY, "ok"); location.reload(); return; }
      if (activation) {
        if (password !== confirm) throw new Error("Las contraseñas no coinciden."); if (password.length < 10) throw new Error("Usa una contraseña de al menos 10 caracteres.");
        const user = (await client.auth.getUser()).data.user; if (!user?.is_anonymous) throw new Error("Esta sesión ya pertenece a una cuenta permanente. Usa Iniciar sesión.");
        await client.auth.updateUser({ email }); sessionStorage.setItem(PENDING_KEY, JSON.stringify({ email })); screen("login", "Te hemos enviado un correo de confirmación. Confirma el correo y vuelve a BORJAI para terminar de activar tu cuenta y establecer la contraseña."); return;
      }
      await client.auth.signInWithPassword(email, password); localStorage.setItem(AUTHENTICATED_KEY, "1"); localStorage.setItem(ACCESS_KEY, "ok"); location.reload();
    } catch (e) { error.textContent = e?.message || "No se pudo completar la operación."; }
  });
}

let client;
async function start() {
  parseAuthHash(); const config = await loadRuntimeConfig();
  if (!hasSupabaseConfig(config)) { screen("login", "La autenticación de Supabase no está configurada todavía."); return; }
  client = await createSupabaseClient(config); const user = (await client.auth.getUser()).data.user;
  const pending = (() => { try { return JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null"); } catch (_) { return null; } })();
  const authType = (() => { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null")?.auth_type || ""; } catch (_) { return ""; } })();
  if (user && !user.is_anonymous && user.email_confirmed_at) { if (authType === "recovery") { screen("recover", "Has verificado tu identidad. Elige una nueva contraseña."); return; } localStorage.setItem(AUTHENTICATED_KEY, "1"); localStorage.setItem(ACCESS_KEY, "ok"); await import("../app.js"); return; }
  if (pending && user?.email_confirmed_at) { screen("recover", `Correo confirmado: ${esc(user.email || pending.email)}. Ahora establece tu contraseña.`); return; }
  screen("activate");
}
start().catch((error) => screen("login", error?.message || "No se pudo iniciar la autenticación."));
