import { endpoints } from "../services/api";

const DB_NAME = "smart-water-map-offline";
const STORE = "reports";
const VERSION = 1;

export async function queueReport(report) {
  const db = await openDb();
  return requestToPromise(db.transaction(STORE, "readwrite").objectStore(STORE).add({
    ...report,
    queuedAt: new Date().toISOString()
  }));
}

export async function getQueuedReports() {
  const db = await openDb();
  return requestToPromise(db.transaction(STORE, "readonly").objectStore(STORE).getAll());
}

export async function syncQueuedReports() {
  const db = await openDb();
  const reports = await getQueuedReports();
  const synced = [];
  for (const report of reports) {
    const { id, queuedAt, ...payload } = report;
    await endpoints.communityReport({ ...payload, source: "OFFLINE_SYNC" });
    await requestToPromise(db.transaction(STORE, "readwrite").objectStore(STORE).delete(id));
    synced.push(id);
  }
  return synced;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

