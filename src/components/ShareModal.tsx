import React from 'react';
import { Copy, Check, X, ExternalLink, Share2, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectUrl: string;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, projectUrl }) => {
  const [copied, setCopied] = React.useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(projectUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        >
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                <Share2 size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Share Timeline</h3>
                <p className="text-xs text-gray-500 font-medium">Anyone with the link can view</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-full transition-colors"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          <div className="p-8 space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Project Link</label>
              <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-100 rounded-2xl">
                <Globe size={16} className="text-gray-400 shrink-0" />
                <input
                  type="text"
                  readOnly
                  value={projectUrl}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-600 truncate"
                />
                <button 
                  onClick={copyToClipboard}
                  className={`p-2 rounded-xl transition-all ${
                    copied ? 'bg-green-500 text-white' : 'hover:bg-white text-gray-400 hover:text-blue-500'
                  }`}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <a
                href={projectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 bg-gray-900 hover:bg-black text-white rounded-2xl font-bold text-sm transition-all shadow-xl hover:shadow-2xl flex items-center justify-center gap-3"
              >
                <ExternalLink size={18} />
                <span>Open in New Tab</span>
              </a>
              <p className="text-[10px] text-center text-gray-400 font-medium uppercase tracking-wider">
                Changes are saved automatically to the cloud
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ShareModal;
