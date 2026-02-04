function el(id){ return document.getElementById(id); }
function money(cents){ return moneyFromCents(cents); }

function todayISO(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function thisMonthISO(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  return `${yyyy}-${mm}`;
}

// devuelve YYYY-Www compatible con <input type="week">
function isoWeekNow(){
  const d = new Date();
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1)/7);
  const yyyy = date.getUTCFullYear();
  const ww = String(weekNo).padStart(2,"0");
  return `${yyyy}-W${ww}`;
}

// Regresa rango de semana ISO: startKey inclusive, endKey exclusivo (YYYY-MM-DD)
function weekRangeFromISO(weekStr){
  const [yPart, wPart] = weekStr.split("-W");
  const year = Number(yPart);
  const week = Number(wPart);

  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay();
  const ISOweekStart = simple;
  if (dow <= 4) ISOweekStart.setUTCDate(simple.getUTCDate() - (dow || 7) + 1);
  else ISOweekStart.setUTCDate(simple.getUTCDate() + 8 - dow);

  const start = new Date(ISOweekStart);
  const end = new Date(ISOweekStart);
  end.setUTCDate(end.getUTCDate() + 7);

  const fmt = (dt)=>{
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth()+1).padStart(2,"0");
    const dd = String(dt.getUTCDate()).padStart(2,"0");
    return `${yyyy}-${mm}-${dd}`;
  };

  return { startKey: fmt(start), endKey: fmt(end) };
}

function groupByProduct(sales){
  const map = new Map();
  for (const s of sales){
    for (const it of (s.items || [])){
      const key = it.name;
      if (!map.has(key)) map.set(key, { name:key, qty:0, totalCents:0 });
      const row = map.get(key);
      row.qty += it.qty;
      row.totalCents += it.lineTotalCents;
    }
  }
  return [...map.values()].sort((a,b)=> b.totalCents - a.totalCents);
}

function renderByProduct(rows){
  const host = el("byProduct");
  if (rows.length === 0){
    host.innerHTML = `<div class="smallnote">Sin datos.</div>`;
    return;
  }

  let html = `<div class="table">
    <div class="trow head"><div>Producto</div><div class="right">Cantidad</div><div class="right">Total</div></div>
  `;
  for (const r of rows){
    html += `<div class="trow">
      <div>${r.name}</div>
      <div class="right">${r.qty}</div>
      <div class="right">${money(r.totalCents)}</div>
    </div>`;
  }
  html += `</div>`;
  host.innerHTML = html;
}

function renderSalesList(sales){
  const host = el("salesList");
  if (sales.length === 0){
    host.innerHTML = `<div class="smallnote">No hay ventas en este rango.</div>`;
    return;
  }

  let html = `<div class="table">
    <div class="trow head"><div>Hora</div><div class="right">Items</div><div class="right">Total</div></div>
  `;
  for (const s of sales.slice().sort((a,b)=> (a.createdAt||"").localeCompare(b.createdAt||""))){
    const t = new Date(s.createdAt);
    const hh = String(t.getHours()).padStart(2,"0");
    const mm = String(t.getMinutes()).padStart(2,"0");
    const items = (s.items||[]).reduce((acc,it)=>acc+it.qty,0);
    html += `<div class="trow">
      <div>${hh}:${mm} <span class="badge">${s.promoName ? ("Promo: "+s.promoName) : "Normal"}</span></div>
      <div class="right">${items}</div>
      <div class="right">${money(s.totalCents)}</div>
    </div>`;
  }
  html += `</div>`;
  host.innerHTML = html;
}

function setKPIs(sales){
  const total = sales.reduce((acc,s)=> acc + (s.totalCents||0), 0);
  el("kpiCount").textContent = String(sales.length);
  el("kpiTotal").textContent = money(total);
}

function downloadBlob(filename, blob){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}

function totalsSummary(sales){
  const sumSubtotal = sales.reduce((acc,s)=> acc + (s.subtotalCents||0), 0);
  const sumDiscount = sales.reduce((acc,s)=> acc + (s.discountCents||0), 0);
  const sumTotal    = sales.reduce((acc,s)=> acc + (s.totalCents||0), 0);
  return { count: sales.length, sumSubtotal, sumDiscount, sumTotal };
}

// arma string del pedido: "Choridoggo x1 @70.00 = 70.00 | Refresco x2 @15.00 = 30.00"
function pedidoDetalle(sale){
  const parts = [];
  for (const it of (sale.items || [])){
    const unit = (it.priceCents/100).toFixed(2);
    const line = (it.lineTotalCents/100).toFixed(2);
    parts.push(`${it.name} x${it.qty} @${unit} = ${line}`);
  }
  return parts.join(" | ");
}

function csvEscape(v){
  const s = String(v ?? "");
  // si trae comas, saltos o comillas, se encierra en ""
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
  return s;
}

/**
 * CSV tipo ticket:
 * - 1 fila por VENTA (pedido)
 * - Columna "pedido" con desglose de artículos
 * - SOLO 1 total por venta
 * - RESUMEN al final con TOTAL VENDIDO
 */
function toCSV(sales){
  const rows = [];
  rows.push(["fecha","hora","pedido","subtotal_venta","descuento_venta","total_venta","promo"].join(","));

  const ordered = sales.slice().sort((a,b)=> (a.createdAt||"").localeCompare(b.createdAt||""));

  for (const s of ordered){
    const d = new Date(s.createdAt);
    const hora = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;

    const pedido = pedidoDetalle(s);
    const promo = s.promoName || "";

    rows.push([
      csvEscape(s.dateKey),
      csvEscape(hora),
      csvEscape(pedido),
      ((s.subtotalCents||0)/100).toFixed(2),
      ((s.discountCents||0)/100).toFixed(2),
      ((s.totalCents||0)/100).toFixed(2),
      csvEscape(promo)
    ].join(","));
  }

  const { count, sumSubtotal, sumDiscount, sumTotal } = totalsSummary(sales);
  rows.push("");
  rows.push("RESUMEN,,,,,,");
  rows.push(`ventas_count,${count}`);
  rows.push(`subtotal_vendido,${(sumSubtotal/100).toFixed(2)}`);
  rows.push(`descuento_vendido,${(sumDiscount/100).toFixed(2)}`);
  rows.push(`total_vendido,${(sumTotal/100).toFixed(2)}`);

  return rows.join("\n");
}

let currentSales = [];

async function loadAndRenderByDay(dateKey){
  const all = await DB.getAll("sales");
  const sales = all.filter(s => s.dateKey === dateKey);
  currentSales = sales;

  el("rangeLabel").textContent = dateKey;
  setKPIs(sales);
  renderByProduct(groupByProduct(sales));
  renderSalesList(sales);
}

async function loadAndRenderByMonth(monthKey){
  const all = await DB.getAll("sales");
  const sales = all.filter(s => s.monthKey === monthKey);
  currentSales = sales;

  el("rangeLabel").textContent = monthKey;
  setKPIs(sales);
  renderByProduct(groupByProduct(sales));
  renderSalesList(sales);
}

async function loadAndRenderByWeek(weekStr){
  const all = await DB.getAll("sales");
  const { startKey, endKey } = weekRangeFromISO(weekStr);

  const sales = all.filter(s => s.dateKey >= startKey && s.dateKey < endKey);
  currentSales = sales;

  el("rangeLabel").textContent = `${weekStr} (${startKey} a ${endKey})`;
  setKPIs(sales);
  renderByProduct(groupByProduct(sales));
  renderSalesList(sales);
}

async function backupJSON(){
  const products = await DB.getAll("products");
  const promos = await DB.getAll("promos");
  const sales = await DB.getAll("sales");
  const payload = { exportedAt: new Date().toISOString(), products, promos, sales };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" });
  downloadBlob(`pos-respaldo-${Date.now()}.json`, blob);
}

async function init(){
  await seedIfEmpty();

  const d = todayISO();
  const m = thisMonthISO();
  const w = isoWeekNow();

  el("datePick").value = d;
  el("monthPick").value = m;
  el("weekPick").value = w;

  el("btnByDay").onclick = () => loadAndRenderByDay(el("datePick").value);
  el("btnByWeek").onclick = () => loadAndRenderByWeek(el("weekPick").value);
  el("btnByMonth").onclick = () => loadAndRenderByMonth(el("monthPick").value);

  el("btnExportCSV").onclick = () => {
    const label = el("rangeLabel").textContent.replace(/[^\w\-() ]/g, "_");
    const csv = toCSV(currentSales);
    downloadBlob(`ventas-${label}.csv`, new Blob([csv], {type:"text/csv"}));
  };

  el("btnBackupJSON").onclick = () => backupJSON();

  await loadAndRenderByDay(d);
}
init();
