import fs from 'fs';

let adminContent = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf-8');

// Milestones title
adminContent = adminContent.replace(
  '<h3 className="text-[16px] font-black text-gray-900 tracking-tight leading-tight mb-1 group-hover:text-[#FFC2E8] transition-colors truncate">',
  '<h3 className="text-[16px] font-black text-[#C21A88] tracking-tight leading-tight mb-1 transition-colors truncate">'
);

// New Business title and regular project title
adminContent = adminContent.replace(
  '<h3 className={`text-[16px] font-black text-gray-900 tracking-tight leading-tight mb-1 transition-colors truncate ${',
  '<h3 className={`text-[16px] font-black tracking-tight leading-tight mb-1 transition-colors truncate ${'
);
adminContent = adminContent.replace(
  "project.name === FEATURED_PROJECT_NAME ? 'group-hover:text-[#3DDA7B]' : 'group-hover:text-blue-600'",
  "project.name === FEATURED_PROJECT_NAME ? 'text-[#1E8A49]' : 'text-gray-900 group-hover:text-[#C21A88]'"
);

// SPAWN button
adminContent = adminContent.replace(
  'bg-[#FFC2E8] text-gray-900',
  'bg-[#FFC2E8] text-[#C21A88]'
);

// Regular project hovers (change blue to pink)
adminContent = adminContent.replace(/hover:shadow-blue-500\/5/g, 'hover:shadow-[#FFC2E8]/20');
adminContent = adminContent.replace(/bg-blue-50 text-blue-500/g, 'bg-gray-50 text-gray-400 group-hover:bg-[#FFC2E8]/20 group-hover:text-[#C21A88]');
adminContent = adminContent.replace(/text-blue-500/g, 'text-[#C21A88]'); 
adminContent = adminContent.replace(/hover:text-blue-500 hover:bg-blue-50/g, 'hover:text-[#C21A88] hover:bg-[#FFC2E8]/20');
adminContent = adminContent.replace(/bg-blue-500\/5 group-hover:bg-blue-500\/10/g, 'bg-transparent group-hover:bg-[#FFC2E8]/10'); 
adminContent = adminContent.replace(/text-blue-400/g, 'text-[#C21A88]/60');

fs.writeFileSync('src/components/AdminDashboard.tsx', adminContent, 'utf-8');

let peopleContent = fs.readFileSync('src/components/PeopleView.tsx', 'utf-8');

// ADD PERSON button
peopleContent = peopleContent.replace(
  'bg-[#FFC2E8] text-gray-900',
  'bg-[#FFC2E8] text-[#C21A88]'
);

fs.writeFileSync('src/components/PeopleView.tsx', peopleContent, 'utf-8');
