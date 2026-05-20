import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outputFiles = [
  path.join(rootDir, 'active-milestones.md'),
  path.join(rootDir, 'public', 'active-milestones.md'),
];
const timezone = process.env.CHRONOS_MILESTONE_TIMEZONE || 'Australia/Sydney';
const bearerToken =
  process.env.FIREBASE_ID_TOKEN ||
  process.env.FIREBASE_AUTH_TOKEN ||
  process.env.GOOGLE_OAUTH_ACCESS_TOKEN ||
  process.env.GOOGLE_ACCESS_TOKEN ||
  '';

function withProjectId(data, fallbackId) {
  return {
    id: data.id ?? fallbackId,
    name: data.name ?? 'Untitled Project',
    clientName: data.clientName ?? '',
    partnerName: data.partnerName,
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
  };
}

function decodeFirestoreValue(value) {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) {
    return (value.arrayValue.values ?? []).map((item) => decodeFirestoreValue(item));
  }
  if ('mapValue' in value) {
    return decodeFirestoreFields(value.mapValue.fields ?? {});
  }
  return undefined;
}

function decodeFirestoreFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value)]),
  );
}

function getFirestoreDocumentId(documentName) {
  return documentName.split('/').at(-1);
}

function escapeMarkdown(value) {
  return String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ')
    .trim();
}

function getDateParts(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return { year, month, day };
}

function dateToUtcTime(isoDate) {
  const { year, month, day } = getDateParts(isoDate);
  return Date.UTC(year, month - 1, day);
}

function daysBetween(startIso, endIso) {
  return Math.round((dateToUtcTime(endIso) - dateToUtcTime(startIso)) / 86_400_000);
}

function getTodayIso() {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function formatGeneratedAt() {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: timezone,
    dateStyle: 'full',
    timeStyle: 'long',
  }).format(new Date());
}

function formatDateLabel(isoDate) {
  const { year, month, day } = getDateParts(isoDate);
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'UTC',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function getAssigneeNames(task, peopleById) {
  const ids = task.assigneeIds?.length ? task.assigneeIds : task.assigneeId ? [task.assigneeId] : [];
  return ids.map((id) => peopleById.get(id)?.name ?? id).filter(Boolean);
}

function getTimingLabel(milestone, todayIso) {
  if (milestone.isDone) return 'Completed';

  const dayDiff = daysBetween(todayIso, milestone.date);
  if (dayDiff < 0) return `${Math.abs(dayDiff)} day${Math.abs(dayDiff) === 1 ? '' : 's'} overdue`;
  if (dayDiff === 0) return 'Due today';
  if (dayDiff === 1) return 'Due tomorrow';
  return `Due in ${dayDiff} days`;
}

function buildMilestoneRows(projects, people) {
  const peopleById = new Map(people.map((person) => [person.id, person]));

  return projects
    .flatMap((project) =>
      project.tasks
        .filter((task) => task?.isMilestone)
        .map((task) => ({
          id: `${project.id}::${task.id}`,
          sourceProjectId: project.id,
          sourceTaskId: task.id,
          projectName: project.name,
          clientName: project.clientName,
          partnerName: project.partnerName,
          name: task.name ?? 'Untitled Milestone',
          date: task.startDate,
          isDone: Boolean(task.isDone),
          assignees: getAssigneeNames(task, peopleById),
          updatedAt: project.updatedAt,
        })),
    )
    .filter((milestone) => /^\d{4}-\d{2}-\d{2}$/.test(milestone.date))
    .sort((a, b) => {
      const dateDiff = dateToUtcTime(a.date) - dateToUtcTime(b.date);
      if (dateDiff !== 0) return dateDiff;

      const projectDiff = a.projectName.localeCompare(b.projectName);
      if (projectDiff !== 0) return projectDiff;

      return a.name.localeCompare(b.name);
    });
}

function sectionForMilestone(milestone, todayIso) {
  if (milestone.isDone) return 'Completed milestones still visible in Chronos';

  const dayDiff = daysBetween(todayIso, milestone.date);
  if (dayDiff < 0) return 'Overdue';
  if (dayDiff === 0) return 'Today';
  if (dayDiff <= 7) return 'Next 7 days';
  if (dayDiff <= 30) return 'Next 30 days';
  return 'Later';
}

function renderTable(rows, todayIso) {
  if (rows.length === 0) return '_No milestones in this section._\n';

  const lines = [
    '| Date | Timing | Project | Client | Milestone | Owner(s) | Status | IDs |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const row of rows) {
    lines.push(
      [
        `${escapeMarkdown(row.date)} (${escapeMarkdown(formatDateLabel(row.date))})`,
        escapeMarkdown(getTimingLabel(row, todayIso)),
        escapeMarkdown(row.projectName),
        escapeMarkdown(row.clientName || 'Not set'),
        escapeMarkdown(row.name),
        escapeMarkdown(row.assignees.length ? row.assignees.join(', ') : 'Unassigned'),
        row.isDone ? 'Done' : 'Open',
        escapeMarkdown(`project:${row.sourceProjectId} task:${row.sourceTaskId}`),
      ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'),
    );
  }

  return `${lines.join('\n')}\n`;
}

function renderMarkdown(milestones) {
  const todayIso = getTodayIso();
  const generatedAt = formatGeneratedAt();
  const openMilestones = milestones.filter((milestone) => !milestone.isDone);
  const completedMilestones = milestones.filter((milestone) => milestone.isDone);
  const nextSevenDays = openMilestones.filter((milestone) => {
    const dayDiff = daysBetween(todayIso, milestone.date);
    return dayDiff >= 0 && dayDiff <= 7;
  });

  const sectionOrder = [
    'Overdue',
    'Today',
    'Next 7 days',
    'Next 30 days',
    'Later',
    'Completed milestones still visible in Chronos',
  ];
  const grouped = new Map(sectionOrder.map((section) => [section, []]));

  for (const milestone of milestones) {
    grouped.get(sectionForMilestone(milestone, todayIso))?.push(milestone);
  }

  const lines = [
    '# Chronos Active Milestones',
    '',
    `Generated: ${generatedAt} (${timezone})`,
    `Source: Firestore projects collection, matching Chronos milestone view logic: every task where \`isMilestone\` is true.`,
    '',
    '## Claude briefing instructions',
    '',
    '- Use this file as the canonical daily milestone briefing source instead of scraping the rendered Chronos page.',
    '- “Active milestones” means milestones still present in Chronos milestone view. If a milestone is deleted or unmarked as a milestone, the next export overwrites this file and removes it.',
    '- Completed milestones remain listed only while Chronos still shows them, with `Status` set to `Done`.',
    '',
    '## Snapshot',
    '',
    `- Today: ${todayIso}`,
    `- Total milestones in milestone view: ${milestones.length}`,
    `- Open milestones: ${openMilestones.length}`,
    `- Completed milestones still visible: ${completedMilestones.length}`,
    `- Open milestones due in the next 7 days: ${nextSevenDays.length}`,
    '',
  ];

  for (const section of sectionOrder) {
    const rows = grouped.get(section) ?? [];
    lines.push(`## ${section}`, '', renderTable(rows, todayIso));
  }

  lines.push(
    '## Raw count by project',
    '',
    renderProjectCounts(milestones),
    '',
    '<!-- Generated by `npm run export:milestones`. Do not edit by hand. -->',
    '',
  );

  return lines.join('\n');
}

function renderProjectCounts(milestones) {
  if (milestones.length === 0) return '_No active milestone projects._\n';

  const counts = new Map();
  for (const milestone of milestones) {
    const current = counts.get(milestone.projectName) ?? { total: 0, open: 0 };
    current.total += 1;
    if (!milestone.isDone) current.open += 1;
    counts.set(milestone.projectName, current);
  }

  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([projectName, count]) => `- ${projectName}: ${count.open} open / ${count.total} total`)
    .join('\n');
}

async function loadCollection(collectionName) {
  const databaseId = encodeURIComponent(firebaseConfig.firestoreDatabaseId || '(default)');
  const url = new URL(
    `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${databaseId}/documents/${collectionName}`,
  );
  url.searchParams.set('key', firebaseConfig.apiKey);
  url.searchParams.set('pageSize', '300');

  const documents = [];
  let pageToken;

  do {
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    } else {
      url.searchParams.delete('pageToken');
    }

    const headers = bearerToken ? { Authorization: `Bearer ${bearerToken}` } : undefined;
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Firestore REST read failed for ${collectionName}: ${response.status} ${response.statusText}\n${errorBody}`,
      );
    }

    const body = await response.json();
    documents.push(...(body.documents ?? []));
    pageToken = body.nextPageToken;
  } while (pageToken);

  return documents.map((document) => ({
    ...decodeFirestoreFields(document.fields ?? {}),
    id: getFirestoreDocumentId(document.name),
  }));
}

async function loadCollectionsFromFirebaseSdk() {
  const [
    { initializeApp, getApps },
    { collection, getDocs, getFirestore, orderBy, query, terminate },
  ] = await Promise.all([
    import('firebase/app'),
    import('firebase/firestore'),
  ]);

  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

  try {
    const [projectSnapshot, peopleSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'projects'), orderBy('updatedAt', 'asc'))),
      getDocs(query(collection(db, 'people'), orderBy('createdAt', 'asc'))),
    ]);

    return [
      projectSnapshot.docs.map((snapshotDoc) => ({
        ...snapshotDoc.data(),
        id: snapshotDoc.id,
      })),
      peopleSnapshot.docs.map((snapshotDoc) => ({
        ...snapshotDoc.data(),
        id: snapshotDoc.id,
      })),
    ];
  } finally {
    await terminate(db).catch(() => {});
  }
}

async function loadSourceData() {
  try {
    return await Promise.all([
      loadCollection('projects'),
      loadCollection('people'),
    ]);
  } catch (error) {
    if (bearerToken) {
      throw error;
    }

    console.warn(
      'Firestore REST export is unavailable without a bearer token; retrying with the Firebase client SDK fallback.',
    );
    if (process.env.CHRONOS_MILESTONE_DEBUG === '1') {
      console.warn(error instanceof Error ? error.message : String(error));
    }

    return await Promise.race([
      loadCollectionsFromFirebaseSdk(),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Firebase client SDK fallback timed out after 90 seconds.'));
        }, 90_000);
      }),
    ]);
  }
}

if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'MOCK_API_KEY') {
  throw new Error('Firebase is not configured. Update firebase-applet-config.json before exporting milestones.');
}

async function main() {
  const [projectDocs, people] = await loadSourceData();
  const projects = projectDocs.map((projectDoc) => withProjectId(projectDoc, projectDoc.id));
  const markdown = renderMarkdown(buildMilestoneRows(projects, people));

  await Promise.all(
    outputFiles.map(async (outputFile) => {
      await mkdir(path.dirname(outputFile), { recursive: true });
      await writeFile(outputFile, markdown, 'utf8');
    }),
  );

  console.log(`Exported active milestones to ${outputFiles.map((file) => path.relative(rootDir, file)).join(' and ')}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
