const state = {
  products: [],
  promos: [],
  category: "Hotdogs",
  cart: new Map(), // id -> {product, qty}
  selectedPromoId: "none",
};

const CATS = ["Hotdogs", "Bebidas", "Snacks", "Extras", "Promos"];

function el(id){ return document.getElementById(id); }

function setClock(){
  const d = new Date();
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
  el("clock").textContent = `${hh}:${mm}`;
}
setInterval(setClock, 1000);

function catEmoji(cat){
  return ({Hotdogs:"🌭", Bebidas:"🥤", Snacks:"🍟", Extras:"➕", Promos:"🏷️"})[cat] || "📦";
}

function renderCats(){
  const wrap = el("cats");
  wrap.innerHTML = "";

  for (const cat of CATS){
    const count = state.products.filter(p => p.active && p.category === cat).length;
    const b = document.createElement("button");
    b.className = "cat" + (state.category === cat ? " active":"");
    b.innerHTML = `<span>${catEmoji(cat)}</span><span>${cat}</span><span class="count">${count}</span>`;
    b.onclick = () => { state.category = cat; renderCats(); renderGrid(); };
    wrap.appendChild(b);
  }
}

function renderGrid(){
  const grid = el("grid");
  grid.innerHTML = "";

  const list = state.products
    .filter(p => p.active && (state.category === "Promos" ? p.category === "Promos" : p.category === state.category))
    .sort((a,b)=>a.name.localeCompare(b.name, "es"));

  if (list.length === 0){
    const div = document.createElement("div");
    div.className = "smallnote";
    div.style.padding = "10px 2px";
    div.textContent = "No hay productos aquí. Ve a Admin para agregar.";
    grid.appendChild(div);
    return;
  }

  for (const p of list){
    const card = document.createElement("div");
    card.className = "cardProd";
    card.onclick = () => addToCart(p.id);

    const img = document.createElement("div");
    img.className = "prodImg";
    if (p.imgDataUrl){
      img.innerHTML = `<img alt="${p.name}" src="${p.imgDataUrl}">`;
    } else {
      img.textContent = catEmoji(p.category);
    }

    const body = document.createElement("div");
    body.className = "prodBody";
    body.innerHTML = `
      <div class="prodName">${escapeHtml(p.name)}</div>
      <div class="prodMeta">
        <div class="prodCat">${p.category}</div>
        <div class="prodPrice">${moneyFromCents(p.priceCents)}</div>
      </div>
    `;

    card.appendChild(img);
    card.appendChild(body);
    grid.appendChild(card);
  }
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, (m)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function addToCart(productId){
  const p = state.products.find(x=>x.id === productId);
  if (!p) return;

  const existing = state.cart.get(productId);
  if (existing) existing.qty += 1;
  else state.cart.set(productId, { product: p, qty: 1 });

  renderCart();
}

function decItem(productId){
  const it = state.cart.get(productId);
  if (!it) return;
  it.qty -= 1;
  if (it.qty <= 0) state.cart.delete(productId);
  renderCart();
}

function incItem(productId){
  const it = state.cart.get(productId);
  if (!it) return;
  it.qty += 1;
  renderCart();
}

function delItem(productId){
  state.cart.delete(productId);
  renderCart();
}

function promoAppliesToday(promo){
  const d = new Date().getDay(); // 0=Dom ... 6=Sab
  return Array.isArray(promo.days) ? promo.days.includes(d) : true;
}

function calcTotals(){
  let subtotal = 0;
  for (const it of state.cart.values()){
    subtotal += it.product.priceCents * it.qty;
  }

  let discount = 0;
  const promo = state.promos.find(p => String(p.id) === String(state.selectedPromoId));
  if (promo && promo.active && promoAppliesToday(promo)){
    if (promo.type === "amount_off"){
      discount = Math.min(subtotal, promo.valueCents);
    } else if (promo.type === "fixed_total"){
      if (subtotal >= promo.valueCents) discount = subtotal - promo.valueCents;
    }
  }

  const total = Math.max(0, subtotal - discount);
  return { subtotal, discount, total };
}

function renderCart(){
  const list = el("cartList");
  list.innerHTML = "";

  if (state.cart.size === 0){
    const div = document.createElement("div");
    div.className = "smallnote";
    div.style.padding = "10px 2px";
    div.textContent = "Sin productos. Toca algo del catálogo.";
    list.appendChild(div);
  } else {
    for (const [id, it] of state.cart.entries()){
      const lineTotal = it.product.priceCents * it.qty;

      const row = document.createElement("div");
      row.className = "item";
      row.innerHTML = `
        <div>
          <div class="itemTitle">${escapeHtml(it.product.name)}</div>
          <div class="itemSub">${it.product.category} • ${moneyFromCents(it.product.priceCents)} c/u</div>
        </div>
        <div class="itemRight">
          <div class="lineTotal">${moneyFromCents(lineTotal)}</div>
          <div class="qty">
            <button type="button" aria-label="menos">-</button>
            <div class="n">${it.qty}</div>
            <button type="button" aria-label="más">+</button>
            <button type="button" class="del" aria-label="borrar">Borrar</button>
          </div>
        </div>
      `;

      const btns = row.querySelectorAll("button");
      btns[0].onclick = () => decItem(id);
      btns[1].onclick = () => incItem(id);
      btns[2].onclick = () => delItem(id);

      list.appendChild(row);
    }
  }

  const { subtotal, discount, total } = calcTotals();
  el("subtotal").textContent = moneyFromCents(subtotal);
  el("discount").textContent = moneyFromCents(discount);
  el("total").textContent = moneyFromCents(total);

  el("btnPrepare").disabled = state.cart.size === 0;
}

function renderPromoSelect(){
  const sel = el("promoSelect");
  sel.innerHTML = "";

  const optNone = document.createElement("option");
  optNone.value = "none";
  optNone.textContent = "Sin promo";
  sel.appendChild(optNone);

  for (const p of state.promos){
    const opt = document.createElement("option");
    opt.value = String(p.id);
    const today = promoAppliesToday(p) ? " (hoy)" : " (no hoy)";
    const val = moneyFromCents(p.valueCents);
    const label = p.type === "amount_off" ? `-${val}` : `Total ${val}`;
    opt.textContent = `${p.name} • ${label}${today}`;
    sel.appendChild(opt);
  }

  sel.value = state.selectedPromoId;
  sel.onchange = () => {
    state.selectedPromoId = sel.value;
    renderCart();
  };
}

async function saveSale(){
  const { subtotal, discount, total } = calcTotals();
  if (state.cart.size === 0) return;

  const d = new Date();
  const keys = nowKeys(d);

  const items = [...state.cart.values()].map(it => ({
    productId: it.product.id,
    name: it.product.name,
    category: it.product.category,
    priceCents: it.product.priceCents,
    qty: it.qty,
    lineTotalCents: it.product.priceCents * it.qty
  }));

  const promo = state.promos.find(p => String(p.id) === String(state.selectedPromoId));
  const sale = {
    createdAt: d.toISOString(),
    dateKey: keys.dateKey,
    monthKey: keys.monthKey,
    items,
    subtotalCents: subtotal,
    discountCents: discount,
    totalCents: total,
    promoId: promo ? promo.id : null,
    promoName: promo ? promo.name : null,
  };

  await DB.add("sales", sale);

  state.cart.clear();
  state.selectedPromoId = "none";
  renderPromoSelect();
  renderCart();

  el("subtitle").textContent = `Guardado • ${keys.dateKey}`;
  setTimeout(()=> el("subtitle").textContent = "Local • Offline", 1800);
}

/* ===== MODAL COBRO + CAMBIO ===== */
function openPayModal(){
  const { total } = calcTotals();
  if (state.cart.size === 0) return;

  const modal = el("payModal");
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");

  el("payTotalText").textContent = `Total: ${moneyFromCents(total)}`;
  el("payWith").value = "";
  el("payChange").value = moneyFromCents(0);

  el("payWith").oninput = () => {
    const payCents = centsFromMoneyInput(el("payWith").value);
    const change = Math.max(0, payCents - total);
    el("payChange").value = moneyFromCents(change);
  };

  el("btnPayClose").onclick = closePayModal;

  el("btnConfirmPay").onclick = async () => {
    const payCents = centsFromMoneyInput(el("payWith").value);
    if (payCents < total){
      alert("El pago es menor al total.");
      return;
    }
    await saveSale();
    closePayModal();
  };

  setTimeout(()=> el("payWith").focus(), 50);
}

function closePayModal(){
  const modal = el("payModal");
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}
/* =============================== */

async function init(){
  await seedIfEmpty();
  state.products = (await DB.getAll("products")).filter(Boolean);
  state.promos = (await DB.getAll("promos")).filter(Boolean).sort((a,b)=> (a.id||0)-(b.id||0));

  renderCats();
  renderGrid();
  renderPromoSelect();
  renderCart();

  el("btnClear").onclick = () => { state.cart.clear(); renderCart(); };

  // Ahora el botón COBRAR abre el modal
  el("btnPrepare").onclick = () => openPayModal();

  setClock();
}
init();
