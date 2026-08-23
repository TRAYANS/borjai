export const CATEGORIES = ["Vivienda","Alimentacion","Gasolina","Transporte","Ocio","Restaurantes","Compras","Suscripciones","Viajes","Salud","Seguros","Formacion","Tecnologia","Otros"];

function clean(n) {
  return String(n || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function iso(d) {
  return d.toISOString().slice(0, 10);
}

export function classify(text) {
  const n = clean(text);
  const rules = [["mercadona|carrefour|lidl|alcampo","Alimentacion"],["repsol|cepsa|shell","Gasolina"],["uber|cabify|renfe|metro","Transporte"],["netflix|spotify|icloud|adobe|youtube|hbo|disney","Suscripciones"],["alquiler|hipoteca|comunidad","Vivienda"],["zara|amazon|ikea|decathlon","Compras"],["restaurante|glovo|just eat|bar |cafe","Restaurantes"],["mapfre|mutua|adeslas|sanitas","Seguros"],["farmacia|dent|medic","Salud"]];
  const rule = rules.find(function(r) { return new RegExp(r[0]).test(n); });
  return rule ? rule[1] : "Otros";
}

export function parseNumber(v) {
  const s = String(v || "").replace(/[€\s]/g, "");
  const x = s.includes(",") && s.includes(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(",", ".");
  return Number(x);
}

export function csvLine(line, delim) {
  let out = [], v = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') { v += '"'; i++; }
      else q = !q;
    } else if (c === delim && !q) {
      out.push(v.trim());
      v = "";
    } else v += c;
  }
  out.push(v.trim());
  return out;
}

export function csvDate(v, fallbackDate) {
  const x = String(v || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(x)) return x;
  const m = x.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  return m ? (m[3].length === 2 ? "20" + m[3] : m[3]) + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0") : iso(fallbackDate || new Date());
}

export function parseCsv(text, file, defaultAccountId, fallbackDate) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(function(l) { return l.trim(); });
  if (lines.length < 2) throw new Error("El CSV necesita encabezados y al menos un movimiento.");
  const delim = lines[0].split(";").length > lines[0].split(",").length ? ";" : ",";
  const headers = csvLine(lines[0], delim).map(clean);
  const find = function(options) { return headers.findIndex(function(h) { return options.some(function(o) { return h.includes(o); }); }); };
  const d = find(["fecha","date","dia"]);
  const m = find(["concepto","descripcion","detalle","merchant","nombre"]);
  const a = find(["importe","amount","cantidad","valor","monto"]);
  const c = find(["categoria","category"]);
  if (a < 0 || m < 0) throw new Error("No encuentro columnas de concepto e importe. Usa fecha, concepto, importe y categoria.");
  return lines.slice(1).map(function(line) {
    const v = csvLine(line, delim);
    const amount = parseNumber(v[a]);
    const merchant = v[m] || "Movimiento importado";
    if (!Number.isFinite(amount)) return null;
    const category = c >= 0 && v[c] ? v[c] : classify(merchant);
    return {
      date: d >= 0 ? csvDate(v[d], fallbackDate) : iso(fallbackDate || new Date()),
      merchant: merchant,
      description: "Importado desde " + file,
      amount: amount,
      type: amount >= 0 ? "income" : "expense",
      category: CATEGORIES.includes(category) ? category : classify(merchant),
      accountId: defaultAccountId
    };
  }).filter(Boolean).slice(0, 500);
}
