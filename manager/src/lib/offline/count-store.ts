const DATABASE_NAME = "wild-bean-manager-offline";
const STORE_NAME = "count-observations";
const ASSIGNMENT_STORE_NAME = "count-assignments";
const DATABASE_VERSION = 2;
const DEVICE_KEY = "wild-bean-manager-device-id";

export interface OfflineCountObservation {
  clientObservationId: string;
  deviceId: string;
  sequenceNumber: number;
  countSessionId: string;
  countSectionId: string;
  countLineId: string;
  countedQuantity: string;
  uomId: string;
  observedAt: string;
  syncStatus: "pending" | "synced" | "conflict";
}

export interface CachedCountAssignment {
  id: string;
  sessionId: string;
  name: string;
  status: string;
  cachedAt: string;
  expiresAt: string;
  lines: {
    id: string;
    productId: string;
    productName: string;
    productSku: string;
    uomId: string;
    unitName: string;
    unitSymbol: string;
    lineNumber: number;
  }[];
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: "clientObservationId",
        });
        store.createIndex("syncStatus", "syncStatus");
        store.createIndex("countSectionId", "countSectionId");
      }
      if (!database.objectStoreNames.contains(ASSIGNMENT_STORE_NAME)) {
        database.createObjectStore(ASSIGNMENT_STORE_NAME, {
          keyPath: "id",
        });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function cacheCountAssignments(
  assignments: Omit<CachedCountAssignment, "cachedAt" | "expiresAt">[],
): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(
      ASSIGNMENT_STORE_NAME,
      "readwrite",
    );
    const store = transaction.objectStore(ASSIGNMENT_STORE_NAME);
    store.clear();
    const cachedAt = new Date();
    const expiresAt = new Date(cachedAt.getTime() + 12 * 60 * 60 * 1_000);
    for (const assignment of assignments) {
      store.put({
        ...assignment,
        cachedAt: cachedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      });
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function listCachedCountAssignments(): Promise<
  CachedCountAssignment[]
> {
  const database = await openDatabase();
  try {
    const request = database
      .transaction(ASSIGNMENT_STORE_NAME, "readonly")
      .objectStore(ASSIGNMENT_STORE_NAME)
      .getAll() as IDBRequest<CachedCountAssignment[]>;
    const assignments = await requestResult(request);
    const now = Date.now();
    return assignments.filter(
      (assignment) => Date.parse(assignment.expiresAt) > now,
    );
  } finally {
    database.close();
  }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function getCountDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY, created);
  return created;
}

export async function nextObservationSequence(
  deviceId: string,
): Promise<number> {
  const observations = await listOfflineCountObservations();
  return (
    Math.max(
      0,
      ...observations
        .filter((observation) => observation.deviceId === deviceId)
        .map((observation) => observation.sequenceNumber),
    ) + 1
  );
}

export async function saveOfflineCountObservation(
  observation: OfflineCountObservation,
): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(observation);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function listOfflineCountObservations(): Promise<
  OfflineCountObservation[]
> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction
      .objectStore(STORE_NAME)
      .getAll() as IDBRequest<OfflineCountObservation[]>;
    return await requestResult(request);
  } finally {
    database.close();
  }
}

export async function markObservationSyncStatus(
  clientObservationId: string,
  syncStatus: OfflineCountObservation["syncStatus"],
): Promise<void> {
  const observations = await listOfflineCountObservations();
  const observation = observations.find(
    (item) => item.clientObservationId === clientObservationId,
  );
  if (!observation) return;
  await saveOfflineCountObservation({ ...observation, syncStatus });
}

export async function purgeSyncedCountObservations(): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const observations = (await requestResult(
      store.getAll(),
    )) as OfflineCountObservation[];
    for (const observation of observations) {
      if (observation.syncStatus === "synced") {
        store.delete(observation.clientObservationId);
      }
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}
