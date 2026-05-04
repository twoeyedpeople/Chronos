import fs from 'fs';

const files = [
  'src/components/AdminDashboard.tsx',
  'src/components/ListView.tsx',
  'src/components/GanttView.tsx',
  'src/components/PeopleView.tsx',
  'src/App.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf-8');
  
  // Pink
  content = content.replace(/bg-pink-[0-9]+(\/[0-9]+)?/g, 'bg-[#FFC2E8]$1');
  content = content.replace(/text-pink-[0-9]+/g, 'text-[#FFC2E8]');
  content = content.replace(/border-pink-[0-9]+(\/[0-9]+)?/g, 'border-[#FFC2E8]$1');
  content = content.replace(/shadow-pink-[0-9]+(\/[0-9]+)?/g, 'shadow-[#FFC2E8]$1');
  content = content.replace(/accent-pink-[0-9]+/g, 'accent-[#FFC2E8]');
  content = content.replace(/ring-pink-[0-9]+(\/[0-9]+)?/g, 'ring-[#FFC2E8]$1');
  content = content.replace(/bg-\[\#FFF3FC\]/g, 'bg-[#FFC2E8]/20');
  content = content.replace(/text-\[\#FF69B4\]/g, 'text-[#FFC2E8]');
  
  // Green
  content = content.replace(/bg-green-[0-9]+(\/[0-9]+)?/g, 'bg-[#3DDA7B]$1');
  content = content.replace(/text-green-[0-9]+/g, 'text-[#3DDA7B]');
  content = content.replace(/border-green-[0-9]+(\/[0-9]+)?/g, 'border-[#3DDA7B]$1');
  content = content.replace(/shadow-green-[0-9]+(\/[0-9]+)?/g, 'shadow-[#3DDA7B]$1');
  content = content.replace(/ring-green-[0-9]+(\/[0-9]+)?/g, 'ring-[#3DDA7B]$1');
  content = content.replace(/bg-\[\#F0FDF4\]/g, 'bg-[#3DDA7B]/20');

  // Specific contrast fixes
  content = content.replace(/bg-\[\#FFC2E8\] text-white/g, 'bg-[#FFC2E8] text-gray-900');
  
  fs.writeFileSync(file, content, 'utf-8');
});
