import {
  collection,
  doc,
  getDoc,
  limit as firestoreLimit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { getFirestoreClient } from "../../../firebase/firestoreClient";
import { printHistoryCollectionPath, programsCollectionPath } from "../../../firebase/firestorePaths";
import type { Program } from "../../programs/types/program.types";
import { mapProgramDocument } from "../../programs/mappers/programMapper";
import { PrintRequestError } from "../domain/printRequest.errors";
import type { CreatePrintRequestInput, PrintRequestQueryOptions } from "../domain/printRequest.types";
import { mapPrintRequestDocument } from "../mappers/printRequestMapper";
import type { PrintRequestRepository } from "./printRequestRepository.interface";

const currentDb = () => getFirestoreClient();

const buildRecentQuery = (options: PrintRequestQueryOptions) => {
  const constraints: QueryConstraint[] = [where("isArchived", "==", false)];
  if (options.memberId) constraints.push(where("memberId", "==", options.memberId));
  if (options.programId) constraints.push(where("programId", "==", options.programId));
  if (options.category && options.category !== "ALL") {
    constraints.push(where("programSnapshot.category", "==", options.category));
  }
  constraints.push(orderBy("requestedAt", "desc"));
  constraints.push(firestoreLimit(options.limit ?? 100));
  return query(collection(currentDb(), printHistoryCollectionPath(options.appId)), ...constraints);
};

const validateProgramForRequest = (program: Program): void => {
  if (program.isArchived) throw new PrintRequestError("Archive된 프로그램은 인쇄 요청을 기록할 수 없습니다.");
  if (!program.title.trim()) throw new PrintRequestError("프로그램 제목이 없습니다.");
  if (program.exercises.length < 1 || program.exercises.length > 8) {
    throw new PrintRequestError("프로그램 운동 수가 올바르지 않습니다.");
  }
  if (program.exercises.some((exercise) => !exercise.name.trim() || exercise.order < 1)) {
    throw new PrintRequestError("프로그램 운동 정보가 올바르지 않습니다.");
  }
};

export const firestorePrintRequestRepository: PrintRequestRepository = {
  async createPrintRequest(input: CreatePrintRequestInput) {
    const db = currentDb();
    const requestRef = doc(collection(db, printHistoryCollectionPath(input.appId)));
    const programRef = doc(db, programsCollectionPath(input.appId), input.programSnapshot.programId);

    await runTransaction(db, async (transaction) => {
      const programSnapshot = await transaction.get(programRef);
      if (!programSnapshot.exists()) {
        throw new PrintRequestError("프로그램 문서를 찾지 못했습니다.");
      }

      const program = mapProgramDocument(programSnapshot.id, programSnapshot.data() as DocumentData);
      validateProgramForRequest(program);

      const requestedAt = serverTimestamp();
      transaction.set(requestRef, {
        id: requestRef.id,
        schemaVersion: 1,
        requestedAt,
        requestedBy: input.requestedBy,
        requestSource: "quick-print",
        status: "printed",
        workoutSessionId: input.workoutSessionId,
        printedAt: requestedAt,
        printedBy: input.requestedBy,
        printer: input.printer,
        copy: input.copy,
        memberId: input.memberSnapshot.memberId,
        programId: input.programSnapshot.programId,
        memberSnapshot: input.memberSnapshot,
        programSnapshot: input.programSnapshot,
        template: input.template,
        createdAt: requestedAt,
        createdBy: input.requestedBy,
        isArchived: false,
      });

      transaction.update(programRef, {
        usageCount: (program.usageCount ?? 0) + 1,
        lastUsedAt: requestedAt,
      });
    });

    return {
      id: requestRef.id,
      schemaVersion: 1,
      requestedAt: new Date(),
      requestedBy: input.requestedBy,
      requestSource: "quick-print",
      status: "printed",
      workoutSessionId: input.workoutSessionId,
      printedAt: new Date(),
      printedBy: input.requestedBy,
      printer: input.printer,
      copy: input.copy,
      memberId: input.memberSnapshot.memberId,
      programId: input.programSnapshot.programId,
      memberSnapshot: input.memberSnapshot,
      programSnapshot: input.programSnapshot,
      template: input.template,
      createdAt: new Date(),
      createdBy: input.requestedBy,
      isArchived: false,
    };
  },

  async getPrintRequests(appId, ids) {
    const snapshots = await Promise.all(ids.map((id) => getDoc(doc(currentDb(), printHistoryCollectionPath(appId), id))));
    return snapshots
      .filter((snapshot) => snapshot.exists())
      .map((snapshot) => mapPrintRequestDocument(snapshot.id, snapshot.data()));
  },

  subscribeRecentRequests(options, callback, onError) {
    return onSnapshot(
      buildRecentQuery(options),
      (snapshot) => callback(snapshot.docs.map((item) => mapPrintRequestDocument(item.id, item.data()))),
      (error) => onError(`${error.code}: ${error.message}`),
    );
  },

  subscribeMemberRequests(memberId, options, callback, onError) {
    return firestorePrintRequestRepository.subscribeRecentRequests({ ...options, memberId }, callback, onError);
  },

  subscribeProgramRequests(programId, options, callback, onError) {
    return firestorePrintRequestRepository.subscribeRecentRequests({ ...options, programId }, callback, onError);
  },

  async archivePrintRequest(appId, id) {
    await updateDoc(doc(currentDb(), printHistoryCollectionPath(appId), id), { isArchived: true });
  },
};
