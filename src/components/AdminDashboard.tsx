import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Project } from '../types';
import { Plus, Folder, Calendar, User, ExternalLink, Search, Trash2, Pencil } from 'lucide-react';
import { format } from 'date-fns';

const GLOBAL_MILESTONES_SEARCH_TEXT = 'global milestones agency overview milestone tracker';
const FEATURED_PROJECT_NAME = '2-EP New Business';

const AdminDashboard: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string, name: string } | null>(null);
  const [projectToEdit, setProjectToEdit] = useState<{ id: string, name: string, clientName: string } | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'projects'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Project[];
      setProjects(projectsData);
    });
    return () => unsub();
  }, []);

  const navigateToProject = (url: string) => {
    window.location.assign(url);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName || !newClientName) return;

    setIsCreating(true);
    try {
      const projectRef = doc(collection(db, 'projects'));
      const newProject: Partial<Project> = {
        id: projectRef.id,
        name: newProjectName,
        clientName: newClientName,
        tasks: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await setDoc(projectRef, newProject);
      navigateToProject(`${window.location.origin}${window.location.pathname}?p=${projectRef.id}&edit=1`);
      
      setIsModalOpen(false);
      setNewProjectName('');
      setNewClientName('');
    } catch (error) {
      console.error("Error creating project:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;

    try {
      await deleteDoc(doc(db, 'projects', projectToDelete.id));
      window.localStorage.removeItem(`project_${projectToDelete.id}`);
      setProjectToDelete(null);
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const confirmDelete = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    setProjectToDelete({ id, name });
  };

  const openEditModal = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setProjectToEdit({
      id: project.id,
      name: project.name,
      clientName: project.clientName,
    });
    setNewProjectName(project.name);
    setNewClientName(project.clientName);
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectToEdit || !newProjectName || !newClientName) return;

    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'projects', projectToEdit.id), {
        name: newProjectName,
        clientName: newClientName,
        updatedAt: Date.now(),
      });
      setProjectToEdit(null);
      setNewProjectName('');
      setNewClientName('');
    } catch (error) {
      console.error('Error updating project:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredProjects = projects
    .filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.clientName.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const aFeatured = a.name === FEATURED_PROJECT_NAME ? 0 : 1;
      const bFeatured = b.name === FEATURED_PROJECT_NAME ? 0 : 1;
      if (aFeatured !== bFeatured) return aFeatured - bFeatured;
      return b.updatedAt - a.updatedAt;
    });
  const showGlobalMilestonesCard =
    searchQuery.trim() === '' || GLOBAL_MILESTONES_SEARCH_TEXT.includes(searchQuery.trim().toLowerCase());

  const getProjectTimeline = (project: Project) => {
    if (!project.tasks || project.tasks.length === 0) {
      return null;
    }

    const startTimes = project.tasks.map((task) => new Date(task.startDate).getTime());
    const endTimes = project.tasks.map((task) => new Date(task.endDate).getTime());

    return {
      start: new Date(Math.min(...startTimes)),
      end: new Date(Math.max(...endTimes)),
    };
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <img 
              src="https://twoeyedpeople.com/img/2EP_Logotype.svg" 
              alt="Two-Eyed People" 
              className="h-6 mb-4 opacity-80"
              referrerPolicy="no-referrer"
            />
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Project Dashboard</h1>
            <p className="text-gray-500 font-medium mt-1 uppercase text-[10px] tracking-[0.12em]">Live project timelines and key milestones</p>
          </div>
          
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-3 px-6 py-4 bg-blue-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-200 hover:scale-105 transition-all active:scale-95 shrink-0"
          >
            <Plus size={20} />
            <span>Create New Project</span>
          </button>
        </div>

        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search projects or clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-gray-800 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all shadow-sm"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {showGlobalMilestonesCard && (
            <div
              onClick={() => navigateToProject(`${window.location.origin}${window.location.pathname}?global=milestones`)}
              className="group bg-[#FFF3FC] border border-pink-100 rounded-[24px] p-4 hover:shadow-2xl hover:shadow-pink-200/40 transition-all cursor-pointer relative overflow-hidden min-h-[146px]"
            >
              <div className="flex flex-col gap-2 relative z-10 h-full">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 min-w-0 flex-1 pr-3">
                    <div className="w-9 h-9 rounded-2xl bg-white/80 flex items-center justify-center text-pink-500 group-hover:scale-110 transition-transform border border-pink-100 shrink-0">
                      <Calendar size={18} />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <h3 className="text-[16px] font-black text-gray-900 tracking-tight leading-tight mb-1 group-hover:text-pink-600 transition-colors truncate">
                        All Milestones
                      </h3>
                      <div className="flex items-center gap-2 text-pink-300">
                        <User size={12} />
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] truncate">Agency View</span>
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/80 border border-pink-100 text-[8px] leading-none font-black uppercase tracking-[0.12em] text-pink-500">
                    Read Only
                  </span>
                </div>

                <div className="mt-auto flex items-end justify-between pt-2 border-t border-pink-100/70">
                  <div className="flex flex-col gap-1.5 text-pink-300">
                    <div className="flex items-center gap-2">
                      <Calendar size={11} />
                      <span className="text-[9px] font-bold">All active project milestones</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-pink-500 font-black text-[9px] uppercase tracking-[0.16em] opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                    <span>Open</span>
                    <ExternalLink size={10} />
                  </div>
                </div>
              </div>

              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-pink-200/30 rounded-full blur-2xl group-hover:bg-pink-200/50 transition-colors" />
            </div>
          )}

          {filteredProjects.map((project) => (
            <div
              key={project.id}
              onClick={() => navigateToProject(`${window.location.origin}${window.location.pathname}?p=${project.id}&edit=1`)}
              className={`group border rounded-[24px] p-4 transition-all cursor-pointer relative overflow-hidden min-h-[146px] ${
                project.name === FEATURED_PROJECT_NAME
                  ? 'bg-[#FFFBE8] border-yellow-100 hover:shadow-2xl hover:shadow-yellow-200/40'
                  : 'bg-white border-gray-100 hover:shadow-2xl hover:shadow-blue-500/5'
              }`}
            >
              <div className="flex flex-col gap-2 relative z-10 h-full">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 min-w-0 flex-1 pr-3">
                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform shrink-0 ${
                      project.name === FEATURED_PROJECT_NAME ? 'bg-yellow-50' : 'bg-blue-50'
                    }`}>
                      <Folder size={18} />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <h3 className={`text-[16px] font-black text-gray-900 tracking-tight leading-tight mb-1 transition-colors truncate ${
                        project.name === FEATURED_PROJECT_NAME ? 'group-hover:text-yellow-600' : 'group-hover:text-blue-600'
                      }`}>
                        {project.name}
                      </h3>
                      <div className="flex items-center gap-2 text-gray-400">
                        <User size={12} />
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] truncate">{project.clientName}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={(e) => openEditModal(e, project)}
                      className="p-2 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                      title="Edit project"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={(e) => confirmDelete(e, project.id, project.name)}
                      className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete project"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className={`mt-auto flex items-end justify-between pt-2 ${
                  project.name === FEATURED_PROJECT_NAME ? 'border-t border-yellow-100/70' : 'border-t border-gray-50'
                }`}>
                  <div className="flex flex-col gap-1.5 text-gray-400">
                    {(() => {
                      const timeline = getProjectTimeline(project);
                      return timeline ? (
                        <>
                          <div className="flex items-center gap-2">
                            <Calendar size={11} className="text-blue-400" />
                            <span className="text-[9px] font-bold">{format(timeline.start, 'MMM dd, yyyy')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar size={11} className="text-red-400" />
                            <span className="text-[9px] font-bold">{format(timeline.end, 'MMM dd, yyyy')}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Calendar size={11} />
                          <span className="text-[9px] font-bold">No timeline yet</span>
                        </div>
                      );
                    })()}
                  </div>
                  <div className={`flex items-center gap-1 font-black text-[9px] uppercase tracking-[0.16em] opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0 ${
                    project.name === FEATURED_PROJECT_NAME ? 'text-yellow-600' : 'text-blue-500'
                  }`}>
                    <span>Open</span>
                    <ExternalLink size={10} />
                  </div>
                </div>
              </div>
              
              {/* Decorative background */}
              <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-2xl transition-colors ${
                project.name === FEATURED_PROJECT_NAME
                  ? 'bg-yellow-200/30 group-hover:bg-yellow-200/50'
                  : 'bg-blue-500/5 group-hover:bg-blue-500/10'
              }`} />
            </div>
          ))}

          {filteredProjects.length === 0 && !showGlobalMilestonesCard && (
            <div className="col-span-full py-24 flex flex-col items-center justify-center text-gray-300 gap-4">
              <Folder size={64} className="opacity-10" />
              <p className="text-sm font-bold tracking-tight">No projects found matching your search.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-6">Create New Project</h2>
            
            <form onSubmit={handleCreateProject} className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Client Name</label>
                <input
                  autoFocus
                  type="text"
                  required
                  placeholder="e.g. Acme Corp"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 px-5 text-sm font-bold text-gray-800 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q2 Marketing Campaign"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 px-5 text-sm font-bold text-gray-800 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all"
                />
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black text-sm hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-[2] px-6 py-4 bg-blue-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-200 hover:scale-105 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {projectToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-md"
            onClick={() => setProjectToDelete(null)}
          />
          <div className="relative bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mb-6">
              <Trash2 size={32} />
            </div>

            <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-2">Delete Project?</h2>
            <p className="text-gray-500 font-medium mb-8">
              Are you sure you want to delete <span className="text-gray-900 font-bold">"{projectToDelete.name}"</span>? This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setProjectToDelete(null)}
                className="flex-1 px-6 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black text-sm hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProject}
                className="flex-1 px-6 py-4 bg-red-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-red-200 hover:scale-105 transition-all active:scale-95"
              >
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}

      {projectToEdit && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            onClick={() => setProjectToEdit(null)}
          />
          <div className="relative bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-6">Edit Project</h2>

            <form onSubmit={handleUpdateProject} className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Client Name</label>
                <input
                  autoFocus
                  type="text"
                  required
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 px-5 text-sm font-bold text-gray-800 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 px-5 text-sm font-bold text-gray-800 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all"
                />
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setProjectToEdit(null)}
                  className="flex-1 px-6 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black text-sm hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-[2] px-6 py-4 bg-blue-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-200 hover:scale-105 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
