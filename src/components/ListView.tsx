import React, { useState, useMemo, useEffect } from 'react';
import { Task } from '../types';
import { format, parseISO, addBusinessDays, differenceInBusinessDays, isWeekend, startOfDay, addDays } from 'date-fns';
import { Calendar, Trash2, Plus, ChevronRight, ChevronDown, GripVertical, FolderMinus } from 'lucide-react';
import {
  DndContext,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableTaskRowProps {
  task: Task;
  index: number;
  depth: number;
  hasSubtasks: boolean;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onAddTask: (parentId?: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  isOver?: boolean;
  tasks: Task[];
  readOnly?: boolean;
}

const SortableTaskRow: React.FC<SortableTaskRowProps> = ({
  task,
  index,
  depth,
  hasSubtasks,
  isExpanded,
  onToggleExpand,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  isOver,
  tasks,
  readOnly
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: readOnly });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const days = task.isMilestone ? 0 : differenceInBusinessDays(parseISO(task.endDate), parseISO(task.startDate)) + 1;
  const [daysInput, setDaysInput] = useState(String(days));

  useEffect(() => {
    setDaysInput(String(days));
  }, [days]);

  const isFolder = hasSubtasks;

  const handleDaysChange = (val: string) => {
    if (val === '') {
      setDaysInput('');
      return;
    }

    if (!/^\d+$/.test(val)) {
      return;
    }

    setDaysInput(val);
  };

  const commitDaysChange = () => {
    const numDays = parseInt(daysInput, 10);
    if (Number.isNaN(numDays) || numDays < 0) {
      setDaysInput(String(days));
      return;
    }

    if (numDays === 0) {
      onUpdateTask(task.id, {
        endDate: task.startDate,
        isMilestone: true,
      });
      return;
    }

    const newEndDate = format(addBusinessDays(parseISO(task.startDate), numDays - 1), 'yyyy-MM-dd');
    onUpdateTask(task.id, { endDate: newEndDate, isMilestone: false });
  };

  const handleDependencyChange = (val: string) => {
    if (val.trim() === '') {
      onUpdateTask(task.id, { dependencyId: undefined });
      return;
    }
    const targetIndex = parseInt(val) - 1;
    if (!isNaN(targetIndex) && targetIndex >= 0 && targetIndex < tasks.length) {
      const targetTask = tasks[targetIndex];
      if (targetTask.id !== task.id) {
        onUpdateTask(task.id, { dependencyId: targetTask.id, dependencyType: 'FS' });
      }
    }
  };

  const dependencyIndex = task.dependencyId 
    ? tasks.findIndex(t => t.id === task.dependencyId) + 1 
    : '';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center h-10 border-b border-gray-100 px-4 transition-all ${
        isDragging ? 'opacity-50 bg-blue-50/50 z-50' : task.isExternal ? 'bg-[#FFF3FC] hover:bg-[#ffedf9]' : 'bg-white hover:bg-gray-50/80'
      } ${isOver ? 'bg-blue-100/50 ring-2 ring-blue-500/20' : ''}`}
    >
      <div className="w-8 shrink-0 flex items-center justify-center">
        <div 
          {...attributes} 
          {...listeners}
          className="p-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing rounded transition-colors shrink-0"
        >
          <GripVertical size={12} />
        </div>
      </div>

      <div className="w-8 text-[9px] font-black text-gray-300 shrink-0 text-center">
        {index + 1}
      </div>

      <div className="flex-1 flex items-center gap-1.5 min-w-0" style={{ paddingLeft: `${depth * 16 + 4}px` }}>
        {hasSubtasks ? (
          <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 shrink-0 border border-blue-100">
            <button
              onClick={() => onToggleExpand(task.id)}
              className="p-0.5 hover:bg-blue-100 rounded transition-colors"
            >
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          </div>
        ) : (
          <div className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${
            task.isExternal ? 'border-pink-100 text-pink-300' : 'border-blue-100 text-[#5F7CFF]'
          }`}>
            <div className={`w-1 h-1 rounded-full ${task.isExternal ? 'bg-[#FFF3FC] ring-2 ring-pink-200' : 'bg-[#5F7CFF]'}`} />
          </div>
        )}
        <input
          type="text"
          value={task.name}
          onChange={(e) => onUpdateTask(task.id, { name: e.target.value })}
          readOnly={readOnly}
          className={`bg-transparent border-none focus:ring-0 text-[13px] w-full truncate p-0 ${isFolder ? 'font-black text-gray-900 uppercase tracking-tight' : 'font-bold text-gray-800'}`}
          placeholder={isFolder ? "Folder name..." : "Task name..."}
        />
        {!isFolder && !readOnly && (
          <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black text-gray-400 uppercase tracking-widest shrink-0">
            <input
              type="checkbox"
              checked={Boolean(task.isExternal)}
              onChange={(e) => onUpdateTask(task.id, { isExternal: e.target.checked })}
              disabled={readOnly}
              className="w-3 h-3 rounded border-gray-200 accent-pink-300"
            />
            <span>EXT</span>
          </label>
        )}
        {!readOnly && (
          <button
            onClick={() => onAddTask(task.id)}
            className="p-1 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded transition-all opacity-0 group-hover:opacity-100 shrink-0"
            title="Add subtask"
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {!isFolder ? (
        <>
          <div className="w-32 px-2 shrink-0">
              <input
                type="date"
                value={task.startDate}
                onChange={(e) => onUpdateTask(task.id, {
                  startDate: e.target.value,
                  ...(task.isMilestone ? { endDate: e.target.value } : {}),
                })}
                disabled={readOnly}
                className="text-[11px] bg-white border border-gray-100 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500/10 outline-none text-gray-600 font-bold w-full"
              />
          </div>

          <div className="w-20 px-2 shrink-0">
            <div className="relative">
              <input
                type="text"
                value={daysInput}
                onChange={(e) => handleDaysChange(e.target.value)}
                onBlur={commitDaysChange}
                disabled={readOnly}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                className="text-[11px] bg-white border border-gray-100 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500/10 outline-none text-gray-600 font-bold w-full pr-6"
                placeholder="0"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-300 font-bold uppercase pointer-events-none">d</span>
            </div>
          </div>

          <div className="w-32 px-2 shrink-0">
              <input
                type="date"
                value={task.endDate}
                onChange={(e) => onUpdateTask(task.id, { endDate: e.target.value })}
                disabled={readOnly}
                className="text-[11px] bg-white border border-gray-100 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500/10 outline-none text-gray-600 font-bold w-full"
              />
          </div>

          <div className="w-20 px-2 shrink-0">
              <input
                type="text"
                value={dependencyIndex}
                onChange={(e) => handleDependencyChange(e.target.value)}
                disabled={readOnly}
                className="text-[11px] bg-white border border-gray-100 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500/10 outline-none text-gray-600 font-bold w-full text-center"
                placeholder="-"
              />
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em]">Folder (No Dates)</span>
        </div>
      )}

      <div className="w-24 px-2 shrink-0 text-right">
        {!readOnly && (
          <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onDeleteTask(task.id)}
              className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded-lg transition-all"
              title="Delete task"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};


interface ListViewProps {
  tasks: Task[];
  expandedTasks: Set<string>;
  onToggleExpand: (id: string) => void;
  onAddTask: (parentId?: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onMoveTask: (id: string, newParentId: string | undefined) => void;
  readOnly?: boolean;
}

const ListView: React.FC<ListViewProps> = ({
  tasks,
  expandedTasks,
  onToggleExpand,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onMoveTask,
  readOnly,
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const toggleExpand = (id: string) => {
    onToggleExpand(id);
  };

  const getFlattenedTasks = (parentId: string | null = null, depth = 0): { task: Task; depth: number }[] => {
    const children = tasks.filter((t) => (t.parentId || null) === parentId);
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
  const orderedTasks = useMemo(() => flattenedTasks.map(t => t.task), [flattenedTasks]);

  const handleDragStart = (event: DragStartEvent) => {
    if (readOnly) return;
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (readOnly) return;
    const { over } = event;
    setOverId(over ? (over.id as string) : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (readOnly) return;
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (over) {
      const activeTask = tasks.find(t => t.id === active.id);
      const overTask = tasks.find(t => t.id === over.id);
      
      if (activeTask && overTask && active.id !== over.id) {
        const activeIndex = flattenedTasks.findIndex(t => t.task.id === active.id);
        const overIndex = flattenedTasks.findIndex(t => t.task.id === over.id);
        
        // Drag Out: If dragging a child to a position above its parent
        if (activeTask.parentId) {
          const parentIndex = flattenedTasks.findIndex(t => t.task.id === activeTask.parentId);
          if (overIndex < parentIndex) {
            onMoveTask(active.id as string, undefined);
            return;
          }
        }
        
        // Drag In: Drop on a task to make it a child
        onMoveTask(active.id as string, over.id as string);
      }
    }
  };

  const totalBusinessDays = useMemo(() => {
    const parentIds = new Set(tasks.map(t => t.parentId).filter(Boolean));
    return tasks.reduce((acc, task) => {
      if (parentIds.has(task.id)) return acc;
      if (task.isMilestone) return acc;
      return acc + (differenceInBusinessDays(parseISO(task.endDate), parseISO(task.startDate)) + 1);
    }, 0);
  }, [tasks]);

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center h-10 border-b border-gray-100 bg-gray-50/50 px-4 sticky top-0 z-20">
        <div className="w-8 shrink-0 flex items-center justify-center" />
        <div className="w-8 shrink-0 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">ID</div>
        <div className="flex-1 flex items-center gap-2 text-[9px] font-black text-gray-400 uppercase tracking-widest pl-2">
          <span>Task Name</span>
          <button
            onClick={() => onAddTask()}
            disabled={readOnly}
            className="p-1 text-gray-400 hover:text-blue-500 hover:bg-white rounded transition-all shadow-sm"
            title="Add root task"
          >
            <Plus size={12} />
          </button>
        </div>
        <div className="w-32 px-2 text-[9px] font-black text-gray-400 uppercase tracking-widest">Start Date</div>
        <div className="w-20 px-2 text-[9px] font-black text-gray-400 uppercase tracking-widest">Days</div>
        <div className="w-32 px-2 text-[9px] font-black text-gray-400 uppercase tracking-widest">Due Date</div>
        <div className="w-20 px-2 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Dep</div>
        <div className="w-24 px-2 text-right text-[9px] font-black text-gray-400 uppercase tracking-widest">Actions</div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          onDragStart={readOnly ? undefined : handleDragStart}
          onDragOver={readOnly ? undefined : handleDragOver}
          onDragEnd={readOnly ? undefined : handleDragEnd}
        >
          <SortableContext items={flattenedTasks.map((t) => t.task.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col">
              {flattenedTasks.length === 0 ? (
                <div className="py-24 flex flex-col items-center justify-center text-gray-400 gap-4">
                  <Calendar size={64} className="opacity-10" />
                  <p className="text-sm font-bold tracking-tight">No tasks found. Let's build something.</p>
                  <button
                    onClick={() => onAddTask()}
                    className="px-8 py-3 bg-blue-500 text-white rounded-2xl text-sm font-black shadow-xl shadow-blue-200 hover:scale-105 transition-all active:scale-95"
                  >
                    Add First Task
                  </button>
                </div>
              ) : (
                <>
                  {flattenedTasks.map(({ task, depth }, index) => (
                    <SortableTaskRow
                      key={task.id}
                      task={task}
                      index={index}
                      depth={depth}
                      hasSubtasks={tasks.some((t) => t.parentId === task.id)}
                      isExpanded={expandedTasks.has(task.id)}
                      onToggleExpand={toggleExpand}
                      onAddTask={onAddTask}
                      onUpdateTask={onUpdateTask}
                      onDeleteTask={onDeleteTask}
                      isOver={overId === task.id && activeId !== task.id}
                      tasks={orderedTasks}
                      readOnly={readOnly}
                    />
                  ))}
                </>
              )}
            </div>
          </SortableContext>

          {flattenedTasks.length > 0 && (
            <div className="mt-6 mx-8 pb-20">
              <div className="flex items-center bg-white border border-gray-100 rounded-[32px] px-10 py-6 shadow-sm overflow-hidden relative min-h-[120px]">
                {/* Subtle background pattern/gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-white to-blue-50/10 pointer-events-none" />
                
                <div className="flex flex-col gap-1.5 w-48 relative z-10">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Total Project Days</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-black text-gray-900 tracking-tighter leading-none">{totalBusinessDays}</span>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight">Working Days</span>
                  </div>
                </div>
                
                <div className="h-16 w-px bg-gray-100 mx-8" />
                
                <div className="flex flex-col gap-1.5 w-40 relative z-10">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Total Tasks</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-black text-gray-900 tracking-tighter leading-none">{tasks.length}</span>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight">Items</span>
                  </div>
                </div>

                <div className="h-16 w-px bg-gray-100 mx-8" />

                <div className="flex flex-col gap-1.5 relative z-10 flex-1">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Project Span</span>
                  <div className="flex items-center gap-4 mt-2">
                    {tasks.length > 0 ? (
                      <>
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest leading-none">Start Date</span>
                          <div className="bg-gray-50/80 px-4 py-2 rounded-2xl border border-gray-100 text-xs font-black text-gray-700 shadow-sm flex items-center gap-2">
                            <Calendar size={12} className="text-blue-400" />
                            {format(new Date(Math.min(...tasks.map(t => parseISO(t.startDate).getTime()))), 'MMM dd, yyyy')}
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-center w-8 h-8 rounded-full bg-gray-50 border border-gray-100">
                          <ChevronRight size={16} className="text-gray-300" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest leading-none">End Date</span>
                          <div className="bg-gray-50/80 px-4 py-2 rounded-2xl border border-gray-100 text-xs font-black text-gray-700 shadow-sm flex items-center gap-2">
                            <Calendar size={12} className="text-red-400" />
                            {format(new Date(Math.max(...tasks.map(t => parseISO(t.endDate).getTime()))), 'MMM dd, yyyy')}
                          </div>
                        </div>
                      </>
                    ) : (
                      <span className="text-sm font-bold text-gray-300 italic">No timeline data available</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DragOverlay dropAnimation={null}>
            {activeId ? (
              <div className="bg-white shadow-2xl rounded-2xl border border-blue-100 p-4 flex items-center gap-4 opacity-90 scale-105">
                <GripVertical size={16} className="text-blue-500" />
                <span className="text-sm font-bold text-gray-800">
                  {tasks.find((t) => t.id === activeId)?.name || 'Moving task...'}
                </span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
};

export default ListView;
