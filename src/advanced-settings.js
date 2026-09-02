import { loadRuntimeConfig, hasSupabaseConfig } from "./config.js";
import { createSupabaseClient } from "./db/supabaseClient.js";

const PROFILE_KEY = "borjai_profile";
const DEFAULTS = {
  name: "Borja",
  age: "",
  employment: "",
  income: 0,
  payDay: 1,
  dependents: 0,
  risk: "Moderado",
  horizon: "5-10 años",
  philosophy: "Crecimiento patrimonial",
  priorities: ["seguridad", "crecimiento"],
  emergency: 3,
  minimumLiquidity: 0,
  protectMinimum: true,
  contribution: 300,
  savingsTarget: 0,
  investmentPreferences: ["ETFs", "Fondos indexados", "Acciones", "Robo-advisor"],
  excludedAssets: [],
  alertEnabled: { exceptional: true, category: true, recurring: true, duplicate: true, lowBalance: true, investment: false, goal: true, wealthDrop: true },
  alertSpend: 100,
  alertMonthlySpend: 0,
  coachStyle: "Directo",
  coachChallenge: true,
  coachIntervention: "Proactivo"
};

let clientPromise;
function esc(value) { return String(value ?? "").replace(/[&<>\"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])); }
function mergeProfile(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return { ...DEFAULTS, ...source, priorities: Array.isArray(source.priorities) ? source.priorities : DEFAULTS.priorities, investmentPreferences: Array.isArray(source.investmentPreferences) ? source.investmentPreferences : DEFAULTS.investmentPreferences, excludedAssets: Array.isArray(source.excludedAssets) ? source.excludedAssets : [], alertEnabled: { ...DEFAULTS.alertEnabled, ...(source.alertEnabled || {}) } };
}
async function getClient() {
  if (!clientPromise) clientPromise = loadRuntimeConfig().then(config => {
    if (!hasSupabaseConfig(config)) throw new Error("Supabase no está configurado.");
    return createSupabaseClient(config);
  });
  return clientPromise;
}
async function getProfile() {
  const client = await getClient();
  const result = await client.auth.getUser();
  if (result.error) throw result.error;
  if (!result.data?.user) throw new Error("No existe una sesión de usuario.");
  return { client, user: result.data.user, profile: mergeProfile(result.data.user.user_metadata?.[PROFILE_KEY]) };
}
function checked(list, value) { return list.includes(value) ? " checked" : ""; }
function renderCheckboxes(name, values, selected, labels) {
  return values.map(value => `<label class="pref-check"><input type="checkbox" name="${name}" value="${esc(value)}"${checked(selected, value)}><span>${esc(labels?.[value] || value)}</span></label>`).join("");
}
function openModal(profile) {
  const root = document.getElementById("modal-root");
  if (!root) return;
  const alerts = profile.alertEnabled;
  root.innerHTML = `<div class="modal-backdrop advanced-settings-backdrop" data-advanced-close>
    <section class="modal modal-wide advanced-settings-modal" role="dialog" aria-modal="true" aria-labelledby="advanced-settings-title">
      <header class="modal-head"><div><div class="section-kicker">Configuración · Borjai 2.0.1</div><h2 id="advanced-settings-title">Tu perfil financiero</h2><p>Personaliza cómo analiza, decide y te habla Borjai.</p></div><button class="icon-button modal-close" type="button" data-advanced-close aria-label="Cerrar">×</button></header>
      <form id="advanced-settings-form">
        <div class="modal-body advanced-settings-body">
          <section class="pref-section"><div class="pref-section-head"><div><div class="section-kicker">01 · Perfil personal</div><h3>Contexto sobre ti</h3><p>Cuanto mejor te conozca Borjai, más útiles serán sus análisis.</p></div></div>
            <div class="form-grid"><div class="form-field"><label>Tu nombre</label><input name="name" required value="${esc(profile.name)}"></div><div class="form-field"><label>Edad</label><input name="age" type="number" min="16" max="100" value="${esc(profile.age)}" placeholder="Opcional"></div><div class="form-field"><label>Situación laboral</label><select name="employment"><option value="">No especificada</option><option${profile.employment==="Empleado"?" selected":""}>Empleado</option><option${profile.employment==="Autónomo"?" selected":""}>Autónomo</option><option${profile.employment==="Empresario"?" selected":""}>Empresario</option><option${profile.employment==="Estudiante"?" selected":""}>Estudiante</option><option${profile.employment==="Jubilado"?" selected":""}>Jubilado</option></select></div><div class="form-field"><label>Ingresos habituales / mes</label><input name="income" type="number" min="0" step="50" value="${esc(profile.income)}"></div><div class="form-field"><label>Día habitual de cobro</label><input name="payDay" type="number" min="1" max="31" value="${esc(profile.payDay)}"></div><div class="form-field"><label>Personas dependientes</label><input name="dependents" type="number" min="0" max="20" value="${esc(profile.dependents)}"></div></div>
          </section>
          <section class="pref-section"><div class="section-kicker">02 · Filosofía financiera</div><h3>¿Qué quieres conseguir?</h3><p>Define qué debe priorizar Borjai cuando haya que elegir entre seguridad, crecimiento y objetivos.</p><div class="pref-choice-grid">${renderCheckboxes("priorities", ["seguridad","crecimiento","vivienda","viajes","jubilacion","vehiculo","tranquilidad"], profile.priorities, {seguridad:"Seguridad financiera",crecimiento:"Construir patrimonio",vivienda:"Comprar vivienda",viajes:"Viajar",jubilacion:"Jubilarme antes",vehiculo:"Coche / moto",tranquilidad:"Tranquilidad financiera"})}</div><div class="form-grid pref-gap"><div class="form-field"><label>Prioridad principal</label><select name="philosophy"><option${profile.philosophy==="Seguridad financiera"?" selected":""}>Seguridad financiera</option><option${profile.philosophy==="Crecimiento patrimonial"?" selected":""}>Crecimiento patrimonial</option><option${profile.philosophy==="Equilibrio"?" selected":""}>Equilibrio</option><option${profile.philosophy==="Libertad financiera"?" selected":""}>Libertad financiera</option></select></div><div class="form-field"><label>Horizonte de inversión</label><select name="horizon">${["<1 año","1-3 años","3-5 años","5-10 años","+10 años"].map(v=>`<option${profile.horizon===v?" selected":""}>${v}</option>`).join("")}</select></div></div></section>
          <section class="pref-section"><div class="section-kicker">03 · Seguridad financiera</div><h3>Tu colchón de seguridad</h3><div class="form-grid"><div class="form-field"><label>Meses de emergencia</label><input name="emergency" type="number" min="1" max="24" value="${esc(profile.emergency)}"></div><div class="form-field"><label>Liquidez mínima intocable (€)</label><input name="minimumLiquidity" type="number" min="0" step="50" value="${esc(profile.minimumLiquidity)}"></div><label class="pref-toggle"><input type="checkbox" name="protectMinimum"${profile.protectMinimum?" checked":""}><span><strong>Proteger siempre este mínimo</strong><small>Borjai evitará recomendar inversiones que lo comprometan.</small></span></label><div class="form-field"><label>Aportación mensual (€)</label><input name="contribution" type="number" min="0" step="10" value="${esc(profile.contribution)}"></div><div class="form-field"><label>Objetivo de ahorro mensual (€)</label><input name="savingsTarget" type="number" min="0" step="10" value="${esc(profile.savingsTarget)}"></div></div></section>
          <section class="pref-section"><div class="section-kicker">04 · Inversión</div><h3>Cómo quieres invertir</h3><div class="form-grid"><div class="form-field"><label>Perfil de riesgo</label><select name="risk"><option${profile.risk==="Conservador"?" selected":""}>Conservador</option><option${profile.risk==="Moderado"?" selected":""}>Moderado</option><option${profile.risk==="Dinámico"?" selected":""}>Dinámico</option><option${profile.risk==="Agresivo"?" selected":""}>Agresivo</option></select></div></div><label class="pref-label">Productos que aceptas</label><div class="pref-choice-grid">${renderCheckboxes("investmentPreferences", ["ETFs","Fondos indexados","Acciones","Oro","Criptomonedas","Robo-advisor"], profile.investmentPreferences)}</div><label class="pref-label pref-danger-label">Activos que NO quieres que Borjai recomiende</label><div class="pref-choice-grid">${renderCheckboxes("excludedAssets", ["Bitcoin","Criptomonedas","Oro","Acciones individuales","Trading","Renta variable"], profile.excludedAssets)}</div></section>
          <section class="pref-section"><div class="section-kicker">05 · Alertas inteligentes</div><h3>Que Borjai te avise solo de lo importante</h3><div class="pref-choice-grid pref-alert-grid">${[["exceptional","Gasto excepcional"],["category","Categoría fuera de lo normal"],["recurring","Pago recurrente detectado"],["duplicate","Posible movimiento duplicado"],["lowBalance","Liquidez baja"],["investment","Oportunidad de inversión"],["goal","Objetivo en riesgo"],["wealthDrop","Caída relevante del patrimonio"]].map(([key,label])=>`<label class="pref-check"><input type="checkbox" name="alert_${key}"${alerts[key]?" checked":""}><span>${label}</span></label>`).join("")}</div><div class="form-grid pref-gap"><div class="form-field"><label>Avisar por gasto superior a (€)</label><input name="alertSpend" type="number" min="0" step="10" value="${esc(profile.alertSpend)}"></div><div class="form-field"><label>Avisar si gasto mensual supera (€)</label><input name="alertMonthlySpend" type="number" min="0" step="50" value="${esc(profile.alertMonthlySpend)}"></div></div></section>
          <section class="pref-section"><div class="section-kicker">06 · Personalidad de Borjai</div><h3>Cómo quieres que te hable</h3><div class="form-grid"><div class="form-field"><label>Estilo</label><select name="coachStyle"><option${profile.coachStyle==="Analítico"?" selected":""}>Analítico</option><option${profile.coachStyle==="Cercano"?" selected":""}>Cercano</option><option${profile.coachStyle==="Directo"?" selected":""}>Directo</option><option${profile.coachStyle==="Técnico"?" selected":""}>Técnico</option><option${profile.coachStyle==="Sin pelos en la lengua"?" selected":""}>Sin pelos en la lengua</option></select></div><div class="form-field"><label>Nivel de intervención</label><select name="coachIntervention"><option${profile.coachIntervention==="Observador"?" selected":""}>Observador</option><option${profile.coachIntervention==="Asesor"?" selected":""}>Asesor</option><option${profile.coachIntervention==="Proactivo"?" selected":""}>Proactivo</option></select></div></div><label class="pref-toggle"><input type="checkbox" name="coachChallenge"${profile.coachChallenge?" checked":""}><span><strong>Quiero que Borjai me contradiga</strong><small>Si una decisión financiera no encaja con tus reglas, te lo dirá claramente.</small></span></label></section>
          <section class="settings-backend advanced-persistence"><div><strong>Perfil sincronizado</strong><span>Se guarda de forma segura en tu cuenta Supabase y se aplica en tus dispositivos.</span></div></section>
        </div><footer class="modal-foot"><button type="button" class="btn" data-advanced-close>Cancelar</button><button class="btn btn-primary">Guardar perfil</button></footer>
      </form>
    </section>
  </div>`;
  root.querySelectorAll("[data-advanced-close]").forEach(node => node.addEventListener("click", e => { if (e.target === node || node.closest("button")) root.innerHTML = ""; }));
  root.querySelector("#advanced-settings-form").addEventListener("submit", async e => {
    e.preventDefault();
    const form = e.currentTarget, d = new FormData(form), selected = name => Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map(input => input.value);
    const next = mergeProfile({
      name: String(d.get("name") || "").trim(), age: Number(d.get("age") || 0) || "", employment: d.get("employment") || "", income: Number(d.get("income") || 0), payDay: Number(d.get("payDay") || 1), dependents: Number(d.get("dependents") || 0), risk: d.get("risk"), horizon: d.get("horizon"), philosophy: d.get("philosophy"), priorities: selected("priorities"), emergency: Number(d.get("emergency") || 3), minimumLiquidity: Number(d.get("minimumLiquidity") || 0), protectMinimum: form.elements.protectMinimum.checked, contribution: Number(d.get("contribution") || 0), savingsTarget: Number(d.get("savingsTarget") || 0), investmentPreferences: selected("investmentPreferences"), excludedAssets: selected("excludedAssets"), alertEnabled: Object.fromEntries(["exceptional","category","recurring","duplicate","lowBalance","investment","goal","wealthDrop"].map(key => [key, form.elements[`alert_${key}`].checked])), alertSpend: Number(d.get("alertSpend") || 0), alertMonthlySpend: Number(d.get("alertMonthlySpend") || 0), coachStyle: d.get("coachStyle"), coachChallenge: form.elements.coachChallenge.checked, coachIntervention: d.get("coachIntervention")
    });
    const button = form.querySelector(".btn-primary");
    button.disabled = true; button.textContent = "Guardando…";
    try {
      const { client, user } = await getProfile();
      const result = await client.auth.updateUser({ data: { ...(user.user_metadata || {}), [PROFILE_KEY]: next } });
      if (result.error) throw result.error;
      root.innerHTML = "";
      location.reload();
    } catch (error) {
      button.disabled = false; button.textContent = "Guardar perfil";
      const note = document.createElement("p"); note.className = "advanced-settings-error"; note.textContent = error.message || "No se pudo guardar el perfil."; form.querySelector(".modal-body").prepend(note);
    }
  });
}

async function showSettings() {
  try { const { profile } = await getProfile(); openModal(profile); }
  catch (error) { const fallback = mergeProfile({}); openModal(fallback); const note = document.createElement("p"); note.className = "advanced-settings-error"; note.textContent = error.message || "No se pudo cargar el perfil."; document.querySelector(".advanced-settings-body")?.prepend(note); }
}

document.addEventListener("click", event => {
  const trigger = event.target.closest?.('[data-action="open-settings"]');
  if (!trigger) return;
  event.preventDefault(); event.stopImmediatePropagation();
  showSettings();
}, true);
