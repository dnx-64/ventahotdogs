/* =========================
   Utilidades de dinero
========================= */
function centsFromMoneyInput(v){
  const n = Number(String(v || "0").replace(",", "."));
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}
function moneyFromCents(cents){
  return `$${(cents/100).toFixed(2)}`;
}

/* =========================
   IndexedDB helper
========================= */
const DB = {
  _db:null,

  async open(){
    if (this._db) return this._db;

    return new Promise((resolve, reject)=>{
      const req = indexedDB.open("pos_hotdogs_db", 1);
      req.onupgradeneeded = (e)=>{
        const db = e.target.result;
        if (!db.objectStoreNames.contains("products")){
          db.createObjectStore("products", { keyPath:"id" });
        }
        if (!db.objectStoreNames.contains("sales")){
          db.createObjectStore("sales", { keyPath:"id", autoIncrement:true });
        }
        if (!db.objectStoreNames.contains("promos")){
          db.createObjectStore("promos", { keyPath:"id", autoIncrement:true });
        }
      };
      req.onsuccess = ()=>{
        this._db = req.result;
        resolve(this._db);
      };
      req.onerror = ()=> reject(req.error);
    });
  },

  async tx(store, mode="readonly"){
    const db = await this.open();
    return db.transaction(store, mode).objectStore(store);
  },

  async getAll(store){
    const os = await this.tx(store);
    return new Promise((resolve,reject)=>{
      const r = os.getAll();
      r.onsuccess = ()=> resolve(r.result || []);
      r.onerror = ()=> reject(r.error);
    });
  },

  async put(store, value){
    const os = await this.tx(store,"readwrite");
    return new Promise((resolve,reject)=>{
      const r = os.put(value);
      r.onsuccess = ()=> resolve();
      r.onerror = ()=> reject(r.error);
    });
  },

  async add(store, value){
    const os = await this.tx(store,"readwrite");
    return new Promise((resolve,reject)=>{
      const r = os.add(value);
      r.onsuccess = ()=> resolve(r.result);
      r.onerror = ()=> reject(r.error);
    });
  },

  async delete(store, key){
    const os = await this.tx(store,"readwrite");
    return new Promise((resolve,reject)=>{
      const r = os.delete(key);
      r.onsuccess = ()=> resolve();
      r.onerror = ()=> reject(r.error);
    });
  },

  async clear(store){
    const os = await this.tx(store,"readwrite");
    return new Promise((resolve,reject)=>{
      const r = os.clear();
      r.onsuccess = ()=> resolve();
      r.onerror = ()=> reject(r.error);
    });
  }
};

/* =========================
   Datos base (con imágenes)
========================= */
async function seedIfEmpty(){
  const products = await DB.getAll("products");
  if (products.length > 0) return;

  const baseProducts = [
    /* ===== HOTDOGS ===== */
    {
      id: "choridoggo",
      name: "Choridoggo",
      category: "Hotdogs",
      priceCents: 7000,
      active: true,
      imgDataUrl: "assets/img/choridoggo.jpg"
    },
    {
      id: "hawaiano",
      name: "Hawaiano",
      category: "Hotdogs",
      priceCents: 7000,
      active: true,
      imgDataUrl: "assets/img/hawaiano.jpg"
    },
    {
      id: "al_pastor",
      name: "Al pastor",
      category: "Hotdogs",
      priceCents: 7000,
      active: true,
      imgDataUrl: "assets/img/al_pastor.jpg"
    },
    {
      id: "pizza_doggo",
      name: "Pizza Doggo",
      category: "Hotdogs",
      priceCents: 7000,
      active: true,
      imgDataUrl: "assets/img/pizza_doggo.jpg"
    },

    /* ===== SNACKS ===== */
    {
      id: "papas_francesa",
      name: "Papas a la francesa",
      category: "Snacks",
      priceCents: 4000,
      active: true,
      imgDataUrl: "assets/img/papas.jpg"
    },
    {
      id: "aros_cebolla",
      name: "Aros de cebolla",
      category: "Snacks",
      priceCents: 4000,
      active: true,
      imgDataUrl: "assets/img/aros.jpg"
    },

    /* ===== BEBIDAS ===== */
    {
      id: "refresco",
      name: "Refresco (general)",
      category: "Bebidas",
      priceCents: 1500,
      active: true,
      imgDataUrl: "assets/img/refresco.jpg"
    },

    /* ===== EXTRAS ===== */
    {
      id: "extra_tocino",
      name: "Extra tocino",
      category: "Extras",
      priceCents: 1000,
      active: true,
      imgDataUrl: "assets/img/tocino.jpg"
    }
  ];

  for (const p of baseProducts){
    await DB.put("products", p);
  }
}
