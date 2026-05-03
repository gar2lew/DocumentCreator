import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from './config';

export const COLLECTIONS = {
  USERS: 'users',
  ORGANISATIONS: 'organisations',
  PROJECTS: 'projects',
  TEMPLATES: 'templates',
  TEMPLATE_VERSIONS: 'template_versions',
  DOCUMENTS_GENERATED: 'documents_generated',
} as const;

export const toDate = (ts: Timestamp | Date | undefined): Date => {
  if (!ts) return new Date();
  if (ts instanceof Timestamp) return ts.toDate();
  return ts;
};

export const fromDate = (d: Date): Timestamp => Timestamp.fromDate(d);

export {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  db,
};
export type { DocumentData, QueryConstraint };
