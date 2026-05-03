import { useEffect, useCallback, useState } from 'react';
import { onSnapshot, query, where, orderBy, collection } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../../shared/firebase/collections';
import { useAppStore } from '../../../store';
import { createProject, updateProject, deleteProject } from '../services/projectService';
import type { Project } from '../../../shared/types';

function handleFirestoreListenerError(error: { code?: string; message: string }) {
  console.error('Firestore listener error:', error);
  if (error.code === 'failed-precondition') {
    console.warn('Missing Firestore index. Create it from Firebase console.');
  }
}

function mapProject(id: string, data: Record<string, unknown>): Project {
  return {
    id,
    organisationId: data.organisationId as string,
    name: data.name as string,
    acn: (data.acn as string) ?? '',
    bankDetails: (data.bankDetails as Project['bankDetails']) ?? {
      bankName: '', accountName: '', bsb: '', accountNumber: '',
    },
    createdBy: data.createdBy as string,
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    updatedAt: (data.updatedAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
  };
}

function mergeServerProjects(current: Project[], serverProjects: Project[], pendingIds: Set<string>): Project[] {
  const serverIds = new Set(serverProjects.map((project) => project.id));
  const pendingLocal = current.filter((project) => pendingIds.has(project.id) && !serverIds.has(project.id));
  return [...serverProjects, ...pendingLocal];
}

export function useProjects() {
  const { currentUser, projects, setProjects, selectedProject, setSelectedProject } = useAppStore();
  const organisationId = currentUser?.organisationId ?? '';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real-time listener
  useEffect(() => {
    if (!organisationId) {
      setProjects([]);
      setSelectedProject(null);
      setError(null);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.PROJECTS),
      where('organisationId', '==', organisationId),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const pendingIds = new Set(
          snap.docs.filter((d) => d.metadata.hasPendingWrites).map((d) => d.id)
        );
        const serverProjects = snap.docs
          .filter((d) => !d.metadata.hasPendingWrites)
          .map((d) => mapProject(d.id, d.data()));
        const currentProjects = useAppStore.getState().projects;
        setProjects(mergeServerProjects(currentProjects, serverProjects, pendingIds));
        setLoading(false);
      },
      (err) => {
        handleFirestoreListenerError(err);
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [organisationId, setProjects, setSelectedProject]);

  const create = useCallback(async (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!currentUser?.organisationId) {
      throw new Error('Cannot create project without an organisation.');
    }

    const projectData = {
      ...data,
      organisationId: currentUser.organisationId,
      createdBy: currentUser.uid,
    };

    console.log('Creating project with:', {
      organisationId: projectData.organisationId,
      userId: projectData.createdBy,
    });

    return createProject(projectData);
    // onSnapshot will update the store automatically
  }, [currentUser]);

  const update = useCallback(async (id: string, data: Partial<Omit<Project, 'id' | 'createdAt'>>) => {
    await updateProject(id, data);
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteProject(id);
    if (selectedProject?.id === id) setSelectedProject(null);
  }, [selectedProject, setSelectedProject]);

  return { projects, selectedProject, setSelectedProject, loading, error, create, update, remove };
}
