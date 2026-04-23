import React, { useState, useMemo } from 'react';
import { Task } from '../types';
import { Plus, Trash2, ChevronRight, ChevronDown, GripVertical, Calendar } from 'lucide-react';
import { format, parseISO, isWeekend, startOfDay, addDays, differenceInBusinessDays } from 'date-fns';
import {
  DndContext,
  closestCenter,
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

interface SortableSidebarRowProps {
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
  readOnly?: boolean;
}

const SortableSidebarRow: React.FC<SortableSidebarRowProps> = ({
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
  const taskStartDate = format(parseISO(task.startDate), 'dd MMM yyyy');
  const taskEndDate = format(parseISO(task.endDate), 'dd MMM yyyy');

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center h-8 transition-all border-b border-gray-50/50 ${
        isDragging ? 'opacity-50 bg-blue-50/50 z-50' : 'bg-white hover:bg-gray-50'
      } ${isOver ? 'bg-blue-100/50 ring-1 ring-blue-500/20' : ''}`}
    >
      {!readOnly && (
        <div 
          {...attributes} 
          {...listeners}
          className="p-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing rounded transition-colors shrink-0"
        >
          <GripVertical size={10} />
        </div>
      )}

      <div className="w-5 text-[8px] font-black text-gray-300 shrink-0 text-center" style={{ marginLeft: readOnly ? 8 : 0 }}>
        {index + 1}
      </div>

      <div className="flex items-center gap-1 flex-1 min-w-0" style={{ paddingLeft: `${depth * 16 + 4}px` }}>
        {hasSubtasks ? (
          <button
            onClick={() => onToggleExpand(task.id)}
            className="p-0.5 hover:bg-gray-100 rounded transition-colors text-gray-400 shrink-0"
          >
            {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </button>
        ) : (
          <div className="w-3 h-3 flex items-center justify-center shrink-0">
            <div className={`w-1 h-1 rounded-full ${task.isExternal ? 'bg-[#FFF3FC] ring-2 ring-pink-200' : 'bg-[#5F7CFF]'}`} />
          </div>
        )}
        <input
          type="text"
          value={task.name}
          onChange={(e) => onUpdateTask(task.id, { name: e.target.value })}
          readOnly={readOnly}
          className={`bg-transparent border-none focus:ring-0 text-[10px] w-full truncate p-0 ${hasSubtasks ? 'font-black text-gray-900 uppercase tracking-tight' : 'font-bold text-gray-700'}`}
          placeholder={hasSubtasks ? "Folder..." : "Task..."}
        />
      </div>

      {readOnly && (
        <>
          <div className="w-24 shrink-0 px-2 text-[9px] font-bold text-gray-500 tabular-nums">
            {taskStartDate}
          </div>
          <div className="w-24 shrink-0 px-2 text-[9px] font-bold text-gray-500 tabular-nums">
            {taskEndDate}
          </div>
        </>
      )}

      {!readOnly && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pr-2">
          <button
            onClick={() => onAddTask(task.id)}
            className="p-1 hover:bg-blue-50 hover:text-blue-500 rounded transition-all"
          >
            <Plus size={12} />
          </button>
          <button
            onClick={() => onDeleteTask(task.id)}
            className="p-1 hover:bg-red-50 hover:text-red-500 rounded transition-all"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
};


interface SidebarProps {
  tasks: Task[];
  flattenedTasks: { task: Task; depth: number }[];
  expandedTasks: Set<string>;
  onToggleExpand: (id: string) => void;
  onAddTask: (parentId?: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onMoveTask: (id: string, newParentId: string | undefined) => void;
  readOnly?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  tasks, 
  flattenedTasks,
  expandedTasks,
  onToggleExpand,
  onAddTask, 
  onUpdateTask, 
  onDeleteTask,
  onMoveTask,
  readOnly
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);
  const handleDragOver = (event: DragOverEvent) => setOverId(event.over ? (event.over.id as string) : null);
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

  const projectSpan = useMemo(() => {
    if (tasks.length === 0) return null;
    const startDates = tasks.map(t => parseISO(t.startDate).getTime());
    const endDates = tasks.map(t => parseISO(t.endDate).getTime());
    return {
      start: new Date(Math.min(...startDates)),
      end: new Date(Math.max(...endDates))
    };
  }, [tasks]);

  return (
    <aside className={`${readOnly ? 'w-[440px]' : 'w-64'} border-r border-gray-100 bg-white flex flex-col shrink-0 z-10 transition-all`}>
      <div className="h-16 flex items-end justify-between px-4 pb-3 border-b border-gray-50 bg-gray-50/30">
        {readOnly ? (
          <div className="w-full flex items-center">
            <span className="flex-1 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Tasks</span>
            <span className="w-24 px-2 text-[8px] font-black text-gray-400 uppercase tracking-widest">Start</span>
            <span className="w-24 px-2 text-[8px] font-black text-gray-400 uppercase tracking-widest">End</span>
          </div>
        ) : (
          <>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Tasks</span>
            <button 
              onClick={() => onAddTask()}
              className="p-1 hover:bg-white hover:text-blue-500 rounded-lg transition-all text-gray-400 shadow-xs"
            >
              <Plus size={12} />
            </button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={readOnly ? undefined : handleDragStart}
          onDragOver={readOnly ? undefined : handleDragOver}
          onDragEnd={readOnly ? undefined : handleDragEnd}
        >
          <SortableContext items={flattenedTasks.map(t => t.task.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col pt-2">
              {flattenedTasks.map(({ task, depth }, index) => (
                <SortableSidebarRow
                  key={task.id}
                  task={task}
                  index={index}
                  depth={depth}
                  hasSubtasks={tasks.some(t => t.parentId === task.id)}
                  isExpanded={expandedTasks.has(task.id)}
                  onToggleExpand={onToggleExpand}
                  onAddTask={onAddTask}
                  onUpdateTask={onUpdateTask}
                  onDeleteTask={onDeleteTask}
                  isOver={overId === task.id && activeId !== task.id}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay dropAnimation={null}>
            {activeId ? (
              <div className="bg-white shadow-xl rounded-lg border border-blue-100 p-2 flex items-center gap-2 opacity-90 scale-105">
                <GripVertical size={12} className="text-blue-500" />
                <span className="text-[11px] font-bold text-gray-700">
                  {tasks.find(t => t.id === activeId)?.name || 'Moving...'}
                </span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Sidebar Summary */}
      <div className="border-t border-gray-50 bg-gray-50/20 p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[8px] font-black text-gray-400 uppercase tracking-[0.2em]">Working Days</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-black text-gray-900 tracking-tighter">{totalBusinessDays}</span>
            <span className="text-[8px] font-bold text-gray-400 uppercase">Days</span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[8px] font-black text-gray-400 uppercase tracking-[0.2em]">Total Tasks</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-black text-gray-900 tracking-tighter">{tasks.length}</span>
            <span className="text-[8px] font-bold text-gray-400 uppercase">Items</span>
          </div>
        </div>

        {projectSpan && (
          <div className="flex flex-col gap-2">
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-[0.2em]">Timeline</span>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 bg-white/50 px-2 py-1.5 rounded-lg border border-gray-100/50">
                <Calendar size={10} className="text-blue-400" />
                <span className="text-[9px] font-bold text-gray-600">{format(projectSpan.start, 'MMM dd, yyyy')}</span>
              </div>
              <div className="flex items-center gap-2 bg-white/50 px-2 py-1.5 rounded-lg border border-gray-100/50">
                <Calendar size={10} className="text-red-400" />
                <span className="text-[9px] font-bold text-gray-600">{format(projectSpan.end, 'MMM dd, yyyy')}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
