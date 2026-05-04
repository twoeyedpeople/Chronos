import fs from 'fs';

const darkColorsCode = `
const DARK_COLORS: Record<string, string> = {
  '#FF7119': '#B84A0A',
  '#FFC2E8': '#C21A88',
  '#FCB928': '#B07C10',
  '#F3F3F3': '#6B7280',
  '#3DDA7B': '#1E8A49',
  '#A663FF': '#5B24A6',
  '#95E6E6': '#2E9999',
};

const getDarkColor = (hex: string) => DARK_COLORS[hex] || '#111827';
`;

// 1. ListView.tsx
let listContent = fs.readFileSync('src/components/ListView.tsx', 'utf-8');

if (!listContent.includes('const DARK_COLORS')) {
  // Insert after imports
  listContent = listContent.replace(/(import .*;\n)+/, match => match + darkColorsCode + '\n');
}

// Replace in AssigneeDropdown
listContent = listContent.replace(
  /'h-\[20px\] px-2 rounded-md border-transparent text-\[9px\] font-bold text-white shadow-sm hover:opacity-90'/g,
  "'h-[20px] px-2 rounded-md border-transparent text-[9px] font-bold shadow-sm hover:opacity-90'"
);
listContent = listContent.replace(
  /style=\{assignee \? \{ backgroundColor: assignee\.color \} : \{\}\}/g,
  "style={assignee ? { backgroundColor: assignee.color, color: getDarkColor(assignee.color) } : {}}"
);

// Replace in Global Milestones Assignee tags
listContent = listContent.replace(
  /className="px-2 h-\[20px\] flex items-center justify-center rounded-md text-\[9px\] font-bold text-white shadow-sm"/g,
  'className="px-2 h-[20px] flex items-center justify-center rounded-md text-[9px] font-bold shadow-sm"'
);
listContent = listContent.replace(
  /style=\{\{ backgroundColor: assignee\.color \}\}/g,
  "style={{ backgroundColor: assignee.color, color: getDarkColor(assignee.color) }}"
);

fs.writeFileSync('src/components/ListView.tsx', listContent, 'utf-8');

// 2. GanttView.tsx
let ganttContent = fs.readFileSync('src/components/GanttView.tsx', 'utf-8');

if (!ganttContent.includes('const DARK_COLORS')) {
  ganttContent = ganttContent.replace(/(import .*;\n)+/, match => match + darkColorsCode + '\n');
}

ganttContent = ganttContent.replace(
  /<span className="text-\[10px\] font-bold text-white px-2 truncate mix-blend-plus-lighter">/g,
  '<span className="text-[10px] font-bold px-2 truncate" style={{ color: getDarkColor(assignee.color) }}>'
);

fs.writeFileSync('src/components/GanttView.tsx', ganttContent, 'utf-8');

// 3. PeopleView.tsx (the color swatch circles might just be background, no text inside)
