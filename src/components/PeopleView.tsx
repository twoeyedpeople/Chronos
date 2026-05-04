import React, { useState } from 'react';
import { Person } from '../types';
import { Plus, Pencil, ArrowLeft, Trash2, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface PeopleViewProps {
  people: Person[];
  onAddPerson: (person: Person) => void;
  onUpdatePerson: (id: string, updates: Partial<Person>) => void;
  onDeletePerson: (id: string) => void;
  onClose: () => void;
}

const PeopleView: React.FC<PeopleViewProps> = ({
  people,
  onAddPerson,
  onUpdatePerson,
  onDeletePerson,
  onClose,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3B82F6');

  const openAddModal = () => {
    setEditingPerson(null);
    setName('');
    setColor('#3B82F6');
    setIsModalOpen(true);
  };

  const openEditModal = (person: Person) => {
    setEditingPerson(person);
    setName(person.name);
    setColor(person.color);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingPerson) {
      onUpdatePerson(editingPerson.id, { name: name.trim(), color });
    } else {
      onAddPerson({
        id: uuidv4(),
        name: name.trim(),
        color,
        createdAt: Date.now(),
      });
    }
    setIsModalOpen(false);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this person?')) {
      onDeletePerson(id);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 h-screen overflow-hidden">
      <header className="h-20 px-4 md:px-8 bg-white/95 backdrop-blur-2xl border-b border-gray-100 flex items-center justify-between sticky top-0 z-50 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full border border-gray-100 bg-gray-50/80 text-gray-400 hover:text-blue-600 hover:bg-white hover:shadow-sm transition-all flex items-center justify-center shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-[20px] leading-tight font-black text-gray-900 tracking-tight">People Directory</h1>
            <p className="text-gray-400 font-medium text-[11px] uppercase tracking-widest mt-0.5">Manage Team Resources</p>
          </div>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-[18px] py-[10px] bg-pink-400 text-white rounded-xl font-black text-[15px] leading-4 shadow-sm hover:scale-[1.02] transition-all active:scale-95 shrink-0"
        >
          <Plus size={15} strokeWidth={3} />
          <span className="uppercase tracking-tight">Add Person</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {people.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-400 font-bold text-sm">No people added yet.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_auto] items-center px-6 py-3 border-b border-gray-100 bg-gray-50/50">
                <div className="w-12 text-[10px] font-black text-gray-400 uppercase tracking-widest">Color</div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Name</div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</div>
              </div>
              <div className="divide-y divide-gray-50">
                {people.map((person) => (
                  <div key={person.id} className="grid grid-cols-[auto_1fr_auto] items-center px-6 py-4 hover:bg-gray-50/50 transition-colors group">
                    <div className="w-12">
                      <div 
                        className="w-5 h-5 rounded-full shadow-sm"
                        style={{ backgroundColor: person.color }}
                      />
                    </div>
                    <div className="font-bold text-gray-800 text-[15px]">
                      {person.name}
                    </div>
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditModal(person)}
                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                        title="Edit Person"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, person.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title="Delete Person"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden relative">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-[18px] font-black text-gray-900 tracking-tight">
                {editingPerson ? 'Edit Person' : 'Add New Person'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-5">
                <div>
                  <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold text-gray-800 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                    placeholder="E.g. David"
                    autoFocus
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2">
                    Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-12 h-12 rounded-xl border border-gray-200 cursor-pointer overflow-hidden p-1 bg-white shadow-sm hover:shadow transition-all"
                    />
                    <div className="flex-1">
                      <input
                        type="text"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold text-gray-800 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-mono"
                        pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-8">
                <button
                  type="submit"
                  className="w-full py-4 bg-gray-900 text-white rounded-xl font-black text-[15px] hover:bg-black shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
                >
                  {editingPerson ? 'Save Changes' : 'Add Person'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PeopleView;
