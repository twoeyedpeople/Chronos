import React from 'react';
import { Home, RotateCcw, Share2, ZoomIn, ZoomOut, LayoutList, GanttChart, Download, SlidersHorizontal } from 'lucide-react';
import { MainViewMode, ViewMode } from '../types';

interface HeaderProps {
  projectName: string;
  clientName: string;
  onProjectNameChange: (name: string) => void;
  onClientNameChange: (name: string) => void;
  onSave: () => void;
  onShare: () => void;
  onHome: () => void;
  onUndo: () => void;
  onDownloadPdf: () => void;
  onOpenFilters?: () => void;
  canUndo: boolean;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  mainViewMode: MainViewMode;
  onMainViewModeChange: (mode: MainViewMode) => void;
  isSaving?: boolean;
  readOnly?: boolean;
  showFiltersButton?: boolean;
  activeFilterCount?: number;
  isMobile?: boolean;
}

const Header: React.FC<HeaderProps> = ({ 
  projectName, 
  clientName,
  onProjectNameChange, 
  onClientNameChange,
  onSave,
  onShare,
  onHome,
  onUndo,
  onDownloadPdf,
  onOpenFilters,
  canUndo,
  zoom,
  onZoomChange,
  viewMode,
  onViewModeChange,
  mainViewMode,
  onMainViewModeChange,
  isSaving,
  readOnly,
  showFiltersButton,
  isMobile
}) => {
  return (
    <header className="h-20 px-4 md:px-8 bg-white/95 backdrop-blur-2xl border-b border-gray-100 flex items-center justify-between sticky top-0 z-50 shadow-sm gap-4 overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-4 md:gap-6 shrink-0">
        <img 
          src="https://twoeyedpeople.com/img/2EP_Logotype.svg" 
          alt="Two-Eyed People" 
          className="h-4 object-contain opacity-70 shrink-0"
          referrerPolicy="no-referrer"
        />

        <div className="flex flex-col items-start gap-1 min-w-[170px]">
          <input
            type="text"
            value={projectName}
            onChange={(e) => onProjectNameChange(e.target.value)}
            readOnly={readOnly}
            className="text-[15px] md:text-[16px] font-black text-gray-900 bg-transparent border-none focus:ring-0 placeholder-gray-300 tracking-tight p-0 leading-none min-w-[150px] max-w-[240px] md:max-w-[320px]"
            placeholder="Project Name..."
          />
          <input
            type="text"
            value={clientName}
            onChange={(e) => onClientNameChange(e.target.value)}
            readOnly={readOnly}
            className="text-[9px] font-black text-gray-400 bg-transparent border-none focus:ring-0 placeholder-gray-200 uppercase tracking-[0.18em] p-0 leading-none min-w-[80px] max-w-[220px]"
            placeholder="Client..."
          />
        </div>

        <button
          onClick={onHome}
          disabled={isSaving}
          className="w-9 h-9 rounded-full border border-gray-100 bg-gray-50/80 text-gray-400 hover:text-blue-600 hover:bg-white hover:shadow-sm transition-all flex items-center justify-center disabled:opacity-50 shrink-0"
          title="Save and return home"
        >
          <Home size={15} />
        </button>

        {!isMobile && (
          <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-2xl p-1 shrink-0">
            <button
              onClick={() => onMainViewModeChange('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                mainViewMode === 'list' 
                  ? 'bg-white text-gray-800 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <LayoutList size={13} />
              <span>List</span>
            </button>
            <button
              onClick={() => onMainViewModeChange('gantt')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                mainViewMode === 'gantt' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <GanttChart size={13} />
              <span>Gantt</span>
            </button>
          </div>
        )}

        {showFiltersButton && (
          <button
            onClick={onOpenFilters}
            className="w-9 h-9 rounded-xl border border-gray-100 bg-gray-50 text-gray-500 hover:text-gray-800 hover:bg-white hover:shadow-sm transition-all flex items-center justify-center relative shrink-0"
            title="Filters"
          >
            <SlidersHorizontal size={15} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 md:gap-5 shrink-0">
        {mainViewMode === 'gantt' && (
          <>
            <div className="flex items-center gap-0.5 bg-gray-50 p-0.5 rounded-full border border-gray-100">
              {(['day', 'week', 'month'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onViewModeChange(mode)}
                  className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all ${
                    viewMode === mode 
                      ? 'bg-white text-blue-600 shadow-xs' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-gray-50 p-0.5 rounded-full border border-gray-100">
              <button 
                onClick={() => onZoomChange(Math.max(0.5, zoom - 0.1))}
                className="p-1.5 hover:bg-white hover:text-blue-500 rounded-full transition-all text-gray-400"
              >
                <ZoomOut size={14} />
              </button>
              <span className="text-[9px] font-black text-gray-500 w-8 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button 
                onClick={() => onZoomChange(Math.min(2, zoom + 0.1))}
                className="p-1.5 hover:bg-white hover:text-blue-500 rounded-full transition-all text-gray-400"
              >
                <ZoomIn size={14} />
              </button>
            </div>
          </>
        )}

        <div className="flex items-center gap-2">
          {readOnly && (
            <>
              <button
                onClick={onDownloadPdf}
                className="flex items-center gap-2 px-4 py-2 bg-gray-950 hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-lg hover:shadow-xl active:scale-95 whitespace-nowrap"
              >
                <Download size={14} />
                <span>Download PDF</span>
              </button>
            </>
          )}
          {!readOnly && (
            <>
            <button 
              onClick={onUndo}
              disabled={isSaving || !canUndo}
              className="text-[10px] font-black text-gray-400 hover:text-blue-500 uppercase tracking-widest transition-all px-2 py-1 disabled:opacity-40"
            >
              <span className="inline-flex items-center gap-1">
                <RotateCcw size={12} />
                Undo
              </span>
            </button>
            <button 
              onClick={onSave}
              disabled={isSaving}
              className="text-[10px] font-black text-gray-400 hover:text-blue-500 uppercase tracking-widest transition-all px-2 py-1"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button 
              onClick={onShare}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 whitespace-nowrap"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Share2 size={14} />
              )}
              <span>Share</span>
            </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
