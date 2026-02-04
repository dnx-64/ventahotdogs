function el(id){ return document.getElementById(id); }

const DAYS = [
  { k:0, t:"Dom" }, { k:1, t:"Lun" }, { k:2, t:"Mar" }, { k:3, t:"Mié" },
  { k:4, t:"Jue" }, { k:5, t:"Vie" }, { k:6, t:"Sáb" },
];

// default: vie, sáb, dom
let daySet = new Set([5,6,0]);

function readFileAsDataURL(file){
  return new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function renderDaysPick(){
  const host = el("daysPick");
  host.innerHTML = "";
  for (const d of DAYS){
    const b = document.createElement("button");
    b.className = "day" + (daySet.has(d.k) ? " on":"");
    b.type = "button";
    b.textContent = d.t;
    b.onclick = () => {
      if (daySet.has(d.k)) daySet.delete(d.k); else daySet.add(d.k);
      renderDaysPick();
    };
    host.appendChild(b);
  }
}

async function resetDatabase(){
  const sure = confirm("¿Seguro? Esto borra TODO (productos, ventas, promos).");
  if (!sure) return;

  const sure2 = confirm("Confirmación final: ¿reiniciar la base desde cero?");
  if (!sure2) return;

  // Borra stores
  await DB.clear("sales");
  await DB.clear("promos");
  await DB.clear("products");

  // Vuelve a cargar lista base
  await seedIfEmpty();

  alert("Base reiniciada ✅");
  await refresh();
}

function renderProductsAdmin(products){
  const host = el("productsAdmin");
  if (products.length === 0){
    host.innerHTML = `<div class="smallnote">No hay productos.</div>`;
    return;
  }

  let html = `<div class="table">
    <div class="trow head"><div>Producto</div><div class="right">Precio</div><div class="right">Acciones</div></div>
  `;

  for (const p of products.sort((a,b)=>a.name.localeCompare(b.name,"es"))){
    html += `<div class="trow">
      <div>
        <div style="font-weight:950">${p.name}</div>
        <div class="mini">${p.category} • ${p.active ? "Activo":"Inactivo"}</div>
      </div>
      <div class="right">
        <input data-id="${p.id}" class="priceInput" type="number" step="0.01" value="${(p.priceCents/100).toFixed(2)}" />
      </div>
      <div class="right">
        <button class="btn ghost" data-act="${p.id}">${p.active ? "Desactivar":"Activar"}</button>
        <button class="btn ghost" data-edit="${p.id}">Editar</button>
      </div>
    </div>`;
  }
  html += `</div>`;
  host.innerHTML = html;

  host.querySelectorAll(".priceInput").forEach(inp=>{
    inp.addEventListener("change", async ()=>{
      const id = inp.getAttribute("data-id");
      const products2 = await DB.getAll("products");
      const p = products2.find(x=>x.id===id);
      if (!p) return;
      p.priceCents = centsFromMoneyInput(inp.value);
      await DB.put("products", p);
    });
  });

  host.querySelectorAll("button[data-act]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.getAttribute("data-act");
      const products2 = await DB.getAll("products");
      const p = products2.find(x=>x.id===id);
      if (!p) return;
      p.active = !p.active;
      await DB.put("products", p);
      await refresh();
    });
  });

  host.querySelectorAll("button[data-edit]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.getAttribute("data-edit");
      const products2 = await DB.getAll("products");
      const p = products2.find(x=>x.id===id);
      if (!p) return;

      const newName = prompt("Nuevo nombre:", p.name);
      if (newName === null) return;

      const newCat = prompt("Nueva categoría (Hotdogs/Bebidas/Snacks/Extras/Promos):", p.category);
      if (newCat === null) return;

      const wantPhoto = confirm("¿Quieres cambiar foto ahora?");
      if (wantPhoto){
        const inp = document.createElement("input");
        inp.type = "file";
        inp.accept = "image/*";
        inp.onchange = async () => {
          const file = inp.files && inp.files[0];
          if (!file) return;
          p.imgDataUrl = await readFileAsDataURL(file);
          p.name = newName.trim() || p.name;
          p.category = newCat.trim() || p.category;
          await DB.put("products", p);
          await refresh();
        };
        inp.click();
      } else {
        p.name = newName.trim() || p.name;
        p.category = newCat.trim() || p.category;
        await DB.put("products", p);
        await refresh();
      }
    });
  });
}

function renderPromosAdmin(promos){
  const host = el("promosAdmin");
  if (promos.length === 0){
    host.innerHTML = `<div class="smallnote">Aún no hay promos.</div>`;
    return;
  }

  let html = `<div class="table">
    <div class="trow head"><div>Promo</div><div class="right">Valor</div><div class="right">Acciones</div></div>
  `;
  for (const p of promos.sort((a,b)=>(a.id||0)-(b.id||0))){
    const val = moneyFromCents(p.valueCents);
    const label = p.type === "amount_off" ? `Descuento ${val}` : `Total ${val}`;
    const days = (p.days||[]).map(k=>DAYS.find(d=>d.k===k)?.t).filter(Boolean).join(", ") || "Siempre";
    html += `<div class="trow">
      <div>
        <div style="font-weight:950">${p.name}</div>
        <div class="mini">${label} • ${days} • ${p.active ? "Activa":"Inactiva"}</div>
      </div>
      <div class="right">${val}</div>
      <div class="right">
        <button class="btn ghost" data-tog="${p.id}">${p.active ? "Desactivar":"Activar"}</button>
        <button class="btn ghost" data-del="${p.id}">Borrar</button>
      </div>
    </div>`;
  }
  html += `</div>`;
  host.innerHTML = html;

  host.querySelectorAll("button[data-tog]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = Number(btn.getAttribute("data-tog"));
      const promos2 = await DB.getAll("promos");
      const p = promos2.find(x=>x.id===id);
      if (!p) return;
      p.active = !p.active;
      await DB.put("promos", p);
      await refresh();
    });
  });

  host.querySelectorAll("button[data-del]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = Number(btn.getAttribute("data-del"));
      if (!confirm("¿Borrar promo?")) return;
      await DB.delete("promos", id);
      await refresh();
    });
  });
}

async function addProduct(){
  const name = el("pName").value.trim();
  const priceCents = centsFromMoneyInput(el("pPrice").value);
  const category = el("pCat").value;
  const file = el("pImg").files && el("pImg").files[0];

  if (!name) return alert("Pon nombre.");
  if (priceCents <= 0) return alert("Pon precio válido.");

  const id = name.toLowerCase().replace(/\s+/g,"_").replace(/[^\w\-]/g,"") + "_" + Date.now();
  const imgDataUrl = file ? await readFileAsDataURL(file) : "";

  await DB.put("products", { id, name, category, priceCents, active:true, imgDataUrl });

  el("pName").value = "";
  el("pPrice").value = "";
  el("pImg").value = "";
  await refresh();
}

async function addPromo(){
  const name = el("prName").value.trim();
  const type = el("prType").value;
  const valueCents = centsFromMoneyInput(el("prValue").value);
  const days = [...daySet.values()].sort();

  if (!name) return alert("Pon nombre a la promo.");
  if (valueCents <= 0) return alert("Pon valor válido.");

  await DB.add("promos", {
    name,
    type,
    valueCents,
    days,
    active: true
  });

  el("prName").value = "";
  el("prValue").value = "";
  renderDaysPick();
  await refresh();
}

async function refresh(){
  await seedIfEmpty();
  const products = await DB.getAll("products");
  const promos = await DB.getAll("promos");
  renderProductsAdmin(products);
  renderPromosAdmin(promos);
}

async function init(){
  renderDaysPick();
  el("btnAddProduct").onclick = () => addProduct();
  el("btnAddPromo").onclick = () => addPromo();

  // RESET BASE
  el("btnResetDb").onclick = () => resetDatabase();

  await refresh();
}
init();
