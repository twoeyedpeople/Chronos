import fs from 'fs';

// 1. ListView.tsx
let listContent = fs.readFileSync('src/components/ListView.tsx', 'utf-8');

listContent = listContent.replace(/const DARK_COLORS[\s\S]*?getDarkColor = .*;\n\n/, '');

listContent = listContent.replace(
  /'h-\[20px\] px-2 rounded-md border-transparent text-\[9px\] font-bold shadow-sm hover:opacity-90'/g,
  "'h-[20px] px-2 rounded-md border-transparent text-[9px] font-bold text-white shadow-sm hover:opacity-90'"
);
listContent = listContent.replace(
  /style=\{assignee \? \{ backgroundColor: assignee\.color, color: getDarkColor\(assignee\.color\) \} : \{\}\}/g,
  "style={assignee ? { backgroundColor: assignee.color } : {}}"
);
listContent = listContent.replace(
  /className="px-2 h-\[20px\] flex items-center justify-center rounded-md text-\[9px\] font-bold shadow-sm"/g,
  'className="px-2 h-[20px] flex items-center justify-center rounded-md text-[9px] font-bold text-white shadow-sm"'
);
listContent = listContent.replace(
  /style=\{\{ backgroundColor: assignee\.color, color: getDarkColor\(assignee\.color\) \}\}/g,
  "style={{ backgroundColor: assignee.color }}"
);

fs.writeFileSync('src/components/ListView.tsx', listContent, 'utf-8');

// 2. GanttView.tsx
let ganttContent = fs.readFileSync('src/components/GanttView.tsx', 'utf-8');

ganttContent = ganttContent.replace(/const DARK_COLORS[\s\S]*?getDarkColor = .*;\n\n/, '');

ganttContent = ganttContent.replace(
  /<span className="text-\[8px\] font-bold truncate z-10 pointer-events-none drop-shadow-sm px-1" style=\{\{ color: getDarkColor\(assignee\.color\) \}\}>/g,
  '<span className="text-[8px] font-bold text-white truncate z-10 pointer-events-none drop-shadow-sm px-1">'
);

fs.writeFileSync('src/components/GanttView.tsx', ganttContent, 'utf-8');
