import { jsPDF } from 'jspdf';
import type { CalendarEvent, TaskItem, WorkspaceState } from '../types';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCsv(value: string): string {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportWorkspaceCsv(state: WorkspaceState): void {
  const lines: string[] = [];
  lines.push('Type,Title,StatusOrPriority,TimeOrDue,OwnerOrLocation,Notes');

  for (const evt of state.events) {
    lines.push(
      [
        'Calendar Event',
        escapeCsv(evt.title),
        escapeCsv(evt.priority),
        escapeCsv(`${new Date(evt.startIso).toLocaleString()} - ${new Date(evt.endIso).toLocaleTimeString()}`),
        escapeCsv(evt.location),
        escapeCsv(evt.notes),
      ].join(',')
    );
  }

  for (const task of state.tasks) {
    lines.push(
      [
        'Task',
        escapeCsv(task.title),
        escapeCsv(`${task.column} (${task.priority})`),
        escapeCsv(new Date(task.dueDateIso).toLocaleDateString()),
        escapeCsv(task.projectId),
        escapeCsv(task.description),
      ].join(',')
    );
  }

  for (const doc of state.documents) {
    lines.push(
      [
        'Document',
        escapeCsv(doc.title),
        escapeCsv(doc.encrypted ? 'Encrypted' : 'Standard'),
        escapeCsv(new Date(doc.updatedAtIso).toLocaleDateString()),
        escapeCsv(doc.category),
        escapeCsv(doc.content),
      ].join(',')
    );
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `aether-workspace-${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportWorkspacePdf(state: WorkspaceState): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  let y = 52;

  const checkPage = (needed = 40) => {
    if (y + needed > 740) {
      doc.addPage();
      y = 52;
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Aether Executive Briefing & Workspace Export', 48, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()} · Synced: ${new Date(state.lastSyncedAtIso).toLocaleString()}`, 48, y);
  y += 28;

  // Calendar section
  doc.setTextColor(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`Calendar Schedule (${state.events.length})`, 48, y);
  y += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  for (const evt of state.events) {
    checkPage(34);
    const timeStr = `${new Date(evt.startIso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} - ${new Date(evt.endIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    doc.setFont('helvetica', 'bold');
    doc.text(`[${evt.priority.toUpperCase()}] ${evt.title}`, 48, y);
    y += 13;
    doc.setFont('helvetica', 'normal');
    doc.text(`${timeStr} · ${evt.location}`, 58, y);
    y += 18;
  }

  y += 10;
  checkPage(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`Project Tasks (${state.tasks.length})`, 48, y);
  y += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  state.tasks.forEach((task: TaskItem) => {
    checkPage(32);
    doc.setFont('helvetica', 'bold');
    doc.text(`• ${task.title} [${task.column.replace('_', ' ')} · ${task.priority}]`, 48, y);
    y += 13;
    doc.setFont('helvetica', 'normal');
    const wrapped = doc.splitTextToSize(task.description, 490);
    doc.text(wrapped, 58, y);
    y += wrapped.length * 12 + 8;
  });

  y += 10;
  checkPage(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`Encrypted Documents & Notes (${state.documents.length})`, 48, y);
  y += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  state.documents.forEach((item) => {
    checkPage(36);
    doc.setFont('helvetica', 'bold');
    doc.text(`${item.title} (${item.encrypted ? 'AES-256-GCM' : 'Standard'})`, 48, y);
    y += 13;
    doc.setFont('helvetica', 'normal');
    const wrapped = doc.splitTextToSize(item.content, 490);
    doc.text(wrapped, 58, y);
    y += wrapped.length * 12 + 10;
  });

  doc.save(`aether-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportCalendarIcs(events: CalendarEvent[]): void {
  const fmt = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Aether AI//Executive Calendar//EN',
  ];

  for (const evt of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${evt.id}@aether.local`,
      `DTSTART:${fmt(evt.startIso)}`,
      `DTEND:${fmt(evt.endIso)}`,
      `SUMMARY:${evt.title.replace(/\n/g, ' ')}`,
      `LOCATION:${evt.location.replace(/\n/g, ' ')}`,
      `DESCRIPTION:${evt.notes.replace(/\n/g, ' ')}`,
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  downloadBlob(new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }), 'aether-schedule.ics');
}
