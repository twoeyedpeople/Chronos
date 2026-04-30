import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Project, Task, ViewMode, MainViewMode } from './types';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import GanttView from './components/GanttView';
import ListView from './components/ListView';
import ShareModal from './components/ShareModal';
import { v4 as uuidv4 } from 'uuid';
import { format, parseISO, addBusinessDays, differenceInBusinessDays, differenceInDays, addDays, eachDayOfInterval, startOfDay } from 'date-fns';
import AdminDashboard from './components/AdminDashboard';
import { collection, doc, setDoc, onSnapshot, getDocFromServer, query, updateDoc, orderBy } from 'firebase/firestore';
import { db, auth } from './firebase';
import firebaseConfig from '../firebase-applet-config.json';
import { jsPDF } from 'jspdf';

const MAX_UNDO_STEPS = 100;
const GLOBAL_MILESTONES_ROUTE = 'milestones';
const GLOBAL_MILESTONES_ID = 'global-milestones';
const GLOBAL_MILESTONES_CLIENT = 'Agency Overview';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // We don't throw here to avoid crashing the whole app, but we log it clearly
}

function withProjectId(data: Partial<Project>, fallbackId: string): Project {
  return {
    ...DEFAULT_PROJECT,
    ...data,
    id: data.id ?? fallbackId,
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
  };
}

function cloneProject(project: Project): Project {
  return {
    ...project,
    tasks: project.tasks.map((task) => ({ ...task })),
  };
}

function getLocalProjectDraft(projectId: string): Project | null {
  const raw = localStorage.getItem(`project_${projectId}`);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Project;
  } catch (error) {
    console.error('Failed to parse local project draft', error);
    return null;
  }
}

function rollupTaskDates(tasks: Task[], parentId: string | null | undefined): Task[] {
  if (!parentId) return tasks;

  const children = tasks.filter((task) => task.parentId === parentId);
  const parent = tasks.find((task) => task.id === parentId);

  if (!parent) return tasks;

  if (children.length === 0) {
    // Keep the parent task intact when its last child is moved out or deleted.
    // This prevents structural actions like "unnest" from unexpectedly removing
    // the original parent row.
    return tasks;
  }

  const startDates = children.map((task) => parseISO(task.startDate).getTime());
  const endDates = children.map((task) => parseISO(task.endDate).getTime());
  const minStartStr = format(new Date(Math.min(...startDates)), 'yyyy-MM-dd');
  const maxEndStr = format(new Date(Math.max(...endDates)), 'yyyy-MM-dd');

  if (parent.startDate === minStartStr && parent.endDate === maxEndStr) {
    return tasks;
  }

  const updatedTasks = tasks.map((task) =>
    task.id === parentId ? { ...task, startDate: minStartStr, endDate: maxEndStr } : task,
  );

  return rollupTaskDates(updatedTasks, parent.parentId);
}

function buildGlobalMilestonesProject(projects: Project[]): Project {
  const milestones = projects
    .flatMap((project) =>
      project.tasks
        .filter((task) => task.isMilestone)
        .map((task) => ({
          ...task,
          id: `${project.id}::${task.id}`,
          parentId: null,
          dependencyId: undefined,
          dependencyType: undefined,
          startDate: task.startDate,
          endDate: task.startDate,
          sourceProjectId: project.id,
          sourceProjectName: project.name,
          sourceClientName: project.clientName,
          isMilestone: true,
        })),
    )
    .sort((a, b) => {
      const dateDiff = parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime();
      if (dateDiff !== 0) return dateDiff;

      const projectDiff = (a.sourceProjectName || '').localeCompare(b.sourceProjectName || '');
      if (projectDiff !== 0) return projectDiff;

      return a.name.localeCompare(b.name);
    });

  const updatedAt = projects.length > 0
    ? Math.max(...projects.map((project) => project.updatedAt))
    : Date.now();

  return {
    id: GLOBAL_MILESTONES_ID,
    name: 'Global Milestones',
    clientName: GLOBAL_MILESTONES_CLIENT,
    tasks: milestones,
    createdAt: updatedAt,
    updatedAt,
  };
}

const isFirebaseConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== 'MOCK_API_KEY';

const DEFAULT_PROJECT: Project = {
  id: uuidv4(),
  name: 'New Project Timeline',
  clientName: 'New Client',
  tasks: [
    {
      id: uuidv4(),
      name: 'Project Kickoff',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(addBusinessDays(new Date(), 1), 'yyyy-MM-dd'),
    },
    {
      id: uuidv4(),
      name: 'Design Phase',
      startDate: format(addBusinessDays(new Date(), 3), 'yyyy-MM-dd'),
      endDate: format(addBusinessDays(new Date(), 8), 'yyyy-MM-dd'),
    }
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export default function App() {
  const [project, setProject] = useState<Project>(DEFAULT_PROJECT);
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [mainViewMode, setMainViewMode] = useState<MainViewMode>('gantt');
  const [zoom, setZoom] = useState(1);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [undoStack, setUndoStack] = useState<Project[]>([]);
  const [isGlobalMilestonesView, setIsGlobalMilestonesView] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const projectRef = useRef(project);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  // Expand all parents when changing main view mode or zoom/view settings
  useEffect(() => {
    const parentIds = new Set(project.tasks.map(t => t.parentId).filter(Boolean) as string[]);
    setExpandedTasks(prev => {
      const next = new Set(prev);
      parentIds.forEach(id => next.add(id));
      return next;
    });
  }, [mainViewMode, viewMode, project.tasks.length]);

  const onToggleExpand = (id: string) => {
    const next = new Set(expandedTasks);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedTasks(next);
  };

  // Load project from URL if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pId = params.get('p');
    const globalView = params.get('global');
    const canEdit = params.get('edit') === '1';
    const showGlobalMilestones = globalView === GLOBAL_MILESTONES_ROUTE;

    setProjectId(showGlobalMilestones ? null : pId);
    setIsGlobalMilestonesView(showGlobalMilestones);
    setIsReadOnly(showGlobalMilestones || (Boolean(pId) && !canEdit));
    
    // Connection test
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
        }
      }
    };
    testConnection();

    if (showGlobalMilestones && isFirebaseConfigured) {
      const globalMilestonesQuery = query(collection(db, 'projects'), orderBy('updatedAt', 'desc'));
      const unsub = onSnapshot(globalMilestonesQuery, (snapshot) => {
        const projects = snapshot.docs.map((snapshotDoc) =>
          withProjectId(snapshotDoc.data() as Partial<Project>, snapshotDoc.id),
        );
        setProject(buildGlobalMilestonesProject(projects));
        setExpandedTasks(new Set());
        setUndoStack([]);
        setHasUnsavedChanges(false);
        setIsLoading(false);
      }, () => {
        setProject(buildGlobalMilestonesProject([]));
        setHasUnsavedChanges(false);
        setIsLoading(false);
      });
      return () => unsub();
    }

    if (pId && isFirebaseConfigured) {
      const unsub = onSnapshot(doc(db, 'projects', pId), (docSnap) => {
        if (docSnap.exists()) {
          const remoteProject = withProjectId(docSnap.data() as Partial<Project>, docSnap.id);
          setProject(remoteProject);
          setUndoStack([]);
          setHasUnsavedChanges(false);
        } else {
          const localDraft = getLocalProjectDraft(pId);
          if (localDraft) {
            const restoredProject = withProjectId(localDraft, pId);
            setProject(restoredProject);
            setUndoStack([]);
            setHasUnsavedChanges(true);
            console.warn(`Project ${pId} missing in Firebase. Restored local draft.`);
          } else {
            console.error(`Project ${pId} not found. Returning to dashboard.`);
            window.alert('This project could not be found in the cloud. Returning to the dashboard so we do not overwrite anything.');
            window.history.replaceState({}, '', `${window.location.origin}${window.location.pathname}`);
            setProjectId(null);
            setIsReadOnly(false);
            setIsGlobalMilestonesView(false);
            setProject(DEFAULT_PROJECT);
            setUndoStack([]);
            setHasUnsavedChanges(false);
          }
        }
        setIsLoading(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `projects/${pId}`);
        setIsLoading(false);
      });
      return () => unsub();
    } else {
      if (showGlobalMilestones) {
        setProject(buildGlobalMilestonesProject([]));
      }
      setIsLoading(false);
    }
  }, []);

  // Auto-save to local storage (and Firestore every 2 mins)
  useEffect(() => {
    if (projectId && !isReadOnly && !isLoading && project.id === projectId) {
      localStorage.setItem(`project_${projectId}`, JSON.stringify(project));
    }
  }, [project, projectId, isReadOnly, isLoading]);

  // Autosave unsaved changes to Firestore quickly so new projects survive refreshes.
  useEffect(() => {
    if (!projectId || !isFirebaseConfigured || isReadOnly || !hasUnsavedChanges) return;

    const timeout = window.setTimeout(async () => {
      try {
        await updateDoc(doc(db, 'projects', projectId), {
          ...projectRef.current,
          id: projectId,
          updatedAt: Date.now()
        });
        setHasUnsavedChanges(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
      }
    }, 1500);

    return () => clearTimeout(timeout);
  }, [project, projectId, isReadOnly, hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges || isReadOnly) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, isReadOnly]);

  const applyProjectChange = (updater: (prev: Project) => Project) => {
    if (isReadOnly) return;

    setProject((prev) => {
      const next = updater(prev);
      if (next === prev) return prev;

      setUndoStack((stack) => [cloneProject(prev), ...stack].slice(0, MAX_UNDO_STEPS));
      setHasUnsavedChanges(true);
      return next;
    });
  };

  const addTask = (parentId: string | null = null) => {
    const newTask: Task = {
      id: uuidv4(),
      name: 'New Task',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(addBusinessDays(new Date(), 4), 'yyyy-MM-dd'),
      parentId,
    };
    applyProjectChange((prev) => {
      let newTasks = [...prev.tasks, newTask];
      newTasks = rollupTaskDates(newTasks, parentId);

      return {
        ...prev,
        tasks: newTasks,
        updatedAt: Date.now()
      };
    });
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    applyProjectChange((prev) => {
      // Check for circular dependency if dependencyId is being updated
      if (updates.dependencyId) {
        const wouldBeCircular = (startId: string, targetId: string): boolean => {
          if (startId === targetId) return true;
          const targetTask = prev.tasks.find(t => t.id === targetId);
          if (!targetTask || !targetTask.dependencyId) return false;
          return wouldBeCircular(startId, targetTask.dependencyId);
        };
        if (wouldBeCircular(id, updates.dependencyId)) {
          console.warn('Circular dependency detected');
          return prev;
        }
      }

      let newTasks = prev.tasks.map(t => t.id === id ? { ...t, ...updates } : t);

      // Helper for cascading updates
      const cascade = (tasks: Task[], updatedId: string, visited = new Set<string>()): Task[] => {
        if (visited.has(updatedId)) return tasks;
        visited.add(updatedId);

        const parent = tasks.find(t => t.id === updatedId);
        if (!parent) return tasks;

        let currentTasks = [...tasks];
        const dependents = currentTasks.filter(t => t.dependencyId === updatedId);

        for (const dep of dependents) {
          const pEnd = parseISO(parent.endDate);
          const dStart = parseISO(dep.startDate);
          const dEnd = parseISO(dep.endDate);
          const duration = differenceInBusinessDays(dEnd, dStart);

          const newStart = addBusinessDays(pEnd, 1);
          const newEnd = addBusinessDays(newStart, duration);

          const newStartStr = format(newStart, 'yyyy-MM-dd');
          const newEndStr = format(newEnd, 'yyyy-MM-dd');

          if (dep.startDate !== newStartStr || dep.endDate !== newEndStr) {
            currentTasks = currentTasks.map(t => t.id === dep.id 
              ? { ...t, startDate: newStartStr, endDate: newEndStr } 
              : t
            );
            currentTasks = cascade(currentTasks, dep.id, visited);
          }
        }
        return currentTasks;
      };

      // Rollup logic: Update parent dates based on children
      // If dependencyId was just added/changed, or if dates changed, trigger cascade
      if (updates.dependencyId || updates.startDate || updates.endDate) {
        if (updates.dependencyId) {
          const parent = newTasks.find(t => t.id === updates.dependencyId);
          const task = newTasks.find(t => t.id === id);
          if (parent && task) {
            const pEnd = parseISO(parent.endDate);
            const dStart = parseISO(task.startDate);
            const dEnd = parseISO(task.endDate);
            const duration = differenceInBusinessDays(dEnd, dStart);
            const newStart = addBusinessDays(pEnd, 1);
            const newEnd = addBusinessDays(newStart, duration);
            
            newTasks = newTasks.map(t => t.id === id 
              ? { ...t, startDate: format(newStart, 'yyyy-MM-dd'), endDate: format(newEnd, 'yyyy-MM-dd') } 
              : t
            );
          }
        }
        newTasks = cascade(newTasks, id);
      }

      // Always check rollup for the task's parent and its ancestors
      const task = prev.tasks.find(t => t.id === id);
      if (task) {
        newTasks = rollupTaskDates(newTasks, task.parentId);
      }

      return {
        ...prev,
        tasks: newTasks,
        updatedAt: Date.now()
      };
    });
  };

  const deleteTask = (id: string) => {
    applyProjectChange((prev) => {
      const getDescendantIds = (parentId: string): string[] => {
        const children = prev.tasks.filter(t => t.parentId === parentId);
        return children.reduce((acc, child) => [...acc, child.id, ...getDescendantIds(child.id)], [] as string[]);
      };
      const deletedIds = new Set([id, ...getDescendantIds(id)]);
      
      let newTasks = prev.tasks
        .filter(t => !deletedIds.has(t.id))
        .map(t => t.dependencyId && deletedIds.has(t.dependencyId) ? { ...t, dependencyId: undefined } : t);

      const deletedTask = prev.tasks.find((task) => task.id === id);
      newTasks = rollupTaskDates(newTasks, deletedTask?.parentId);

      return {
        ...prev,
        tasks: newTasks,
        updatedAt: Date.now()
      };
    });
  };

  const updateProjectName = (name: string) => {
    applyProjectChange((prev) => ({ ...prev, name, updatedAt: Date.now() }));
  };

  const updateClientName = (clientName: string) => {
    applyProjectChange((prev) => ({ ...prev, clientName, updatedAt: Date.now() }));
  };

  const moveTask = (id: string, newParentId: string | null | undefined, insertBeforeId?: string) => {
    const normalizedParentId = newParentId === undefined ? null : newParentId;
    
    // Prevent moving a task to its own child
    const isChild = (parentId: string, targetId: string): boolean => {
      const children = project.tasks.filter(t => t.parentId === parentId);
      if (children.some(c => c.id === targetId)) return true;
      return children.some(c => isChild(c.id, targetId));
    };

    if (normalizedParentId && isChild(id, normalizedParentId)) {
      return;
    }

    applyProjectChange((prev) => {
      const taskToMove = prev.tasks.find(t => t.id === id);
      const oldParentId = taskToMove?.parentId;

      if (!taskToMove) return prev;

      let newTasks = [...prev.tasks];
      const activeIndex = newTasks.findIndex((task) => task.id === id);
      const [movedTask] = newTasks.splice(activeIndex, 1);
      const updatedTask = { ...movedTask, parentId: normalizedParentId };

      if (insertBeforeId && insertBeforeId !== id) {
        const targetIndex = newTasks.findIndex((task) => task.id === insertBeforeId);
        if (targetIndex >= 0) {
          newTasks.splice(targetIndex, 0, updatedTask);
        } else {
          newTasks.push(updatedTask);
        }
      } else {
        newTasks.push(updatedTask);
      }

      // Rollup for both old and new parents
      newTasks = rollupTaskDates(newTasks, oldParentId);
      newTasks = rollupTaskDates(newTasks, normalizedParentId);

      return {
        ...prev,
        tasks: newTasks,
        updatedAt: Date.now()
      };
    });
  };

  const handleUndo = () => {
    if (isReadOnly) return;

    setUndoStack((stack) => {
      const [previous, ...rest] = stack;
      if (!previous) return stack;
      setProject(cloneProject(previous));
      setHasUnsavedChanges(true);
      return rest;
    });
  };

  const persistProject = async () => {
    if (!projectId) {
      console.error('Cannot save project without a project id.');
      window.alert('This timeline could not be saved because the project ID is missing.');
      return false;
    }

    if (isLoading || projectRef.current.id !== projectId) {
      console.error('Project is not fully loaded yet.');
      window.alert('This timeline is still loading. Please wait a moment and try save/share again.');
      return false;
    }

    if (!isFirebaseConfigured) {
      console.error("Firebase is not yet configured. Please set up Firebase to save your timeline.");
      window.alert('Firebase is not configured, so this timeline cannot be saved yet.');
      return false;
    }
    setIsSaving(true);
    try {
      const projectToPersist = {
        ...projectRef.current,
        id: projectId,
        updatedAt: Date.now(),
      };

      await setDoc(doc(db, 'projects', projectId), projectToPersist);
      projectRef.current = projectToPersist;
      setProject(projectToPersist);
      setHasUnsavedChanges(false);
      localStorage.setItem(`project_${projectId}`, JSON.stringify(projectToPersist));
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `projects/${projectId}`);
      window.alert('Save failed. Your latest edits are still stored locally in this browser, but they did not reach the cloud.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleHome = async () => {
    if (!isReadOnly) {
      await persistProject();
    }

    window.history.pushState({}, '', `${window.location.origin}${window.location.pathname}`);
    setProjectId(null);
    setIsReadOnly(false);
    setIsGlobalMilestonesView(false);
    setIsShareOpen(false);
  };

  const handleSave = async () => {
    if (isReadOnly) return;
    await persistProject();
  };

  const handleShare = async () => {
    if (isReadOnly) return;
    const didSave = await persistProject();
    if (didSave) {
      setIsShareOpen(true);
    }
  };

  const getFlattenedTasks = (parentId: string | null = null, depth = 0): { task: Task; depth: number }[] => {
    const children = project.tasks.filter(t => (t.parentId || null) === parentId);
    let result: { task: Task; depth: number }[] = [];
    for (const task of children) {
      result.push({ task, depth });
      if (expandedTasks.has(task.id)) {
        result = [...result, ...getFlattenedTasks(task.id, depth + 1)];
      }
    }
    return result;
  };

  const flattenedTasks = getFlattenedTasks();
  const exportTasks = flattenedTasks.map(({ task, depth }, index) => ({ task, depth, index }));
  const exportRange = useMemo(() => {
    if (project.tasks.length === 0) return null;

    const taskTimes = project.tasks.flatMap((task) => [
      parseISO(task.startDate).getTime(),
      parseISO(task.endDate).getTime(),
    ]);
    const minDate = startOfDay(addDays(new Date(Math.min(...taskTimes)), -2));
    const maxDate = startOfDay(addDays(new Date(Math.max(...taskTimes)), 2));

    return {
      minDate,
      maxDate,
      days: eachDayOfInterval({ start: minDate, end: maxDate }),
    };
  }, [project.tasks]);

  const handleDownloadPdf = async () => {
    if (!exportRange) {
      window.alert('The PDF export is still getting ready. Please try again in a moment.');
      return;
    }

    try {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 26;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;
      const softBlue = [95, 124, 255] as const;
      const softPink = [255, 243, 252] as const;
      const softPinkAccent = [249, 168, 212] as const;
      const softBlueFill = [233, 238, 255] as const;

      const drawDiamond = (
        centerX: number,
        centerY: number,
        size: number,
        fill: readonly [number, number, number],
      ) => {
        const half = size / 2;
        const points = [
          [centerX, centerY - half],
          [centerX + half, centerY],
          [centerX, centerY + half],
          [centerX - half, centerY],
        ];

        pdf.setDrawColor(...fill);
        pdf.setFillColor(...fill);
        pdf.lines(
          [
            [half, half],
            [-half, half],
            [-half, -half],
            [half, -half],
          ],
          points[0][0],
          points[0][1],
          [1, 1],
          'F',
          true,
        );
      };

      const drawPageHeading = (subhead: string) => {
        pdf.setTextColor(17, 24, 39);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(24);
        pdf.text(project.name, margin, margin + 10);
        pdf.setTextColor(156, 163, 175);
        pdf.setFontSize(10);
        pdf.text(`${project.clientName.toUpperCase()} / ${subhead.toUpperCase()}`, margin, margin + 28);
      };

      const listTop = margin + 48;
      const rowCount = Math.max(exportTasks.length, 1);
      const listRowHeight = Math.max(12, Math.min(24, Math.floor((contentHeight - 42) / (rowCount + 1))));
      const listFontSize = Math.max(7, Math.min(11, listRowHeight - 3));
      const listColumns = isGlobalMilestonesView
        ? [
            { key: 'id', width: 42 },
            { key: 'task', width: contentWidth - 42 - 120 },
            { key: 'date', width: 120 },
          ]
        : [
            { key: 'id', width: 42 },
            { key: 'task', width: contentWidth - 42 - 120 - 70 - 120 },
            { key: 'start', width: 120 },
            { key: 'days', width: 70 },
            { key: 'end', width: 120 },
          ];

      drawPageHeading('List View');
      pdf.setDrawColor(229, 231, 235);
      pdf.setFillColor(249, 250, 251);
      pdf.roundedRect(margin, listTop, contentWidth, listRowHeight * (rowCount + 1), 12, 12, 'FD');

      let x = margin;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(156, 163, 175);
      listColumns.forEach((col) => {
        const label =
          col.key === 'id' ? 'ID' :
          col.key === 'task' ? (isGlobalMilestonesView ? 'PROJECT / MILESTONE' : 'TASK') :
          col.key === 'start' ? 'START' :
          col.key === 'days' ? 'DAYS' :
          'DATE';
        pdf.text(label, x + 8, listTop + listRowHeight * 0.68);
        x += col.width;
      });

      exportTasks.forEach(({ task, depth, index }, rowIndex) => {
        const y = listTop + listRowHeight * (rowIndex + 1);
        if (task.isExternal) {
          pdf.setFillColor(...softPink);
          pdf.roundedRect(margin + 1, y, contentWidth - 2, listRowHeight, 0, 0, 'F');
        } else {
          pdf.setFillColor(255, 255, 255);
          pdf.rect(margin + 1, y, contentWidth - 2, listRowHeight, 'F');
        }

        pdf.setDrawColor(243, 244, 246);
        pdf.line(margin, y, margin + contentWidth, y);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(listFontSize);
        pdf.setTextColor(55, 65, 81);

        let colX = margin;
        const taskLabel = isGlobalMilestonesView && task.sourceProjectName
          ? `${task.sourceProjectName} / ${task.name}`
          : task.name;
        const values = isGlobalMilestonesView
          ? [
              String(index + 1),
              taskLabel,
              format(parseISO(task.startDate), 'dd MMM yyyy'),
            ]
          : [
              String(index + 1),
              taskLabel,
              format(parseISO(task.startDate), 'dd MMM yyyy'),
              task.isMilestone ? '◆' : String(differenceInBusinessDays(parseISO(task.endDate), parseISO(task.startDate)) + 1),
              format(parseISO(task.endDate), 'dd MMM yyyy'),
            ];

        values.forEach((value, valueIndex) => {
          const col = listColumns[valueIndex];
          const textY = y + listRowHeight * 0.68;
          if (col.key === 'id' || col.key === 'days') {
            if (col.key === 'days' && task.isMilestone) {
              drawDiamond(
                colX + col.width / 2,
                y + listRowHeight / 2 + 0.5,
                Math.max(8, Math.min(11, listRowHeight - 5)),
                task.isExternal ? softPinkAccent : ([17, 24, 39] as const),
              );
            } else {
              pdf.text(value, colX + col.width / 2, textY, { align: 'center' });
            }
          } else if (col.key === 'task') {
            const indent = isGlobalMilestonesView ? 0 : depth * 10;
            pdf.text(pdf.splitTextToSize(value, col.width - 16 - indent), colX + 8 + indent, textY);
          } else {
            pdf.text(value, colX + 8, textY);
          }
          colX += col.width;
        });
      });

      const slug = `${project.clientName}-${project.name}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'timeline';

      pdf.save(`${slug}-timeline.pdf`);
    } catch (error) {
      console.error('PDF export failed', error);
      window.alert('The PDF export failed. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm font-medium text-gray-400 uppercase tracking-widest">Loading...</p>
        </div>
      </div>
    );
  }

  if (!projectId && !isGlobalMilestonesView) {
    return <AdminDashboard />;
  }

  const shareUrl = `${window.location.origin}${window.location.pathname}?p=${projectId}`;

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden font-sans selection:bg-blue-100 selection:text-blue-900">
      <Header 
        projectName={project.name}
        clientName={project.clientName}
        onProjectNameChange={updateProjectName}
        onClientNameChange={updateClientName}
        onSave={handleSave}
        onShare={handleShare}
        onHome={handleHome}
        onUndo={handleUndo}
        onDownloadPdf={handleDownloadPdf}
        canUndo={undoStack.length > 0}
        zoom={zoom}
        onZoomChange={setZoom}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        mainViewMode={mainViewMode}
        onMainViewModeChange={setMainViewMode}
        isSaving={isSaving}
        readOnly={isReadOnly}
      />

      <main className="flex-1 flex overflow-hidden">
        {mainViewMode === 'gantt' ? (
          <>
            <Sidebar 
              tasks={project.tasks}
              flattenedTasks={flattenedTasks}
              expandedTasks={expandedTasks}
              onToggleExpand={onToggleExpand}
              onAddTask={addTask}
              onUpdateTask={updateTask}
              onDeleteTask={deleteTask}
              onMoveTask={moveTask}
              readOnly={isReadOnly}
              showProjectName={isGlobalMilestonesView}
            />
            <GanttView 
              tasks={flattenedTasks.map(t => t.task)}
              allTasks={project.tasks}
              viewMode={viewMode}
              zoom={zoom}
              onUpdateTask={updateTask}
              readOnly={isReadOnly}
            />
          </>
        ) : (
          <ListView 
            tasks={project.tasks}
            expandedTasks={expandedTasks}
            onToggleExpand={onToggleExpand}
            onAddTask={addTask}
            onUpdateTask={updateTask}
            onDeleteTask={deleteTask}
            onMoveTask={moveTask}
            readOnly={isReadOnly}
            showProjectName={isGlobalMilestonesView}
          />
        )}
      </main>

      <ShareModal 
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        projectUrl={shareUrl}
      />

      {/* Subtle Background Accents */}
      <div className="fixed top-0 right-0 -z-10 w-[500px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-0 left-0 -z-10 w-[500px] h-[500px] bg-pink-500/5 blur-[120px] rounded-full pointer-events-none" />
    </div>
  );
}
