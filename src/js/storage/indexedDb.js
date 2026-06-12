const DB_NAME = "gestor_turnos_enfermeria";
const DB_VERSION = 1;
const STORE = "appState";
const STATE_KEY = "current";

export function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadState() {
  const db = await openDb();
  return tx(db, "readonly", (store) => store.get(STATE_KEY));
}

export async function saveState(state) {
  const db = await openDb();
  const payload = structuredClone(state);
  payload.updatedAt = new Date().toISOString();
  return tx(db, "readwrite", (store) => store.put(payload, STATE_KEY));
}

export async function exportDatabaseSnapshot(stateFallback = null) {
  const db = await openDb();
  const stores = {};
  for (const storeName of Array.from(db.objectStoreNames)) {
    stores[storeName] = await readStore(db, storeName);
  }
  if (stateFallback && !stores[STORE]?.some((entry) => entry.key === STATE_KEY)) {
    stores[STORE] = [{ key: STATE_KEY, value: structuredClone(stateFallback) }];
  }
  return {
    databaseName: DB_NAME,
    databaseVersion: DB_VERSION,
    exportedStores: Object.keys(stores),
    stores,
  };
}

export async function clearState() {
  const db = await openDb();
  return tx(db, "readwrite", (store) => store.delete(STATE_KEY));
}

function tx(db, mode, operation) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    const request = operation(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readStore(db, storeName) {
  const transaction = db.transaction(storeName, "readonly");
  const store = transaction.objectStore(storeName);
  const [keys, values] = await Promise.all([
    requestToPromise(store.getAllKeys()),
    requestToPromise(store.getAll()),
  ]);
  return keys.map((key, index) => ({ key, value: values[index] }));
}
