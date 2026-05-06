import React from 'react';
import { Home, RotateCcw, Share2, ZoomIn, ZoomOut, LayoutList, GanttChart, Download, SlidersHorizontal, User, Search } from 'lucide-react';
import { MainViewMode, ViewMode } from '../types';

interface HeaderProps {
  projectName: string;
  clientName: string;
  onProjectNameChange: (name: string) => void;
  onClientNameChange: (name: string) => void;
  onSave: () => void;
  onShare: () => void;
  onHome: () => void;
  onMilestonesClick?: (isKiosk?: boolean) => void;
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
  hideMainViewToggle?: boolean;
  isKioskView?: boolean;
}

const Header: React.FC<HeaderProps> = ({ 
  projectName, 
  clientName,
  onProjectNameChange, 
  onClientNameChange,
  onSave,
  onShare,
  onHome,
  onMilestonesClick,
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
  isMobile,
  hideMainViewToggle,
  isKioskView,
}) => {
  return (
    <header className={`px-4 md:px-8 bg-white/95 backdrop-blur-2xl border-b border-gray-100 flex items-center justify-between sticky top-0 z-50 overflow-x-auto no-scrollbar w-full ${showFiltersButton ? 'h-[105px]' : 'h-20'}`}>
      <div className="flex items-center gap-4 md:gap-5 flex-1 min-w-0">
        {showFiltersButton ? (
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-[20px] bg-white border border-gray-100 flex items-center justify-center shrink-0 shadow-sm">
              <img
                src="/apple-touch-icon.png"
                alt="Two-Eyed People"
                className="w-10 h-10 object-contain rounded-md"
              />
            </div>
            <div className="min-w-0 flex flex-col -ml-1">
              <h1 className="text-[36px] leading-[36px] font-davinci font-normal text-gray-900 tracking-[-0.045em] translate-y-[2px] -translate-x-[1.5px]">Chronos</h1>
              <p className="text-gray-500 font-medium text-[13px] tracking-normal mt-0.5 -translate-y-[1px]">The Organisational Oracle</p>
            </div>
          </div>
        ) : (
          <>
            <div className="w-10 h-10 md:w-11 md:h-11 rounded-2xl bg-white border border-gray-100 flex items-center justify-center shrink-0">
              <img
                src="/apple-touch-icon.png"
                alt="Two-Eyed People"
                className="w-7 h-7 md:w-8 md:h-8 object-contain rounded-md"
              />
            </div>

            <div className="flex flex-col items-start justify-center gap-0 min-w-[170px] -mt-0.5 -ml-[13px]">
              <input
                type="text"
                value={projectName}
                onChange={(e) => onProjectNameChange(e.target.value)}
                readOnly={readOnly}
                className="font-davinci font-normal text-[24px] leading-none tracking-[-0.045em] text-gray-900 bg-transparent border-none focus:ring-0 placeholder-gray-300 p-0 min-w-[150px] max-w-[240px] md:max-w-[320px]"
                placeholder="Project Name..."
              />
              {(clientName || !readOnly) && (
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => onClientNameChange(e.target.value)}
                  readOnly={readOnly}
                  className="-mt-0.5 text-[14px] font-arial font-medium text-gray-400 bg-transparent border-none focus:ring-0 placeholder-gray-200 tracking-normal p-0 leading-tight min-w-[80px] max-w-[220px]"
                  placeholder="Client..."
                />
              )}
            </div>
          </>
        )}

      </div>

      <div className="flex items-center justify-center gap-3 md:gap-4 shrink-0 mx-4">
        <button
          onClick={onHome}
          disabled={isSaving}
          className="w-9 h-9 rounded-full border border-gray-100 bg-gray-50/80 text-gray-400 hover:text-blue-600 hover:bg-white  transition-all flex items-center justify-center disabled:opacity-50 shrink-0"
          title="Save and return home"
        >
          <Home size={15} className="translate-y-[1px]" />
        </button>

        {!isMobile && !hideMainViewToggle && (
          <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-2xl p-1 shrink-0 h-[36px]">
            <button
              onClick={() => onMainViewModeChange('list')}
              className={`flex items-center justify-center gap-1.5 px-3 rounded-xl text-[11px] font-bold h-full transition-all ${
                mainViewMode === 'list' 
                  ? 'bg-white text-gray-800 ' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <LayoutList size={13} />
              <span>List</span>
            </button>
            <button
              onClick={() => onMainViewModeChange('gantt')}
              className={`flex items-center justify-center gap-1.5 px-3 rounded-xl text-[11px] font-bold h-full transition-all ${
                mainViewMode === 'gantt' 
                  ? 'bg-white text-blue-600 ' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <GanttChart size={13} />
              <span>Gantt</span>
            </button>
          </div>
        )}

        {!isMobile && !hideMainViewToggle && !readOnly && (
          <div className="flex items-center gap-3 md:gap-4">
            <button
              onClick={() => onMainViewModeChange('people')}
              className={`w-9 h-9 rounded-full border border-gray-100 flex items-center justify-center transition-all shrink-0 ${
                mainViewMode === 'people'
                  ? 'bg-white text-blue-600 '
                  : 'bg-gray-50/80 text-gray-400 hover:text-gray-700 hover:bg-white '
              }`}
              title="Manage People"
            >
              <User size={15} className="translate-y-[1px]" />
            </button>
            <button
              onClick={() => {
                if (onMilestonesClick) {
                  onMilestonesClick();
                } else {
                  window.location.assign(`${window.location.origin}${window.location.pathname}?global=milestones`);
                }
              }}
              className="w-9 h-9 rounded-full border border-gray-100 flex items-center justify-center transition-all shrink-0 bg-gray-50/80 text-gray-400 hover:text-gray-700 hover:bg-white "
              title="Milestone View"
            >
              <div className="w-3.5 h-3.5 border-[1.5px] border-current rounded-[1.5px] rotate-45 translate-y-[1px]" />
            </button>
          </div>
        )}

        {showFiltersButton && (
          <div className="flex items-center gap-3 md:gap-4">
            <button
              onClick={onOpenFilters}
              className="w-9 h-9 rounded-xl border border-gray-100 bg-gray-50 text-gray-500 hover:text-gray-800 hover:bg-white  transition-all flex items-center justify-center relative shrink-0"
              title="Filters"
            >
              <SlidersHorizontal size={15} className="translate-y-[1px]" />
            </button>
            <button
              onClick={() => {
                if (onMilestonesClick) {
                  onMilestonesClick(isKioskView ? false : true);
                } else {
                  if (isKioskView) {
                    window.location.assign(`${window.location.origin}${window.location.pathname}?global=milestones`);
                  } else {
                    window.location.assign(`${window.location.origin}${window.location.pathname}?global=milestones-kiosk`);
                  }
                }
              }}
              className="w-9 h-9 rounded-xl border border-gray-100 bg-gray-50 text-gray-500 hover:text-gray-800 hover:bg-white  transition-all flex items-center justify-center relative shrink-0"
              title={isKioskView ? "Exit Kiosk View" : "Kiosk View"}
            >
              {isKioskView ? <ZoomOut size={15} className="translate-y-[1px]" /> : <ZoomIn size={15} className="translate-y-[1px]" />}
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 md:gap-5 flex-1 min-w-0 justify-end shrink-0">
        {mainViewMode === 'gantt' && (
          <>
            <div className="flex items-center gap-0.5 bg-gray-50 p-0.5 rounded-full border border-gray-100">
              {(['day', 'week', 'month'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onViewModeChange(mode)}
                  className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all ${
                    viewMode === mode 
                      ? 'bg-white text-blue-600 ' 
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
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.18em] whitespace-nowrap">
                View Only
              </span>
              <button
                onClick={onDownloadPdf}
                className="w-8 h-8 bg-[#FFC2E8] rounded-xl transition-all   active:scale-95 shrink-0 flex items-center justify-center hover:opacity-90 overflow-hidden"
                title="Download PDF"
              >
                <img 
                  src="/download-icon.png" 
                  alt="Download" 
                  className="w-8 h-8 object-cover rounded-full scale-[0.75] mix-blend-screen" 
                />
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
              className="flex items-center gap-2 px-[14px] py-[7px] bg-[#FFC2E8] hover:bg-[#ffb0df] text-[#C21A88] rounded-xl font-arial font-bold uppercase tracking-tight text-[13px] transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-[#C21A88]/30 border-t-[#C21A88] rounded-full animate-spin" />
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
