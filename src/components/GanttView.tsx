import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Task, ViewMode } from '../types';
import { format, addDays, differenceInDays, startOfDay, isWithinInterval, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, eachWeekOfInterval, startOfMonth, endOfMonth, eachMonthOfInterval, isWeekend, addBusinessDays, differenceInBusinessDays } from 'date-fns';
import { motion } from 'motion/react';

interface GanttViewProps {
  tasks: Task[];
  allTasks: Task[];
  viewMode: ViewMode;
  zoom: number;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  readOnly?: boolean;
}

type DragType = 'move' | 'resize-start' | 'resize-end';

interface DragState {
  taskId: string;
  type: DragType;
  startX: number;
  initialLeft: number;
  initialWidth: number;
}

const MILESTONE_SIZE = 14;

const GanttView: React.FC<GanttViewProps> = ({ tasks, allTasks, viewMode, zoom, onUpdateTask, readOnly }) => {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [previewDelta, setPreviewDelta] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const parentIds = useMemo(() => {
    return new Set(allTasks.map(t => t.parentId).filter(Boolean));
  }, [allTasks]);

  const { minDate, maxDate } = useMemo(() => {
    const today = startOfDay(new Date());
    const oneMonthAgo = addDays(today, -30);
    
    let min: Date;
    let max: Date;

    if (tasks.length === 0) {
      min = oneMonthAgo;
      max = addDays(today, 30);
    } else {
      const dates = tasks.flatMap(t => [parseISO(t.startDate), parseISO(t.endDate)]);
      const minTaskDate = new Date(Math.min(...dates.map(d => d.getTime())));
      const maxTaskDate = new Date(Math.max(...dates.map(d => d.getTime())));
      
      min = new Date(Math.min(minTaskDate.getTime(), oneMonthAgo.getTime()));
      max = maxTaskDate;
    }
    
    let start = startOfDay(addDays(min, -7));
    let end = startOfDay(addDays(max, 14));

    if (viewMode === 'week') {
      start = startOfWeek(start, { weekStartsOn: 1 });
      end = endOfWeek(end, { weekStartsOn: 1 });
    } else if (viewMode === 'month') {
      start = startOfMonth(start);
      end = endOfMonth(end);
    }

    return { minDate: start, maxDate: end };
  }, [tasks, viewMode]);

  const dayWidth = 40 * zoom;

  const timeSlots = useMemo(() => {
    if (viewMode === 'day') {
      return eachDayOfInterval({ start: minDate, end: maxDate });
    } else if (viewMode === 'week') {
      return eachWeekOfInterval({ start: minDate, end: maxDate }, { weekStartsOn: 1 });
    } else {
      return eachMonthOfInterval({ start: minDate, end: maxDate });
    }
  }, [minDate, maxDate, viewMode]);

  const totalWidth = useMemo(() => {
    if (viewMode === 'day') {
      return timeSlots.length * dayWidth;
    } else if (viewMode === 'week') {
      return timeSlots.length * 7 * dayWidth;
    } else {
      return timeSlots.reduce((acc, date) => {
        const days = differenceInDays(addDays(endOfMonth(date), 1), startOfMonth(date));
        return acc + days * dayWidth;
      }, 0);
    }
  }, [timeSlots, viewMode, dayWidth]);

  const getTaskPosition = (task: Task) => {
    const start = parseISO(task.startDate);
    const end = parseISO(task.endDate);
    const left = differenceInDays(start, minDate) * dayWidth;
    if (task.isMilestone) {
      return { left: left + dayWidth / 2 - MILESTONE_SIZE / 2, width: MILESTONE_SIZE };
    }

    // Task width should be (days + 1) * dayWidth to cover the full end day column
    const width = (differenceInDays(end, start) + 1) * dayWidth;
    return { left, width };
  };

  const handleMouseDown = (e: React.MouseEvent, taskId: string, type: DragType) => {
    if (readOnly) return;
    e.stopPropagation();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const { left, width } = getTaskPosition(task);
    setDragState({
      taskId,
      type,
      startX: e.clientX,
      initialLeft: left,
      initialWidth: width
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState) return;
      const deltaX = e.clientX - dragState.startX;
      setPreviewDelta(deltaX);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!dragState) return;

      const deltaX = e.clientX - dragState.startX;
      const daysDelta = Math.round(deltaX / dayWidth);

      if (daysDelta !== 0) {
        const task = tasks.find(t => t.id === dragState.taskId);
        if (task) {
          if (dragState.type === 'move') {
            const newStart = addBusinessDays(parseISO(task.startDate), daysDelta);
            const newEnd = addBusinessDays(parseISO(task.endDate), daysDelta);
            onUpdateTask(task.id, {
              startDate: format(newStart, 'yyyy-MM-dd'),
              endDate: format(newEnd, 'yyyy-MM-dd')
            });
          } else if (!task.isMilestone && dragState.type === 'resize-start') {
            const newStart = addBusinessDays(parseISO(task.startDate), daysDelta);
            if (newStart <= parseISO(task.endDate)) {
              onUpdateTask(task.id, { startDate: format(newStart, 'yyyy-MM-dd') });
            }
          } else if (!task.isMilestone && dragState.type === 'resize-end') {
            const newEnd = addBusinessDays(parseISO(task.endDate), daysDelta);
            if (newEnd >= parseISO(task.startDate)) {
              onUpdateTask(task.id, { endDate: format(newEnd, 'yyyy-MM-dd'), isMilestone: false });
            }
          }
        }
      }

      setDragState(null);
      setPreviewDelta(0);
    };

    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, dayWidth, tasks, onUpdateTask]);

  useEffect(() => {
    if (containerRef.current) {
      const today = startOfDay(new Date());
      const daysFromMin = differenceInDays(today, minDate);
      const scrollLeft = daysFromMin * dayWidth - 100; // Offset by 100px to show a bit of the past
      containerRef.current.scrollLeft = Math.max(0, scrollLeft);
    }
  }, [minDate, dayWidth]);

  const months = useMemo(() => {
    return eachMonthOfInterval({ start: minDate, end: maxDate });
  }, [minDate, maxDate]);

  return (
    <div 
      ref={containerRef}
      className="flex-1 overflow-auto bg-white relative border-l border-gray-100"
    >
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100 flex flex-col">
        {/* Month Row */}
        <div className="flex h-8 border-b border-gray-50">
          {months.map((month, i) => {
            const monthStart = startOfMonth(month);
            const monthEnd = endOfMonth(month);
            // Calculate width based on days in month that are within our range
            const displayStart = monthStart < minDate ? minDate : monthStart;
            const displayEnd = monthEnd > maxDate ? maxDate : monthEnd;
            const daysInMonth = differenceInDays(addDays(displayEnd, 1), displayStart);
            const width = daysInMonth * dayWidth;

            return (
              <div
                key={i}
                className="border-r border-gray-50 flex items-center justify-start px-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 shrink-0"
                style={{ width }}
              >
                {format(month, 'MMMM yyyy')}
              </div>
            );
          })}
        </div>
        {/* Day/Week Row */}
        <div className="flex h-8">
          {timeSlots.map((date, i) => {
            let label = '';
            let width = dayWidth;
            if (viewMode === 'day') {
              label = format(date, 'dd');
            } else if (viewMode === 'week') {
              const monday = startOfWeek(date, { weekStartsOn: 1 });
              label = `WK ${format(monday, 'w')} (${format(monday, 'dd MMM')})`;
              width = 7 * dayWidth;
            } else {
              label = format(date, 'MMM yyyy');
              const daysInMonth = differenceInDays(addDays(endOfMonth(date), 1), startOfMonth(date));
              width = daysInMonth * dayWidth;
            }

            const isWeekend = viewMode === 'day' && (format(date, 'i') === '6' || format(date, 'i') === '7');

            return (
              <div
                key={i}
                className={`border-r border-gray-50 flex items-center justify-center text-[9px] font-bold uppercase tracking-wider shrink-0 transition-colors ${
                  isWeekend ? 'bg-gray-100/30 text-gray-400' : 'text-gray-400'
                }`}
                style={{ width }}
              >
                {label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid Lines */}
      <div className="absolute inset-0 pointer-events-none flex" style={{ width: totalWidth }}>
        {eachDayOfInterval({ start: minDate, end: maxDate }).map((date, i) => {
          const isWeekend = format(date, 'i') === '6' || format(date, 'i') === '7';
          const isMonday = format(date, 'i') === '1';
          return (
            <div
              key={i}
              className={`h-full border-r border-gray-50/50 ${
                isMonday ? 'border-l border-l-gray-300 z-10' : ''
              } ${isWeekend ? 'bg-gray-50/40' : ''}`}
              style={{ width: dayWidth }}
            />
          );
        })}
      </div>

      {/* Today Line */}
      <div
        className="absolute top-0 bottom-0 w-px bg-red-400 z-10"
        style={{ left: differenceInDays(startOfDay(new Date()), minDate) * dayWidth }}
      >
        <div className="w-2 h-2 rounded-full bg-red-400 -ml-[3.5px] mt-[-4px]" />
      </div>

      {/* Tasks */}
      <div className="relative pt-2 pb-20" style={{ width: totalWidth }}>
        {tasks.map((task, index) => {
          let { left, width } = getTaskPosition(task);
          const isDraggingThis = dragState?.taskId === task.id;
          const isMilestone = Boolean(task.isMilestone);

          if (isDraggingThis) {
            if (dragState.type === 'move') {
              left += previewDelta;
            } else if (!isMilestone && dragState.type === 'resize-start') {
              left += previewDelta;
              width -= previewDelta;
            } else if (!isMilestone && dragState.type === 'resize-end') {
              width += previewDelta;
            }
          }

          return (
            <div key={task.id} className="h-8 flex items-center relative group">
              {!parentIds.has(task.id) && (
                isMilestone ? (
                  <motion.div
                    layoutId={task.id}
                    onMouseDown={(e) => handleMouseDown(e, task.id, 'move')}
                    className={`absolute bg-gray-950 shadow-sm select-none rotate-45 ${
                      readOnly ? 'cursor-default' : 'cursor-move'
                    } ${isDraggingThis ? 'z-30 ring-4 ring-gray-900/10' : ''}`}
                    style={{ left, width, height: MILESTONE_SIZE }}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    title={`${task.name} milestone`}
                  />
                ) : (
                  <motion.div
                    layoutId={task.id}
                    onMouseDown={(e) => handleMouseDown(e, task.id, 'move')}
                    className={`absolute h-4.5 rounded-full flex items-center px-2 shadow-xs select-none ${
                      readOnly ? 'cursor-default' : 'cursor-move'
                    } ${
                      isDraggingThis ? 'bg-blue-600 z-30' : 'bg-blue-500/20 border border-blue-500/30'
                    }`}
                    style={{ left, width }}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    {/* Resize Handles */}
                    <div 
                      onMouseDown={(e) => handleMouseDown(e, task.id, 'resize-start')}
                      className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-full ${
                        readOnly ? 'cursor-default' : 'cursor-ew-resize hover:bg-blue-500/50'
                      }`}
                    />
                    <div 
                      onMouseDown={(e) => handleMouseDown(e, task.id, 'resize-end')}
                      className={`absolute right-0 top-0 bottom-0 w-1.5 rounded-r-full ${
                        readOnly ? 'cursor-default' : 'cursor-ew-resize hover:bg-blue-500/50'
                      }`}
                    />
                  </motion.div>
                )
              )}
              {/* Permanent Label to the right as requested */}
              {!isDraggingThis && (
                <div 
                  className={`absolute text-[10px] whitespace-nowrap ${parentIds.has(task.id) ? 'font-black text-gray-900 uppercase tracking-tight' : 'font-bold text-gray-400'}`}
                  style={{ left: parentIds.has(task.id) ? 12 : left + width + 8 }}
                >
                  {task.name}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GanttView;
