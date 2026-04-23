export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface Task {
  id: string;
  name: string;
  startDate: string; // ISO string
  endDate: string; // ISO string
  parentId?: string | null;
  color?: string;
  isExpanded?: boolean;
  isMilestone?: boolean;
  dependencyId?: string;
  dependencyType?: DependencyType;
}

export interface Project {
  id: string;
  name: string;
  clientName: string;
  tasks: Task[];
  createdAt: number;
  updatedAt: number;
}

export type ViewMode = 'day' | 'week' | 'month';
export type MainViewMode = 'list' | 'gantt';
