import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deleteApp, initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const conditionLabAppPath = path.resolve(projectRoot, "..", "condition-lab", "src", "App.jsx");
const appId = "basecamp_production";
const testTitle = "[TEST] Phase 3 Firebase Verification";
const verificationMemo = "Phase 3-1 integration verification";

const readConditionLabConfig = () => {
  const source = fs.readFileSync(conditionLabAppPath, "utf8");
  const match = source.match(/const MY_FIREBASE_CONFIG = \{([\s\S]*?)\};/);
  if (!match) {
    throw new Error("Condition Lab Firebase config was not found.");
  }

  const config = {};
  for (const line of match[1].split("\n")) {
    const field = line.match(/^\s*(\w+):\s*"([^"]*)"/);
    if (field) {
      config[field[1]] = field[2];
    }
  }

  for (const key of ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"]) {
    if (!config[key]) {
      throw new Error(`Firebase config field is missing: ${key}`);
    }
  }

  return config;
};

const maskValue = (value) => {
  if (!value) return "missing";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
};

const profilesPath = (namespace) => `artifacts/${namespace}/public/data/profiles`;
const programsPath = (namespace) => `artifacts/${namespace}/public/data/programs`;

const asText = (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

const profileDiagnostics = (snapshot) => {
  const result = {
    totalDocuments: 0,
    members: 0,
    trainers: 0,
    excludedOtherRole: 0,
    missingRole: 0,
    missingName: 0,
    phoneUsed: 0,
    contactFallback: 0,
    memoUsed: 0,
    noteFallback: 0,
    idMismatch: 0,
  };

  snapshot.forEach((item) => {
    const data = item.data();
    result.totalDocuments += 1;

    if (data.role === "member") result.members += 1;
    else if (data.role === "trainer") result.trainers += 1;
    else if (!data.role) result.missingRole += 1;
    else result.excludedOtherRole += 1;

    if (!asText(data.name)) result.missingName += 1;
    if (asText(data.phone)) result.phoneUsed += 1;
    if (!asText(data.phone) && asText(data.contact)) result.contactFallback += 1;
    if (asText(data.memo)) result.memoUsed += 1;
    if (!asText(data.memo) && asText(data.note)) result.noteFallback += 1;
    if (asText(data.id) && data.id !== item.id) result.idMismatch += 1;
  });

  return result;
};

const programPayload = (programId, title, favorite = false) => ({
  id: programId,
  schemaVersion: 1,
  title,
  category: "FULL_BODY",
  difficulty: "GENERAL",
  memo: verificationMemo,
  favorite,
  usageCount: 0,
  lastUsedAt: null,
  createdBy: null,
  updatedBy: null,
  isArchived: false,
  exercises: [
    { id: crypto.randomUUID(), name: "테스트 운동 A", sets: 3, memo: "", order: 1 },
    { id: crypto.randomUUID(), name: "테스트 운동 B", sets: 2, memo: "", order: 2 },
  ],
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

const assertProgramContract = (data) => {
  const forbiddenFields = ["kg", "reps", "contraction", "restTime", "memberId", "centerId"];
  const fields = Object.keys(data);
  const exerciseFields = Array.isArray(data.exercises)
    ? [...new Set(data.exercises.flatMap((exercise) => Object.keys(exercise)))]
    : [];

  return {
    hasExpectedFields: [
      "id",
      "schemaVersion",
      "title",
      "category",
      "difficulty",
      "memo",
      "favorite",
      "usageCount",
      "createdAt",
      "updatedAt",
      "lastUsedAt",
      "createdBy",
      "updatedBy",
      "isArchived",
      "exercises",
    ].every((field) => fields.includes(field)),
    createdAtIsTimestamp: data.createdAt instanceof Timestamp,
    updatedAtIsTimestamp: data.updatedAt instanceof Timestamp,
    usageCountIsZero: data.usageCount === 0,
    lastUsedAtIsNull: data.lastUsedAt === null,
    exerciseOrderSequential: Array.isArray(data.exercises)
      ? data.exercises.every((exercise, index) => exercise.order === index + 1)
      : false,
    forbiddenFieldsAbsent: forbiddenFields.every((field) => !fields.includes(field) && !exerciseFields.includes(field)),
    fields,
    exerciseFields,
  };
};

const onceProgramSnapshotIncludes = (db, documentId) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error("Timed out waiting for realtime program snapshot."));
    }, 10000);

    const unsubscribe = onSnapshot(
      collection(db, programsPath(appId)),
      (snapshot) => {
        if (snapshot.docs.some((item) => item.id === documentId)) {
          clearTimeout(timeout);
          unsubscribe();
          resolve(true);
        }
      },
      (error) => {
        clearTimeout(timeout);
        unsubscribe();
        reject(error);
      },
    );
  });

const main = async () => {
  const config = readConditionLabConfig();
  const firebaseApp = initializeApp(config);
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);
  const authResult = await signInAnonymously(auth);

  const profileSnapshot = await getDocs(collection(db, profilesPath(appId)));
  const profileStats = profileDiagnostics(profileSnapshot);

  const programsCollectionRef = collection(db, programsPath(appId));
  const createRef = doc(programsCollectionRef);
  await setDoc(createRef, programPayload(createRef.id, testTitle));
  await onceProgramSnapshotIncludes(db, createRef.id);
  const createdSnapshot = await getDoc(createRef);
  const createdData = createdSnapshot.data();

  await updateDoc(createRef, {
    title: `${testTitle} Updated`,
    memo: `${verificationMemo} updated`,
    favorite: true,
    updatedAt: serverTimestamp(),
  });
  await onceProgramSnapshotIncludes(db, createRef.id);
  const updatedSnapshot = await getDoc(createRef);
  const updatedData = updatedSnapshot.data();

  const duplicateTitle = `${testTitle} (복사)`;
  const duplicateRef = doc(programsCollectionRef);
  await setDoc(duplicateRef, programPayload(duplicateRef.id, duplicateTitle));
  const duplicateSnapshot = await getDoc(duplicateRef);
  const duplicateData = duplicateSnapshot.data();

  await updateDoc(createRef, { isArchived: true, updatedAt: serverTimestamp() });
  const archivedSnapshot = await getDoc(createRef);
  const archivedData = archivedSnapshot.data();

  await updateDoc(createRef, { isArchived: false, updatedAt: serverTimestamp() });
  const restoredSnapshot = await getDoc(createRef);
  const restoredData = restoredSnapshot.data();

  await updateDoc(createRef, { isArchived: true, updatedAt: serverTimestamp() });
  await updateDoc(duplicateRef, { isArchived: true, updatedAt: serverTimestamp() });

  const programSnapshot = await getDocs(programsCollectionRef);
  const testDocuments = programSnapshot.docs.filter((item) =>
    asText(item.data().title)?.startsWith("[TEST] Phase 3 Firebase Verification"),
  );

  const report = {
    firebaseEnvironment: {
      projectIdMasked: maskValue(config.projectId),
      authDomainMasked: maskValue(config.authDomain),
      namespace: appId,
      profilesPath: profilesPath(appId),
      programsPath: programsPath(appId),
    },
    auth: {
      anonymousSignIn: true,
      uidPresent: Boolean(authResult.user.uid),
      customTokenUsed: false,
    },
    profiles: profileStats,
    programs: {
      path: `${programsPath(appId)}/{programId}`,
      create: { success: createdSnapshot.exists(), idPresent: Boolean(createdData?.id) },
      read: { success: createdSnapshot.exists() },
      update: {
        success:
          updatedSnapshot.exists() &&
          updatedData?.title === `${testTitle} Updated` &&
          updatedData?.favorite === true,
      },
      duplicate: {
        success: duplicateSnapshot.exists(),
        titleRule: duplicateData?.title === duplicateTitle,
        distinctDocumentId: duplicateRef.id !== createRef.id,
        usageCountZero: duplicateData?.usageCount === 0,
        lastUsedAtNull: duplicateData?.lastUsedAt === null,
        isArchivedFalse: duplicateData?.isArchived === false,
      },
      archive: { success: archivedData?.isArchived === true },
      restore: { success: restoredData?.isArchived === false },
      realtime: { createReflected: true, updateReflected: true },
      fieldContract: assertProgramContract(createdData),
      cleanup: {
        policy: "Archived test documents; deleteDoc was not used.",
        archivedDocumentCount: testDocuments.filter((item) => item.data().isArchived === true).length,
        testDocumentCount: testDocuments.length,
      },
    },
  };

  console.log(JSON.stringify(report, null, 2));
  await deleteApp(firebaseApp);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
