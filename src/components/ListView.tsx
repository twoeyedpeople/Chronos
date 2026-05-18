import React, { useState, useMemo, useEffect } from 'react';
import { Task, Person } from '../types';
import { format, parseISO, addBusinessDays, differenceInBusinessDays, isWeekend, startOfDay, addDays, startOfWeek, endOfWeek, addWeeks } from 'date-fns';
import { Calendar, Trash2, Plus, ChevronRight, ChevronDown, GripVertical, FolderMinus, ArrowLeft, Check } from 'lucide-react';

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
  onUnnestTask: (id: string) => void;
  onToggleDone: (id: string, nextDone: boolean) => void;
  isOver?: boolean;
  tasks: Task[];
  readOnly?: boolean;
  showProjectName?: boolean;
  isKioskView?: boolean;
  people: Person[];
}

const getTaskAssigneeIds = (task: Task) => {
  const ids = task.assigneeIds?.filter(Boolean) ?? [];
  if (ids.length > 0) {
    return Array.from(new Set(ids));
  }
  return task.assigneeId ? [task.assigneeId] : [];
};

const getTaskAssignees = (task: Task, people: Person[]) => {
  const assigneeIds = getTaskAssigneeIds(task);
  return assigneeIds
    .map((id) => people.find((person) => person.id === id))
    .filter((person): person is Person => Boolean(person));
};

const AssigneePills: React.FC<{ assignees: Person[]; isDone?: boolean; compact?: boolean }> = ({ assignees, isDone, compact }) => {
  if (assignees.length === 0) return null;

  if (assignees.length === 1) {
    const [assignee] = assignees;
    return (
      <div
        className={`${compact ? 'h-[18px] px-1.5 text-[8px]' : 'h-[20px] px-2 text-[9px]'} inline-flex items-center rounded-md font-bold text-white shrink-0`}
        style={{ backgroundColor: isDone ? '#E8E8E8' : assignee.color }}
        title={assignee.name}
      >
        <span className="translate-y-[1px] inline-block truncate max-w-24">{assignee.name}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      {assignees.map((assignee) => (
        <div
          key={assignee.id}
          className={`${compact ? 'h-[18px] w-[18px] text-[9px]' : 'h-[20px] w-[20px] text-[10px]'} inline-flex items-center justify-center rounded-md font-black text-white uppercase shrink-0`}
          style={{ backgroundColor: isDone ? '#E8E8E8' : assignee.color }}
          title={assignee.name}
        >
          {assignee.name.trim().charAt(0) || '?'}
        </div>
      ))}
    </div>
  );
};

const AssigneeDropdown: React.FC<{ task: Task, people: Person[], onAssign: (personIds: string[]) => void, readOnly?: boolean }> = ({ task, people, onAssign, readOnly }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedIds = getTaskAssigneeIds(task);
  const assignees = getTaskAssignees(task, people);
  const hasAssignees = assignees.length > 0;

  const togglePerson = (personId: string) => {
    if (selectedIds.includes(personId)) {
      onAssign(selectedIds.filter((id) => id !== personId));
      return;
    }
    onAssign([...selectedIds, personId]);
  };

  return (
    <div className="relative flex items-center">
      <button 
        onClick={() => !readOnly && setIsOpen(!isOpen)}
        disabled={readOnly}
        className={`flex items-center justify-center border transition-all min-w-[64px] ${
          hasAssignees
            ? 'min-h-[24px] px-1.5 rounded-lg border-gray-100 bg-white hover:border-gray-200' 
            : 'h-[20px] px-2 rounded-md border-gray-200 bg-white text-[9px] font-bold text-gray-400 hover:border-gray-300 hover:text-gray-500 uppercase'
        }`}
      >
        {hasAssignees ? (
          <AssigneePills assignees={assignees} isDone={task.isDone} compact />
        ) : (
          <span className="translate-y-[1px] inline-block">ASSIGN</span>
        )}
      </button>

      {isOpen && !readOnly && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-44 bg-white rounded-xl border border-gray-100 z-50 p-1.5 shadow-xl shadow-gray-900/10">
            {people.map(person => (
              <label
                key={person.id}
                className="w-full text-left px-2.5 py-2 text-[11px] font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors rounded-lg cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(person.id)}
                  onChange={() => togglePerson(person.id)}
                  className="w-3 h-3 rounded border-gray-200 accent-[#5F7CFF]"
                />
                <div className="w-3 h-3 rounded-[3px]" style={{ backgroundColor: person.color }} />
                <span className="truncate">{person.name}</span>
              </label>
            ))}
            {selectedIds.length > 0 && (
              <>
                <div className="h-px bg-gray-100 my-1" />
                <button
                  onClick={() => onAssign([])}
                  className="w-full text-left px-2.5 py-2 text-[11px] font-bold text-red-500 hover:bg-red-50 transition-colors rounded-lg"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

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
  onUnnestTask,
  onToggleDone,
  isOver,
  tasks,
  readOnly,
  showProjectName,
  isKioskView,
  people
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
  const [daysInput, setDaysInput] = useState(task.isMilestone ? '◆' : String(days));
  const isGlobalMilestonesView = Boolean(readOnly && showProjectName);
  const isGlobalMilestonesKioskView = Boolean(isGlobalMilestonesView && isKioskView);
  const globalMilestoneDateText = format(parseISO(task.startDate), 'EEE, dd MMM yy');
  const now = startOfDay(new Date());
  const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const taskDate = startOfDay(parseISO(task.startDate));
  const isThisWeek = taskDate <= thisWeekEnd;
  
  const globalMilestoneDateNode = <>{globalMilestoneDateText}</>;
  const mobileStartDateText = format(parseISO(task.startDate), 'dd MMM yy');
  const mobileEndDateText = format(parseISO(task.endDate), 'dd MMM yy');
  const assignees = getTaskAssignees(task, people);

  useEffect(() => {
    setDaysInput(task.isMilestone ? '◆' : String(days));
  }, [days, task.isMilestone]);

  const isFolder = hasSubtasks;
  const canToggleDoneFromDot = isGlobalMilestonesView && !isFolder;

  const handleDaysChange = (val: string) => {
    if (task.isMilestone && (val === '' || /^\d*$/.test(val))) {
      setDaysInput(val);
      return;
    }

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
    if (task.isMilestone && (daysInput.trim() === '' || daysInput === '◆')) {
      setDaysInput('◆');
      return;
    }

    const numDays = parseInt(daysInput, 10);
    if (Number.isNaN(numDays) || numDays < 0) {
      setDaysInput(task.isMilestone ? '◆' : String(days));
      return;
    }

    if (numDays === 0) {
      onUpdateTask(task.id, {
        endDate: task.startDate,
        isMilestone: true,
      });
      setDaysInput('◆');
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
      className={`group border-b border-gray-100 transition-all ${
        isDragging ? 'opacity-50 bg-blue-50/50 z-50' : task.isExternal ? 'bg-[#FFC2E8]/20 hover:bg-[#ffedf9]' : 'bg-white hover:bg-gray-50/80'
      } ${isOver ? 'bg-blue-100/50 ring-2 ring-blue-500/20' : ''}`}
    >
      <div className={`hidden md:flex items-center px-4 ${isGlobalMilestonesKioskView ? 'h-12' : 'h-10'}`}>
        <div className={`${isGlobalMilestonesView ? 'w-[12px]' : 'w-8'} shrink-0 flex items-center justify-center`}>
          {!readOnly && (
            <div 
              {...attributes} 
              {...listeners}
              className={`p-1 ${task.isDone ? '!text-[#E8E8E8]' : 'text-gray-300 hover:text-gray-500'} cursor-grab active:cursor-grabbing rounded transition-colors shrink-0`}
            >
              <GripVertical size={12} />
            </div>
          )}
        </div>

        <div className={`w-8 text-[9px] font-black ${task.isDone ? '!text-[#E8E8E8]' : 'text-gray-300'} shrink-0 text-center`}>
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
            <button
              type="button"
              onClick={() => {
                if (canToggleDoneFromDot) {
                  onToggleDone(task.id, !Boolean(task.isDone));
                  return;
                }
                if (task.parentId && !readOnly) {
                  onUnnestTask(task.id);
                }
              }}
              disabled={readOnly ? !canToggleDoneFromDot : !task.parentId}
              className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-all group/dot ${
                task.isDone
                  ? 'border-[#E8E8E8] text-[#E8E8E8]'
                  : task.isExternal
                    ? 'border-[#FFC2E8] text-[#FFC2E8]'
                    : 'border-blue-100 text-[#5F7CFF]'
              } ${
                canToggleDoneFromDot || (task.parentId && !readOnly)
                  ? 'hover:border-blue-200 hover:bg-blue-50/60 cursor-pointer'
                  : 'cursor-default'
              }`}
              title={
                canToggleDoneFromDot
                  ? task.isDone ? 'Mark milestone as not done' : 'Mark milestone as done'
                  : task.parentId && !readOnly ? 'Move task out of parent' : undefined
              }
            >
              {task.parentId && !readOnly && !canToggleDoneFromDot ? (
                <>
                  <div className={`w-1.5 h-1.5 rounded-full group-hover/dot:hidden ${
                    task.isDone ? 'bg-[#E8E8E8]' : task.isExternal ? 'bg-[#FFC2E8]' : 'bg-[#5F7CFF]'
                  }`} />
                  <ArrowLeft size={11} className={`hidden group-hover/dot:block ${task.isDone ? 'text-[#E8E8E8]' : 'text-[#5F7CFF]'}`} />
                </>
              ) : (
                <div className={`w-1.5 h-1.5 rounded-full ${
                  task.isDone ? 'bg-[#E8E8E8]' : task.isExternal ? 'bg-[#FFC2E8]' : 'bg-[#5F7CFF]'
                }`} />
              )}
            </button>
          )}
          <div className="min-w-0 flex-1 flex items-center gap-2">
            {isGlobalMilestonesView ? (
              <span
                onClick={() => {
                  if (task.sourceProjectId) {
                    window.location.assign(`${window.location.origin}${window.location.pathname}?p=${task.sourceProjectId}&edit=1`);
                  }
                }}
                className={`truncate p-0 leading-tight transition-colors ${
                  task.sourceProjectId ? 'cursor-pointer hover:text-gray-500' : ''
                } ${
                  isGlobalMilestonesKioskView ? 'text-[17px]' : 'text-[13px]'
                } ${isFolder ? 'font-black text-gray-900 uppercase tracking-tight' : 'font-arial font-medium text-gray-800'} ${
                  task.isDone ? '!text-[#E8E8E8]' : ''
                }`}
                title={task.sourceProjectId ? "Go to project timeline" : undefined}
              >
                {task.sourceProjectName ? `${task.sourceProjectName} / ${task.name}` : task.name}
              </span>
            ) : (
              <input
                type="text"
                value={task.name}
                onChange={(e) => onUpdateTask(task.id, { name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
                readOnly={readOnly}
                className={`bg-transparent border-none focus:ring-0 w-full truncate p-0 leading-tight ${
                  isGlobalMilestonesKioskView ? 'text-[17px]' : 'text-[13px]'
                } ${isFolder ? 'font-black text-gray-900 uppercase tracking-tight' : 'font-arial font-medium text-gray-800'} ${
                  task.isDone && !readOnly ? '!text-[#E8E8E8]' : ''
                }`}
                placeholder={isFolder ? "Folder name..." : "Task name..."}
              />
            )}
            {isGlobalMilestonesView && <AssigneePills assignees={assignees} isDone={task.isDone} />}
          </div>
          {!isFolder && !readOnly && (
            <>
              <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black text-gray-400 uppercase tracking-widest shrink-0">
                <input
                  type="checkbox"
                  checked={Boolean(task.isDone)}
                  onChange={(e) => onUpdateTask(task.id, { isDone: e.target.checked })}
                  disabled={readOnly}
                  className="w-3 h-3 rounded border-gray-200 accent-gray-500"
                />
                <span>Done</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  if (!task.isMilestone) {
                    onUpdateTask(task.id, {
                      isMilestone: true,
                      endDate: task.startDate,
                    });
                    setDaysInput('0');
                  } else {
                    const newEndDate = format(addBusinessDays(parseISO(task.startDate), 0), 'yyyy-MM-dd');
                    onUpdateTask(task.id, {
                      isMilestone: false,
                      endDate: newEndDate,
                    });
                    setDaysInput('1');
                  }
                }}
                disabled={readOnly}
                className="mx-2 flex items-center justify-center shrink-0 transition-all hover:scale-110 active:scale-95"
                title="Toggle Milestone"
              >
                <div className={`flex items-center justify-center w-3 h-3 rotate-45 rounded-[1.5px] transition-colors  ${task.isMilestone ? 'bg-gray-900 text-white' : 'bg-gray-400'}`}>
                  {task.isMilestone && <Check size={10} strokeWidth={4} className="-rotate-45" />}
                </div>
              </button>
              <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black text-gray-400 uppercase tracking-widest shrink-0">
                <input
                  type="checkbox"
                  checked={Boolean(task.isExternal)}
                  onChange={(e) => onUpdateTask(task.id, { isExternal: e.target.checked })}
                  disabled={readOnly}
                  className="w-3 h-3 rounded border-gray-200 accent-[#FFC2E8]"
                />
                <span>EXT</span>
              </label>
            </>
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

        {!isFolder && !isGlobalMilestonesView && (
          <div className="w-24 px-2 shrink-0">
            <AssigneeDropdown 
              task={task} 
              people={people} 
              onAssign={(personIds) => onUpdateTask(task.id, {
                assigneeIds: personIds.length > 0 ? personIds : undefined,
                assigneeId: personIds[0] || undefined,
              })} 
              readOnly={readOnly} 
            />
          </div>
        )}

        {!isFolder ? (
          <>
            <div className={`${isGlobalMilestonesKioskView ? 'w-48' : 'w-32'} px-2 shrink-0`}>
              {isGlobalMilestonesView ? (
                <div className={`${isGlobalMilestonesKioskView ? 'text-[14px]' : 'text-[13px]'} ${task.isDone ? '!text-[#E8E8E8]' : 'text-gray-600'} font-bold w-full tabular-nums whitespace-nowrap`}>
                  {globalMilestoneDateNode}
                </div>
              ) : (
                <input
                  type="date"
                  value={task.startDate}
                  onChange={(e) => onUpdateTask(task.id, {
                    startDate: e.target.value,
                    ...(task.isMilestone ? { endDate: e.target.value } : {}),
                  })}
                  disabled={readOnly}
                  className={`text-[11px] bg-white border rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500/10 outline-none font-bold w-full ${task.isDone ? '!text-[#E8E8E8] border-[#E8E8E8]' : 'text-gray-600 border-gray-100'}`}
                />
              )}
            </div>

            {!isGlobalMilestonesView && (
              <div className="w-20 px-2 shrink-0">
                {readOnly ? (
                  <div className="h-[30px] w-full rounded-lg border border-gray-100 bg-white flex items-center px-3 font-bold justify-center">
                    {task.isMilestone ? (
                      <span className={`block w-full text-center leading-none mt-0.5 ${
                        task.isExternal ? 'text-[#FFC2E8] text-[22px]' : 'text-gray-900 text-[22px]'
                      }`}>
                        ◆
                      </span>
                    ) : (
                      <span className="block w-full text-center text-gray-600 tabular-nums text-[11px]">
                        {days}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={daysInput}
                      onChange={(e) => handleDaysChange(e.target.value)}
                      onFocus={(e) => {
                        if (task.isMilestone && e.currentTarget.value === '◆') {
                          e.currentTarget.select();
                        }
                      }}
                      onBlur={commitDaysChange}
                      disabled={readOnly}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        }
                      }}
                      className={`bg-white border border-gray-100 rounded-lg px-2 focus:ring-2 focus:ring-blue-500/10 outline-none font-bold w-full text-center h-[26px] ${
                        task.isMilestone
                          ? task.isExternal
                            ? 'text-[#FFC2E8] text-[22px] leading-none py-0'
                            : 'text-gray-900 text-[22px] leading-none py-0'
                          : 'text-gray-600 text-[11px] py-1'
                      }`}
                      placeholder="0"
                    />
                    {!task.isMilestone && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-300 font-bold uppercase pointer-events-none">d</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {!isGlobalMilestonesView && (
              <>
                <div className="w-32 px-2 shrink-0">
                  {readOnly ? (
                    <div className={`text-[11px] ${task.isDone ? '!text-[#E8E8E8]' : 'text-gray-600'} font-bold w-full tabular-nums`}>
                      {format(parseISO(task.endDate), 'dd MMM yyyy')}
                    </div>
                  ) : (
                    <input
                      type="date"
                      value={task.endDate}
                      onChange={(e) => onUpdateTask(task.id, { endDate: e.target.value })}
                      disabled={readOnly}
                      className={`text-[11px] bg-white border rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500/10 outline-none font-bold w-full ${task.isDone ? '!text-[#E8E8E8] border-[#E8E8E8]' : 'text-gray-600 border-gray-100'}`}
                    />
                  )}
                </div>

                {!readOnly && (
                  <div className="w-20 px-2 shrink-0">
                      <input
                        type="text"
                        value={dependencyIndex}
                        onChange={(e) => handleDependencyChange(e.target.value)}
                        disabled={readOnly}
                        className={`text-[11px] bg-white border rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500/10 outline-none font-bold w-full text-center ${task.isDone ? '!text-[#E8E8E8] border-[#E8E8E8]' : 'text-gray-600 border-gray-100'}`}
                        placeholder="-"
                      />
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <span className={`text-[9px] font-black ${task.isDone ? '!text-[#E8E8E8]' : 'text-gray-300'} uppercase tracking-[0.2em]`}>Folder (No Dates)</span>
          </div>
        )}

        <div className="w-24 px-2 shrink-0 text-right">
          {(!readOnly || isGlobalMilestonesView) && (
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

      <div className="md:hidden px-3 py-3">
        <div className="flex items-start gap-2">
          {!readOnly && (
            <div 
              {...attributes} 
              {...listeners}
              className="pt-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing rounded transition-colors shrink-0"
            >
              <GripVertical size={12} />
            </div>
          )}

          <div className="pt-0.5 text-[9px] font-black text-gray-300 shrink-0 w-5 text-center">
            {index + 1}
          </div>

          <div className="flex-1 min-w-0" style={{ paddingLeft: `${depth * 12}px` }}>
            <div className="flex items-start gap-2 min-w-0">
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
                <button
                  type="button"
                  onClick={() => {
                    if (canToggleDoneFromDot) {
                      onToggleDone(task.id, !Boolean(task.isDone));
                      return;
                    }
                    if (task.parentId && !readOnly) {
                      onUnnestTask(task.id);
                    }
                  }}
                  disabled={readOnly ? !canToggleDoneFromDot : !task.parentId}
                  className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-all group/dot ${
                    task.isDone
                      ? 'border-gray-200 text-gray-300'
                      : task.isExternal
                        ? 'border-[#FFC2E8] text-[#FFC2E8]'
                        : 'border-blue-100 text-[#5F7CFF]'
                  } ${
                    canToggleDoneFromDot || (task.parentId && !readOnly)
                      ? 'hover:border-blue-200 hover:bg-blue-50/60 cursor-pointer'
                      : 'cursor-default'
                  }`}
                  title={
                    canToggleDoneFromDot
                      ? task.isDone ? 'Mark milestone as not done' : 'Mark milestone as done'
                      : task.parentId && !readOnly ? 'Move task out of parent' : undefined
                  }
                >
                  {task.parentId && !readOnly && !canToggleDoneFromDot ? (
                    <>
                      <div className={`w-1.5 h-1.5 rounded-full group-hover/dot:hidden ${
                        task.isDone ? 'bg-gray-300' : task.isExternal ? 'bg-[#FFC2E8]' : 'bg-[#5F7CFF]'
                      }`} />
                      <ArrowLeft size={11} className="hidden group-hover/dot:block text-[#5F7CFF]" />
                    </>
                  ) : (
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      task.isDone ? 'bg-gray-300' : task.isExternal ? 'bg-[#FFC2E8]' : 'bg-[#5F7CFF]'
                    }`} />
                  )}
                </button>
              )}

              <div className="min-w-0 flex-1">
                <input
                  type="text"
                  value={isGlobalMilestonesView && task.sourceProjectName ? `${task.sourceProjectName} / ${task.name}` : task.name}
                  onChange={(e) => onUpdateTask(task.id, { name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                  }}
                  readOnly={readOnly}
                  className={`bg-transparent border-none focus:ring-0 text-[14px] w-full p-0 leading-tight ${isFolder ? 'font-black text-gray-900 uppercase tracking-tight' : 'font-arial font-medium text-gray-800'} ${
                    task.isDone && (!readOnly || isGlobalMilestonesView) ? 'opacity-30 !text-[#F3F3F3]' : ''
                  }`}
                  placeholder={isFolder ? "Folder name..." : "Task name..."}
                />

                {!isFolder && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {!readOnly ? (
                      <AssigneeDropdown
                        task={task}
                        people={people}
                        onAssign={(personIds) => onUpdateTask(task.id, {
                          assigneeIds: personIds.length > 0 ? personIds : undefined,
                          assigneeId: personIds[0] || undefined,
                        })}
                        readOnly={readOnly}
                      />
                    ) : (
                      <AssigneePills assignees={assignees} isDone={task.isDone} compact />
                    )}
                  </div>
                )}

                {!isFolder && !readOnly && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black text-gray-400 uppercase tracking-widest shrink-0">
                      <input
                        type="checkbox"
                        checked={Boolean(task.isDone)}
                        onChange={(e) => onUpdateTask(task.id, { isDone: e.target.checked })}
                        disabled={readOnly}
                        className="w-3 h-3 rounded border-gray-200 accent-gray-500"
                      />
                      <span>Done</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (!task.isMilestone) {
                          onUpdateTask(task.id, {
                            isMilestone: true,
                            endDate: task.startDate,
                          });
                          setDaysInput('0');
                        } else {
                          const newEndDate = format(addBusinessDays(parseISO(task.startDate), 0), 'yyyy-MM-dd');
                          onUpdateTask(task.id, {
                            isMilestone: false,
                            endDate: newEndDate,
                          });
                          setDaysInput('1');
                        }
                      }}
                      disabled={readOnly}
                      className="mx-2 flex items-center justify-center shrink-0 transition-all hover:scale-110 active:scale-95"
                      title="Toggle Milestone"
                    >
                      <div className={`flex items-center justify-center w-3 h-3 rotate-45 rounded-[1.5px] transition-colors  ${task.isMilestone ? 'bg-gray-900 text-white' : 'bg-gray-400'}`}>
                        {task.isMilestone && <Check size={10} strokeWidth={4} className="-rotate-45" />}
                      </div>
                    </button>
                    <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black text-gray-400 uppercase tracking-widest shrink-0">
                      <input
                        type="checkbox"
                        checked={Boolean(task.isExternal)}
                        onChange={(e) => onUpdateTask(task.id, { isExternal: e.target.checked })}
                        disabled={readOnly}
                        className="w-3 h-3 rounded border-gray-200 accent-[#FFC2E8]"
                      />
                      <span>EXT</span>
                    </label>
                  </div>
                )}
              </div>

              {(!readOnly || isGlobalMilestonesView) && (
                <button
                  onClick={() => onDeleteTask(task.id)}
                  className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded-lg transition-all shrink-0"
                  title="Delete task"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {!isFolder ? (
              <div className={`mt-3 ${readOnly ? '' : isGlobalMilestonesView ? 'grid grid-cols-1' : 'grid grid-cols-2'} ${readOnly ? '' : 'gap-2'}`}>
                {readOnly ? (
                  isGlobalMilestonesView ? (
                    <div className="text-[12px] font-bold text-gray-600 tabular-nums leading-tight">
                      {globalMilestoneDateNode}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-[12px] font-bold text-gray-600 tabular-nums leading-tight whitespace-nowrap overflow-x-auto no-scrollbar">
                      <span className="shrink-0">{mobileStartDateText}</span>
                      <span className="text-gray-300">•</span>
                      {task.isMilestone ? (
                        <span className="inline-flex items-center h-3.5 shrink-0">
                          <span
                            className={`block h-2.5 w-2.5 rotate-45 rounded-[1px] ${
                              task.isExternal ? 'bg-[#FFC2E8]' : 'bg-gray-900'
                            }`}
                          />
                        </span>
                      ) : (
                        <span className="shrink-0">{days}d</span>
                      )}
                      <span className="text-gray-300">•</span>
                      <span className="shrink-0">{mobileEndDateText}</span>
                    </div>
                  )
                ) : isGlobalMilestonesView ? (
                  <div className="rounded-xl border border-gray-100 bg-white px-3 py-2">
                    <div className="text-[8px] font-black uppercase tracking-[0.12em] text-gray-400 mb-1">Date</div>
                    <div className="text-[12px] font-bold text-gray-600 tabular-nums">
                      {globalMilestoneDateNode}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border border-gray-100 bg-white px-3 py-2">
                      <div className="text-[8px] font-black uppercase tracking-[0.12em] text-gray-400 mb-1">Start</div>
                      <input
                        type="date"
                        value={task.startDate}
                        onChange={(e) => onUpdateTask(task.id, {
                          startDate: e.target.value,
                          ...(task.isMilestone ? { endDate: e.target.value } : {}),
                        })}
                        className="text-[12px] bg-transparent border-none p-0 focus:ring-0 outline-none text-gray-600 font-bold w-full"
                      />
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-white px-3 py-2">
                      <div className="text-[8px] font-black uppercase tracking-[0.12em] text-gray-400 mb-1">Due</div>
                      <input
                        type="date"
                        value={task.endDate}
                        onChange={(e) => onUpdateTask(task.id, { endDate: e.target.value })}
                        className="text-[12px] bg-transparent border-none p-0 focus:ring-0 outline-none text-gray-600 font-bold w-full"
                      />
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-white px-3 py-2">
                      <div className="text-[8px] font-black uppercase tracking-[0.12em] text-gray-400 mb-1">Days</div>
                      <div className="relative">
                        <input
                          type="text"
                          value={daysInput}
                          onChange={(e) => handleDaysChange(e.target.value)}
                          onFocus={(e) => {
                            if (task.isMilestone && e.currentTarget.value === '◆') {
                              e.currentTarget.select();
                            }
                          }}
                          onBlur={commitDaysChange}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                          className={`bg-transparent border-none p-0 focus:ring-0 outline-none font-bold w-full text-center ${
                            task.isMilestone
                              ? task.isExternal
                                ? 'text-[#FFC2E8] text-[24px] leading-none'
                                : 'text-gray-900 text-[24px] leading-none'
                              : 'text-gray-600 text-[12px]'
                          }`}
                        />
                        {!task.isMilestone && (
                          <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[9px] text-gray-300 font-bold uppercase pointer-events-none">d</span>
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-white px-3 py-2">
                      <div className="text-[8px] font-black uppercase tracking-[0.12em] text-gray-400 mb-1">Dep</div>
                      <input
                        type="text"
                        value={dependencyIndex}
                        onChange={(e) => handleDependencyChange(e.target.value)}
                        className="text-[12px] bg-transparent border-none p-0 focus:ring-0 outline-none text-gray-600 font-bold w-full"
                        placeholder="-"
                      />
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="mt-2 text-[9px] font-black text-gray-300 uppercase tracking-[0.14em]">
                Folder
              </div>
            )}
          </div>
        </div>
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
  onMoveTask: (id: string, newParentId: string | undefined, insertBeforeId?: string) => void;
  readOnly?: boolean;
  showProjectName?: boolean;
  isMobile?: boolean;
  refreshTick?: number;
  isKioskView?: boolean;
  people: Person[];
}

const GLOBAL_MILESTONE_MESSAGES = [
  'The deadlines are humming softly in the walls.',
  'A brave milestone has entered the chat.',
  'Somewhere, a producer just whispered "on track."',
  'Tiny calendar goblins are moving things into place.',
  'This timeline has opinions and several dramatic reveals.',
  'Progress is real, even when it looks suspiciously elegant.',
  'The future is colour-coded and mildly theatrical.',
  'A milestone is just a secret with a date attached.',
  'The agency machine purrs, blinks, and requests snacks.',
  'Everything is unfolding exactly as mysteriously intended.',
  'Momentum has put on a nice jacket today.',
  'Several important things are happening, probably on purpose.',
  'A wild deliverable has appeared in the tall grass.',
  'The coffee machine is dispensing pure motivation today.',
  'Do not startle the timeline, it is easily frightened.',
  'A single tear of joy was just shed over a spreadsheet.',
  'Please ensure all deadlines remain in their upright and locked positions.',
  'We are currently operating at maximum whimsy.',
  'Hold on, we are realigning the chakras of this Gantt chart.',
  'The strategic objective is currently wearing sunglasses.',
  'Just another day of turning caffeine into deliverables.',
  'Warning: approaching dangerous levels of synergy.',
  'A wild client approval is rumoured to be nearby.',
  'The pixels have unionised, but negotiations are going well.',
  'This milestone was brought to you by sheer willpower.',
  'Hold tight, we are downloading more time from the internet.',
  'Nobody panic, but a task was just completed on schedule.',
  'The timeline demands tribute in the form of completed tasks.',
  'The algorithm is pleased with your recent life choices.',
  'The Gantt chart is currently undergoing a spiritual awakening.',
  'A stray keyframe was just safely returned to its timeline.',
  'We\'ve temporarily replaced the PM with a magic 8-ball.',
  'The brief has been successfully deciphered by our top scholars.',
  'A rogue post-it note has declared itself the new project manager.',
  'Currently manifesting a flawless deployment.',
  'Please do not feed the creeping scope.',
  'The design team is performing a ritual to summon white space.',
  'The timeline is behaving surprisingly well today. Don\'t jinx it.',
  'We are carefully carrying the deliverables across a tightrope.',
  'The font weights are currently locked in a delicate debate.',
  'A developer is quietly bargaining with an API.',
  'The strategy deck has achieved self-awareness.',
  'Pouring one out for the features left on the cutting room floor.',
  'The hex codes are aligned. The stars have spoken.',
  'The wireframes are slowly transforming into reality.',
  'We are politely asking the cache to clear itself.',
  'A mysterious force is nudging the pixels exactly one pixel left.',
  'The moodboard has started to dictate our lunch choices.',
  'A wild typo was narrowly avoided by sheer intuition.',
  'We are currently translating \'make it pop\' into actionable steps.',
  'The deadline is approaching, but we are walking casually.',
  'A rare moment of perfect synergy was just recorded.',
  'The project files are whispering secrets to each other at night.'
];

let shuffledMessages: string[] = [];
let messageIndex = 0;

function getNextMotivationalMessage() {
  if (shuffledMessages.length === 0 || messageIndex >= shuffledMessages.length) {
    shuffledMessages = [...GLOBAL_MILESTONE_MESSAGES];
    for (let i = shuffledMessages.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledMessages[i], shuffledMessages[j]] = [shuffledMessages[j], shuffledMessages[i]];
    }
    messageIndex = 0;
  }
  return shuffledMessages[messageIndex++];
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
  showProjectName,
  refreshTick,
  isKioskView,
  people,
}) => {

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const isGlobalMilestonesView = Boolean(readOnly && showProjectName);
  const isGlobalMilestonesKioskView = Boolean(isGlobalMilestonesView && isKioskView);
  const NEST_DRAG_THRESHOLD = 28;
  const [globalMilestoneMessage, setGlobalMilestoneMessage] = useState(
    getNextMotivationalMessage()
  );

  useEffect(() => {
    if (!isGlobalMilestonesView && !readOnly) return;

    setGlobalMilestoneMessage(getNextMotivationalMessage());

    const interval = window.setInterval(() => {
      setGlobalMilestoneMessage(getNextMotivationalMessage());
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [isGlobalMilestonesView, readOnly, refreshTick]);

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
  const globalMilestoneSections = useMemo(() => {
    if (!isGlobalMilestonesView) return null;

    const now = startOfDay(new Date());
    const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const nextWeekStart = startOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });
    const nextWeekEnd = endOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });

    const buckets: Array<{
      id: 'this-week' | 'next-week' | 'future';
      label: string;
      items: { task: Task; depth: number }[];
    }> = [
      { id: 'this-week', label: 'This week', items: [] },
      { id: 'next-week', label: 'Next week', items: [] },
      { id: 'future', label: 'Future', items: [] },
    ];

    flattenedTasks.forEach((entry) => {
      const taskDate = startOfDay(parseISO(entry.task.startDate));

      if (taskDate <= thisWeekEnd) {
        buckets[0].items.push(entry);
      } else if (taskDate >= nextWeekStart && taskDate <= nextWeekEnd) {
        buckets[1].items.push(entry);
      } else {
        buckets[2].items.push(entry);
      }
    });

    return buckets.filter((section) => section.items.length > 0);
  }, [flattenedTasks, isGlobalMilestonesView, refreshTick]);

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
    const { active, over, delta } = event;
    setActiveId(null);
    setOverId(null);

    if (over) {
      const activeTask = tasks.find(t => t.id === active.id);
      const overTask = tasks.find(t => t.id === over.id);
      
      if (activeTask && overTask && active.id !== over.id) {
        const activeIndex = flattenedTasks.findIndex(t => t.task.id === active.id);
        const overIndex = flattenedTasks.findIndex(t => t.task.id === over.id);
        
        // Drag Out: If dragging a child above its parent level without
        // intentionally dragging right to nest.
        if (activeTask.parentId) {
          const parentIndex = flattenedTasks.findIndex(t => t.task.id === activeTask.parentId);
          if (overIndex < parentIndex && delta.x < NEST_DRAG_THRESHOLD) {
            onMoveTask(active.id as string, undefined, over.id as string);
            return;
          }
        }

        const shouldNest = delta.x > NEST_DRAG_THRESHOLD;

        if (shouldNest) {
          onMoveTask(active.id as string, over.id as string);
          return;
        }

        onMoveTask(active.id as string, overTask.parentId ?? undefined, over.id as string);
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

  const unnestTask = (id: string) => {
    onMoveTask(id, undefined);
  };

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Desktop Header */}
      <div className="hidden md:flex items-center h-10 border-b border-gray-100 bg-gray-50/50 px-4 sticky top-0 z-20">
        <div className="w-8 shrink-0 flex items-center justify-center" />
        <div className="w-8 shrink-0 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">ID</div>
        <div className="flex-1 flex items-center gap-2 text-[9px] font-black text-gray-400 uppercase tracking-widest pl-2">
          <span>{isGlobalMilestonesView ? 'Project / Milestone' : 'Task Name'}</span>
          {!readOnly && (
            <button
              onClick={() => onAddTask()}
              className="p-1 text-gray-400 hover:text-blue-500 hover:bg-white rounded transition-all "
              title="Add root task"
            >
              <Plus size={12} />
            </button>
          )}
        </div>
        {!isGlobalMilestonesView && (
          <div className="w-24 px-2 text-[9px] font-black text-gray-400 uppercase tracking-widest">Assignee</div>
        )}
        <div className={`${isGlobalMilestonesKioskView ? 'w-48' : 'w-32'} px-2 text-[9px] font-black text-gray-400 uppercase tracking-widest`}>
          {isGlobalMilestonesView ? 'Date' : 'Start Date'}
        </div>
        {!isGlobalMilestonesView && (
          <>
            <div className="w-20 px-2 text-[9px] font-black text-gray-400 uppercase tracking-widest">Days</div>
            <div className="w-32 px-2 text-[9px] font-black text-gray-400 uppercase tracking-widest">Due Date</div>
            {!readOnly && (
              <div className="w-20 px-2 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Dep</div>
            )}
          </>
        )}
        {!isGlobalMilestonesView && (
          <div className="w-24 px-2 text-right text-[9px] font-black text-gray-400 uppercase tracking-widest">Actions</div>
        )}
      </div>

      <div className="md:hidden flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-4 py-3 sticky top-0 z-20">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em]">
          {isGlobalMilestonesView ? 'Project Milestones' : 'Tasks'}
        </span>
        {!readOnly && (
          <button
            onClick={() => onAddTask()}
            className="p-2 text-gray-400 hover:text-blue-500 hover:bg-white rounded-lg transition-all "
            title="Add root task"
          >
            <Plus size={14} />
          </button>
        )}
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
                    className="px-8 py-3 bg-blue-500 text-white rounded-2xl text-sm font-black   hover:scale-105 transition-all active:scale-95"
                  >
                    Add First Task
                  </button>
                </div>
              ) : (
                <>
                  {isGlobalMilestonesView && globalMilestoneSections ? (
                    globalMilestoneSections.map((section) => (
                      <div key={section.id} className="flex flex-col">
                        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-y border-gray-100 px-4 py-2">
                          <span className={`${isGlobalMilestonesKioskView ? 'text-[16px]' : 'text-[13px]'} font-black text-gray-400 font-arial`}>
                            {section.label}
                          </span>
                        </div>
                        {section.items.map(({ task, depth }) => {
                          const index = flattenedTasks.findIndex((entry) => entry.task.id === task.id);
                          return (
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
                              onUnnestTask={unnestTask}
                              onToggleDone={(taskId, nextDone) => onUpdateTask(taskId, { isDone: nextDone })}
                              isOver={overId === task.id && activeId !== task.id}
                              tasks={orderedTasks}
                              readOnly={readOnly}
                              showProjectName={showProjectName}
                              isKioskView={isKioskView}
                              people={people}
                            />
                          );
                        })}
                      </div>
                    ))
                  ) : (
                    flattenedTasks.map(({ task, depth }, index) => (
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
                        onUnnestTask={unnestTask}
                        onToggleDone={(taskId, nextDone) => onUpdateTask(taskId, { isDone: nextDone })}
                        isOver={overId === task.id && activeId !== task.id}
                        tasks={orderedTasks}
                        readOnly={readOnly}
                        showProjectName={showProjectName}
                        isKioskView={isKioskView}
                        people={people}
                      />
                    ))
                  )}
                </>
              )}
            </div>
          </SortableContext>

          {flattenedTasks.length > 0 && (
            <div className="mx-8 pb-20 mt-[41px] -translate-y-[25px]">
              {!isGlobalMilestonesView && (
                <div className="bg-gray-50 border border-gray-100 rounded-[24px] px-6 py-4 overflow-hidden relative min-h-[66px] mb-6 flex items-center">

                  <div className="relative z-10 flex items-center gap-6 w-full">
                    <div className="flex items-center gap-1.5 min-w-[102px]">
                      <span className="text-[14px] font-medium text-gray-500">Working days:</span>
                      <span className="text-[14px] font-black text-gray-900">{totalBusinessDays}</span>
                    </div>

                    <div className="flex items-center gap-3 min-w-0">
                      {tasks.length > 0 ? (
                        <>
                          <div className="min-w-[122px]">
                            <div className="bg-gray-50/80 px-3.5 py-2.5 rounded-xl border border-gray-100 text-[11px] font-black text-gray-700  flex items-center gap-2 leading-none">
                              <Calendar size={11} className="text-blue-400" />
                              {format(new Date(Math.min(...tasks.map(t => parseISO(t.startDate).getTime()))), 'MMM dd, yyyy')}
                            </div>
                          </div>
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-50 border border-gray-100 shrink-0">
                            <ChevronRight size={14} className="text-gray-300" />
                          </div>
                          <div className="min-w-[122px]">
                            <div className="bg-gray-50/80 px-3.5 py-2.5 rounded-xl border border-gray-100 text-[11px] font-black text-gray-700  flex items-center gap-2 leading-none">
                              <Calendar size={11} className="text-red-400" />
                              {format(new Date(Math.max(...tasks.map(t => parseISO(t.endDate).getTime()))), 'MMM dd, yyyy')}
                            </div>
                          </div>
                        </>
                      ) : (
                        <span className="text-[14px] font-bold text-gray-300 italic">No timeline data available</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {(isGlobalMilestonesView || readOnly) && (
                <div className="flex items-center justify-between gap-6 min-h-[40px] px-2">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <img
                      src="/mascot-circle.png"
                      alt="Mascot"
                      className="w-[62px] h-[62px] shrink-0 object-contain"
                    />
                    <p className="text-[#C21A88] font-davinci font-normal tracking-[-0.02em] leading-[1.15] text-[26px] line-clamp-2 text-left translate-y-[1px] -translate-x-[3px]">
                      {globalMilestoneMessage}
                    </p>
                  </div>
                  <img
                    src="/twoeyedpeople-logo-black.png"
                    alt="Two-Eyed People"
                    className="h-10 w-auto shrink-0 object-contain"
                  />
                </div>
              )}
            </div>
          )}

          <DragOverlay dropAnimation={null}>
            {activeId ? (
              <div className="bg-white  rounded-2xl border border-blue-100 p-4 flex items-center gap-4 opacity-90 scale-105">
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
