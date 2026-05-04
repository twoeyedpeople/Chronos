import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Add selectedMilestonePersonIds state
if (!content.includes('selectedMilestonePersonIds')) {
  content = content.replace(
    /const \[selectedMilestoneProjectIds, setSelectedMilestoneProjectIds\] = useState<string\[\] \| null>\(null\);/,
    'const [selectedMilestoneProjectIds, setSelectedMilestoneProjectIds] = useState<string[] | null>(null);\n  const [selectedMilestonePersonIds, setSelectedMilestonePersonIds] = useState<string[] | null>(null);'
  );
}

// 2. Update visibleTasks memo
const oldVisibleTasks = `  const visibleTasks = useMemo(() => {
    if (!isGlobalMilestonesView || selectedMilestoneProjectIds === null) {
      return project.tasks;
    }

    return project.tasks.filter((task) => {
      if (!task.sourceProjectId) return false;
      return selectedMilestoneProjectIds.includes(task.sourceProjectId);
    });
  }, [isGlobalMilestonesView, project.tasks, selectedMilestoneProjectIds]);`;

const newVisibleTasks = `  const visibleTasks = useMemo(() => {
    if (!isGlobalMilestonesView) {
      return project.tasks;
    }

    return project.tasks.filter((task) => {
      let projectMatch = true;
      let personMatch = true;

      if (selectedMilestoneProjectIds !== null) {
        if (!task.sourceProjectId) {
          projectMatch = false;
        } else {
          projectMatch = selectedMilestoneProjectIds.includes(task.sourceProjectId);
        }
      }

      if (selectedMilestonePersonIds !== null) {
        personMatch = !!task.assigneeId && selectedMilestonePersonIds.includes(task.assigneeId);
      }

      return projectMatch && personMatch;
    });
  }, [isGlobalMilestonesView, project.tasks, selectedMilestoneProjectIds, selectedMilestonePersonIds]);`;

content = content.replace(oldVisibleTasks, newVisibleTasks);

// 3. Replace the Modal body starting from the second <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-4">
const oldModalBodyRegex = /<div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-4">[\s\S]*?<\/div>\n          <\/div>\n        <\/div>\n      \)}/m;

const newModalBody = `<div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-4">
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.14em]">
                Filters Applied
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedMilestoneProjectIds([]);
                    setSelectedMilestonePersonIds([]);
                  }}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-gray-500 hover:text-[#FF7119] hover:bg-[#FF7119]/10 transition-all"
                >
                  Clear All
                </button>
                <button
                  onClick={() => {
                    setSelectedMilestoneProjectIds(milestoneFilterProjects.map((project) => project.id));
                    setSelectedMilestonePersonIds(people.map(p => p.id));
                  }}
                  className="px-3 py-1.5 rounded-lg bg-gray-950 text-white text-[12px] font-bold hover:bg-[#FF7119] transition-all"
                >
                  Select All
                </button>
              </div>
            </div>

            <div className="flex flex-col md:flex-row max-h-[60vh] overflow-hidden">
              {/* People Column */}
              <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-gray-100 overflow-y-auto px-5 py-4">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-3">People</h3>
                <div className="flex flex-col gap-2">
                  {people.map(person => {
                    const checked = selectedMilestonePersonIds?.includes(person.id) ?? true;
                    return (
                      <label
                        key={person.id}
                        className={\`flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 transition-all cursor-pointer \${
                          checked
                            ? 'border-[#FF7119]/30 bg-[#FF7119]/10 shadow-[inset_0_0_0_1px_rgba(255,113,25,0.3)]'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/40'
                        }\`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              setSelectedMilestonePersonIds((previous) => {
                                const current = previous ?? people.map(p => p.id);
                                if (event.target.checked) {
                                  return current.includes(person.id) ? current : [...current, person.id];
                                }
                                return current.filter((id) => id !== person.id);
                              });
                            }}
                            className="h-3.5 w-3.5 rounded border-gray-300 accent-[#FF7119] shrink-0"
                          />
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: person.color }} />
                            <div className="text-[13px] font-bold text-gray-900 truncate leading-tight">{person.name}</div>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Projects Column */}
              <div className="w-full md:w-2/3 overflow-y-auto px-5 py-4">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-3">Projects</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {milestoneFilterProjects.map((filterProject) => {
                    const checked = selectedMilestoneProjectIds?.includes(filterProject.id) ?? true;
                    const milestoneCount = project.tasks.filter((task) => task.sourceProjectId === filterProject.id).length;

                    return (
                      <label
                        key={filterProject.id}
                        className={\`flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 transition-all cursor-pointer \${
                          checked
                            ? 'border-[#FF7119]/30 bg-[#FF7119]/10 shadow-[inset_0_0_0_1px_rgba(255,113,25,0.3)]'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/40'
                        }\`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              setSelectedMilestoneProjectIds((previous) => {
                                const current = previous ?? milestoneFilterProjects.map((item) => item.id);
                                if (event.target.checked) {
                                  return current.includes(filterProject.id) ? current : [...current, filterProject.id];
                                }
                                return current.filter((id) => id !== filterProject.id);
                              });
                            }}
                            className="h-3.5 w-3.5 rounded border-gray-300 accent-[#FF7119] shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-[13px] font-bold text-gray-900 truncate leading-tight">{filterProject.name}</div>
                            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 mt-1">{milestoneCount} milestones</div>
                          </div>
                        </div>
                        <div className={\`h-2.5 w-2.5 rounded-full shrink-0 transition-colors \${checked ? 'bg-[#FF7119]' : 'bg-gray-200'}\`} />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}`;

content = content.replace(oldModalBodyRegex, newModalBody);

fs.writeFileSync('src/App.tsx', content, 'utf-8');
