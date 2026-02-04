// IndexedDB helper (sin librerías)
const DB_NAME = "pos_hotdogs_db";
const DB_VER = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains("products")) {
        const s = db.createObjectStore("products", { keyPath: "id" });
        s.createIndex("byCategory", "category", { unique: false });
        s.createIndex("byActive", "active", { unique: false });
      }

      if (!db.objectStoreNames.contains("sales")) {
        const s = db.createObjectStore("sales", { keyPath: "id", autoIncrement: true });
        s.createIndex("byDate", "dateKey", { unique: false }); // YYYY-MM-DD
        s.createIndex("byMonth", "monthKey", { unique: false }); // YYYY-MM
      }

      if (!db.objectStoreNames.contains("promos")) {
        const s = db.createObjectStore("promos", { keyPath: "id", autoIncrement: true });
        s.createIndex("byActive", "active", { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(storeName, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const store = t.objectStore(storeName);
    const out = fn(store);
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
  });
}

const DB = {
  async getAll(store) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, "readonly");
      const s = t.objectStore(store);
      const req = s.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },
  async put(store, value) {
    return tx(store, "readwrite", (s) => s.put(value));
  },
  async add(store, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, "readwrite");
      const s = t.objectStore(store);
      const req = s.add(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async delete(store, key) {
    return tx(store, "readwrite", (s) => s.delete(key));
  },
  async clear(store) {
    return tx(store, "readwrite", (s) => s.clear());
  }
};

// util
function moneyFromCents(cents) {
  const mx = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
  return mx.format((cents || 0) / 100);
}
function centsFromMoneyInput(v) {
  const n = Number.parseFloat(String(v || "").replace(",", "."));
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}
function nowKeys(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return { dateKey: `${yyyy}-${mm}-${dd}`, monthKey: `${yyyy}-${mm}` };
}

async function seedIfEmpty() {
  const products = await DB.getAll("products");
  if (products.length > 0) return;

  // LISTA NUEVA (lo que te pidieron)
  const defaults = [
    // Hotdogs $70
    { id: "choridoggo", name: "Choridoggo",  category: "Hotdogs", priceCents: 7000, active: true, imgDataUrl: "" },
    { id: "hawaiano",   name: "Hawaiano",    category: "Hotdogs", priceCents: 7000, active: true, imgDataUrl: "" },
    { id: "pastor",     name: "Al pastor",   category: "Hotdogs", priceCents: 7000, active: true, imgDataUrl: "" },
    { id: "pizzadoggo", name: "Pizza Doggo", category: "Hotdogs", priceCents: 7000, active: true, imgDataUrl: "" },

    // Snacks $40
    { id: "papas",      name: "Papas a la francesa", category: "Snacks", priceCents: 4000, active: true, imgDataUrl: "" },
    { id: "aros",       name: "Aros de cebolla",     category: "Snacks", priceCents: 4000, active: true, imgDataUrl: "" },

    // Refresco general $15
    { id: "refresco",   name: "Refresco (general)",  category: "Bebidas", priceCents: 1500, active: true, imgDataUrl: "" }
  ];

  for (const p of defaults) await DB.put("products", p);
}
