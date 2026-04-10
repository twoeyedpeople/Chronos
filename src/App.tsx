import React, { useState, useEffect } from 'react';
import { Project, Task, ViewMode, MainViewMode } from './types';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import GanttView from './components/GanttView';
import ListView from './components/ListView';
import ShareModal from './components/ShareModal';
import { v4 as uuidv4 } from 'uuid';
import { format, parseISO, addBusinessDays, differenceInBusinessDays } from 'date-fns';
import AdminDashboard from './components/AdminDashboard';
import { doc, setDoc, onSnapshot, getDocFromServer, updateDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import firebaseConfig from '../firebase-applet-config.json';

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

function rollupTaskDates(tasks: Task[], parentId: string | null | undefined): Task[] {
  if (!parentId) return tasks;

  const children = tasks.filter((task) => task.parentId === parentId);
  const parent = tasks.find((task) => task.id === parentId);

  if (!parent) return tasks;

  if (children.length === 0) {
    return rollupTaskDates(
      tasks.filter((task) => task.id !== parentId),
      parent.parentId,
    );
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
    const canEdit = params.get('edit') === '1';
    setProjectId(pId);
    setIsReadOnly(Boolean(pId) && !canEdit);
    
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

    if (pId && isFirebaseConfigured) {
      const unsub = onSnapshot(doc(db, 'projects', pId), (docSnap) => {
        if (docSnap.exists()) {
          setProject(withProjectId(docSnap.data() as Partial<Project>, docSnap.id));
        } else {
          console.error(`Project ${pId} not found. Loading default project.`);
        }
        setIsLoading(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `projects/${pId}`);
        setIsLoading(false);
      });
      return () => unsub();
    } else {
      setIsLoading(false);
    }
  }, []);

  // Auto-save to local storage (and Firestore every 2 mins)
  useEffect(() => {
    if (projectId && !isReadOnly) {
      localStorage.setItem(`project_${projectId}`, JSON.stringify(project));
    }
  }, [project, projectId, isReadOnly]);

  // Autosave to Firestore every 2 minutes
  useEffect(() => {
    if (!projectId || !isFirebaseConfigured || isReadOnly) return;

    const interval = setInterval(async () => {
      console.log("Autosaving to Firestore...");
      try {
        await updateDoc(doc(db, 'projects', projectId), {
          ...project,
          updatedAt: Date.now()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
      }
    }, 2 * 60 * 1000); // 2 minutes

    return () => clearInterval(interval);
  }, [project, projectId, isReadOnly]);

  const addTask = (parentId: string | null = null) => {
    const newTask: Task = {
      id: uuidv4(),
      name: 'New Task',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(addBusinessDays(new Date(), 4), 'yyyy-MM-dd'),
      parentId,
    };
    setProject(prev => {
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
    setProject(prev => {
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
    setProject(prev => {
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
    setProject(prev => ({ ...prev, name, updatedAt: Date.now() }));
  };

  const updateClientName = (clientName: string) => {
    setProject(prev => ({ ...prev, clientName, updatedAt: Date.now() }));
  };

  const moveTask = (id: string, newParentId: string | null | undefined) => {
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

    setProject(prev => {
      const taskToMove = prev.tasks.find(t => t.id === id);
      const oldParentId = taskToMove?.parentId;
      
      let newTasks = prev.tasks.map(t => t.id === id ? { ...t, parentId: normalizedParentId } : t);

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

  const persistProject = async () => {
    if (!isFirebaseConfigured) {
      console.error("Firebase is not yet configured. Please set up Firebase to save your timeline.");
      return false;
    }
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'projects', projectId), { ...project, id: projectId });
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `projects/${projectId}`);
      return false;
    } finally {
      setIsSaving(false);
    }
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

  if (!projectId) {
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
