/* =========================
   POS Hotdogs - app.js (FULL)
   - Orden fijo de categorías
   - Carrito + promos
   - Cobro: abrir modal + confirmar guarda venta
========================= */

function el(id){ return document.getElementById(id); }

// ---------- Estado ----------
let PRODUCTS = [];
let PROMOS = [];
let CART = []; // {id,name,category,priceCents,qty,imgDataUrl}
let selectedPromoId = "";

// ---------- Util ----------
function fmt(cents){ return moneyFromCents(cents); }

function inputToCents(v){
  const n = Number(String(v || "0").replace(",", "."));
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

function todayKeys(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return {
    dateKey: `${yyyy}-${mm}-${dd}`,
    monthKey: `${yyyy}-${mm}`,
    createdAt: new Date().toISOString()
  };
}

// ---------- Reloj ----------
function startClock(){
  const clock = el("clock");
  if (!clock) return;
  const tick = ()=>{
    const d = new Date();
    const hh = String(d.getHours()).padStart(2,"0");
    const mm = String(d.getMinutes()).padStart(2,"0");
    clock.textContent = `${hh}:${mm}`;
  };
  tick();
  setInterval(tick, 10000);
}

// ---------- Modal ----------
function openPayModal(){
  const m = el("payModal");
  if (!m) return;
  m.classList.add("show");
  m.setAttribute("aria-hidden","false");
}
function closePayModal(){
  const m = el("payModal");
  if (!m) return;
  m.classList.remove("show");
  m.setAttribute("aria-hidden","true");
}

// ---------- Promos ----------
function isPromoAllowedToday(p){
  const days = p.days || [];
  if (!Array.isArray(days) || days.length === 0) return true;
  return days.includes(new Date().getDay()); // 0 dom ... 6 sab
}

function computeDiscountCents(subtotal){
  const promo = PROMOS.find(p =>
    String(p.id) === String(selectedPromoId) &&
    p.active &&
    isPromoAllowedToday(p)
  );
  if (!promo) return 0;

  if (promo.type === "amount_off"){
    return Math.min(promo.valueCents, subtotal);
  }
  if (promo.type === "fixed_total"){
    return subtotal > promo.valueCents ? (subtotal - promo.valueCents) : 0;
  }
  return 0;
}

async function loadPromos(){
  PROMOS = await DB.getAll("promos");
  const sel = el("promoSelect");
  const hint = el("promoHint");
  if (!sel) return;

  const active = PROMOS.filter(p => p.active && isPromoAllowedToday(p));

  sel.innerHTML = `<option value="">Sin promo</option>` + active.map(p=>{
    const label = p.type === "amount_off"
      ? `${p.name} (-${fmt(p.valueCents)})`
      : `${p.name} (Total ${fmt(p.valueCents)})`;
    return `<option value="${p.id}">${label}</option>`;
  }).join("");

  selectedPromoId = "";
  sel.value = "";

  if (hint){
    hint.textContent = active.length ? "Promos activas hoy." : "Activa promos por días en Admin.";
  }

  sel.onchange = ()=>{
    selectedPromoId = sel.value || "";
    renderTotals();
  };
}

// ---------- Categorías (ORDEN FIJO) ----------
const CATEGORY_ORDER = ["Hotdogs", "Snacks", "Bebidas", "Extras"];

function categoriesFromProducts(){
  const found = new Set(PRODUCTS.filter(p=>p.active).map(p=>p.category));
  const ordered = [];

  // Primero el orden que quieres
  for (const c of CATEGORY_ORDER){
    if (found.has(c)) ordered.push(c);
  }
  // Luego cualquier otra categoría nueva al final
  for (const c of found){
    if (!ordered.includes(c)) ordered.push(c);
  }
  return ordered;
}

function renderCategories(){
  const host = el("cats");
  if (!host) return;

  const cats = categoriesFromProducts();
  let current = host.getAttribute("data-current");

  if (!current || !cats.includes(current)){
    current = cats[0] || "";
  }
  host.setAttribute("data-current", current);

  host.innerHTML = cats.map(c=>{
    const active = c === current ? " active" : "";
    const count = PRODUCTS.filter(p=>p.active && p.category===c).length;
    return `
      <div class="cat${active}" data-cat="${c}">
        <div style="display:flex;flex-direction:column;gap:2px;">
          <div>${c}</div>
          <div class="count">${count} items</div>
        </div>
      </div>
    `;
  }).join("");

  host.querySelectorAll(".cat").forEach(btn=>{
    btn.onclick = ()=>{
      host.setAttribute("data-current", btn.dataset.cat);
      renderCategories();
      renderGrid();
    };
  });
}

// ---------- Productos ----------
function imgHTML(p){
  if (!p.imgDataUrl) return `<div class="prodImg">Sin foto</div>`;
  return `
    <div class="prodImg">
      <img
        src="${p.imgDataUrl}"
        alt="${p.name}"
        loading="lazy"
        onerror="this.onerror=null; this.style.display='none'; this.parentElement.textContent='Sin foto';"
      />
    </div>
  `;
}

function renderGrid(){
  const host = el("grid");
  const catsHost = el("cats");
  if (!host || !catsHost) return;

  const current = catsHost.getAttribute("data-current") || "";
  const list = PRODUCTS
    .filter(p=>p.active && (!current || p.category===current))
    .sort((a,b)=>a.name.localeCompare(b.name,"es"));

  host.innerHTML = list.map(p=>`
    <div class="cardProd" data-id="${p.id}">
      ${imgHTML(p)}
      <div class="prodBody">
        <div class="prodName">${p.name}</div>
        <div class="prodMeta">
          <div class="prodCat">${p.category}</div>
          <div class="prodPrice">${fmt(p.priceCents)}</div>
        </div>
      </div>
    </div>
  `).join("");

  host.querySelectorAll(".cardProd").forEach(card=>{
    card.onclick = ()=>{
      const p = PRODUCTS.find(x=>x.id===card.dataset.id);
      if (p) addToCart(p);
    };
  });
}

// ---------- Carrito ----------
function addToCart(p){
  const ex = CART.find(x=>x.id===p.id);
  if (ex) ex.qty += 1;
  else {
    CART.push({
      id: p.id,
      name: p.name,
      category: p.category,
      priceCents: p.priceCents,
      qty: 1,
      imgDataUrl: p.imgDataUrl || ""
    });
  }
  renderCart();
}

function cartSubtotalCents(){
  return CART.reduce((acc,it)=> acc + it.priceCents * it.qty, 0);
}

function cartTotals(){
  const subtotal = cartSubtotalCents();
  const discount = computeDiscountCents(subtotal);
  const total = Math.max(0, subtotal - discount);

  const promo = PROMOS.find(p =>
    String(p.id) === String(selectedPromoId) &&
    p.active &&
    isPromoAllowedToday(p)
  );

  return {
    subtotal,
    discount,
    total,
    promoName: promo ? promo.name : ""
  };
}

function renderTotals(){
  const { subtotal, discount, total } = cartTotals();
  const a = el("subtotal");
  const b = el("discount");
  const c = el("total");
  if (a) a.textContent = fmt(subtotal);
  if (b) b.textContent = fmt(discount);
  if (c) c.textContent = fmt(total);
}

function renderCart(){
  const host = el("cartList");
  if (!host) return;

  if (!CART.length){
    host.innerHTML = `<div class="smallnote">Agrega productos para iniciar.</div>`;
    renderTotals();
    return;
  }

  host.innerHTML = CART.map(it=>`
    <div class="item">
      <div>
        <div class="itemTitle">${it.name}</div>
        <div class="itemSub">${it.category} • ${fmt(it.priceCents)}</div>
      </div>

      <div class="itemRight">
        <div class="qty">
          <button data-dec="${it.id}">-</button>
          <div class="n">${it.qty}</div>
          <button data-inc="${it.id}">+</button>
        </div>

        <div class="lineTotal">${fmt(it.priceCents * it.qty)}</div>
        <button class="del" data-del="${it.id}">Quitar</button>
      </div>
    </div>
  `).join("");

  host.querySelectorAll("[data-inc]").forEach(b=>{
    b.onclick = ()=>{
      const it = CART.find(x=>x.id===b.dataset.inc);
      if (!it) return;
      it.qty += 1;
      renderCart();
    };
  });

  host.querySelectorAll("[data-dec]").forEach(b=>{
    b.onclick = ()=>{
      const it = CART.find(x=>x.id===b.dataset.dec);
      if (!it) return;
      it.qty -= 1;
      if (it.qty <= 0) CART = CART.filter(x=>x.id!==it.id);
      renderCart();
    };
  });

  host.querySelectorAll("[data-del]").forEach(b=>{
    b.onclick = ()=>{
      CART = CART.filter(x=>x.id!==b.dataset.del);
      renderCart();
    };
  });

  renderTotals();
}

// ---------- Guardar venta ----------
async function saveSale(paidCents){
  const { subtotal, discount, total, promoName } = cartTotals();
  const keys = todayKeys();

  const sale = {
    createdAt: keys.createdAt,
    dateKey: keys.dateKey,
    monthKey: keys.monthKey,

    promoName: promoName || "",

    subtotalCents: subtotal,
    discountCents: discount,
    totalCents: total,

    paidCents: paidCents,
    changeCents: Math.max(0, paidCents - total),

    items: CART.map(it=>({
      id: it.id,
      name: it.name,
      category: it.category,
      qty: it.qty,
      priceCents: it.priceCents,
      lineTotalCents: it.priceCents * it.qty
    }))
  };

  await DB.add("sales", sale);

  // limpiar carrito
  CART = [];
  selectedPromoId = "";
  const sel = el("promoSelect");
  if (sel) sel.value = "";

  renderCart();

  // limpiar modal inputs
  const payWith = el("payWith");
  const payChange = el("payChange");
  const payWith2 = el("payWith2"); // existe solo en tu versión 2 pasos
  if (payWith) payWith.value = "";
  if (payChange) payChange.value = "";
  if (payWith2) payWith2.value = "";

  closePayModal();
  alert("Cobro registrado ✅");
}

// ---------- Cobro (BOTÓN COBRAR + CONFIRMAR) ----------
function setupPay(){
  const btnPrepare = el("btnPrepare");      // COBRAR
  const btnClose = el("btnPayClose");       // cerrar modal
  const btnConfirm = el("btnConfirmPay");   // confirmar
  const payWith = el("payWith");            // input monto
  const payChange = el("payChange");        // input cambio (puede ser visible en paso 2)
  const payTotalText = el("payTotalText");  // texto total en modal

  // Vaciar
  const btnClear = el("btnClear");
  if (btnClear){
    btnClear.onclick = ()=>{
      if (!CART.length) return;
      if (!confirm("¿Vaciar el pedido?")) return;
      CART = [];
      selectedPromoId = "";
      const sel = el("promoSelect");
      if (sel) sel.value = "";
      renderCart();
    };
  }

  // Abrir modal al cobrar
  if (btnPrepare){
    btnPrepare.onclick = ()=>{
      if (!CART.length) return alert("Agrega productos para cobrar.");

      const { total } = cartTotals();
      if (payTotalText) payTotalText.textContent = fmt(total);

      // limpiar inputs
      if (payWith) payWith.value = "";
      if (payChange) payChange.value = "";

      openPayModal();
      setTimeout(()=> payWith?.focus(), 80);
    };
  }

  // Cerrar
  if (btnClose){
    btnClose.onclick = ()=> closePayModal();
  }

  // Cerrar tocando afuera
  const modal = el("payModal");
  if (modal){
    modal.addEventListener("click", (e)=>{
      if (e.target === modal) closePayModal();
    });
  }

  // Confirmar cobro (GUARDA)
  if (btnConfirm){
    btnConfirm.onclick = async ()=>{
      // si tu flujo 2 pasos lo deshabilitó, respetamos
      if (btnConfirm.disabled) return;

      const { total } = cartTotals();
      const paidCents = inputToCents(payWith?.value);

      if (paidCents < total){
        if (payChange) payChange.value = fmt(Math.abs(paidCents - total));
        return alert("El pago no alcanza. Ajusta el monto.");
      }

      if (payChange) payChange.value = fmt(Math.max(0, paidCents - total));

      try{
        await saveSale(paidCents);
      }catch(err){
        console.error(err);
        alert("Error guardando la venta. Revisa consola.");
      }
    };
  }
}

// ---------- Init ----------
(async function init(){
  await seedIfEmpty();

  startClock();

  PRODUCTS = await DB.getAll("products");
  await loadPromos();

  renderCategories();
  renderGrid();
  renderCart();
  renderTotals();

  setupPay();
})();
