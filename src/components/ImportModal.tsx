'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Modal from './Modal';
import TagBadge from './TagBadge';

interface PreviewRow {
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  jobTitle: string;
  country: string;
}

interface Tag {
  id: string;
  name: string;
  color: string;
  leadCount?: number;
}

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

export default function ImportModal({ isOpen, onClose, onImported }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tag selection during import
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [newTagName, setNewTagName] = useState('');
  const [creatingTag, setCreatingTag] = useState(false);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch('/api/tags');
      if (res.ok) {
        const data = await res.json();
        setTags(data.tags ?? data);
      }
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchTags();
  }, [isOpen, fetchTags]);

  const toggleTag = (id: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name || creatingTag) return;
    setCreatingTag(true);
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (res.ok) {
        setTags((prev) => [...prev, data]);
        setSelectedTagIds((prev) => new Set(prev).add(data.id));
        setNewTagName('');
      } else if (res.status === 409) {
        // Tag already exists - just select it if we can find it
        const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
        if (existing) setSelectedTagIds((prev) => new Set(prev).add(existing.id));
        setNewTagName('');
      }
    } catch {
      // ignore
    } finally {
      setCreatingTag(false);
    }
  };

  const handleFile = async (f: File) => {
    setFile(f);
    setResult(null);

    const formData = new FormData();
    formData.append('file', f);
    formData.append('preview', 'true');

    try {
      const res = await fetch('/api/import', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.preview) {
        setPreview(data.preview.slice(0, 5));
      }
    } catch {
      setPreview([]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFile(droppedFile);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    if (selectedTagIds.size > 0) {
      formData.append('tagIds', JSON.stringify(Array.from(selectedTagIds)));
    }

    try {
      const res = await fetch('/api/import', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        setResult({
          type: 'success',
          text: `Successfully imported ${data.imported} leads${data.skipped ? ` (${data.skipped} duplicates skipped)` : ''}.`,
        });
        onImported();
      } else {
        setResult({ type: 'error', text: data.error || 'Import failed' });
      }
    } catch {
      setResult({ type: 'error', text: 'Import failed. Please check your file format.' });
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview([]);
    setResult(null);
    setSelectedTagIds(new Set());
    setNewTagName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Leads" maxWidth="max-w-2xl">
      <div className="space-y-5">
        {/* Drop zone or file info */}
        {!file ? (
          <div
            className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors cursor-pointer ${
              dragOver
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <svg className="mb-3 h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm font-medium text-gray-700">
              Drop your CSV or Excel file here
            </p>
            <p className="mt-1 text-xs text-gray-500">or click to browse</p>
            <p className="mt-3 text-xs text-gray-400 max-w-xs">
              Only an <span className="font-medium text-gray-500">email</span> column is required. Everything else — first name, last name, company, job title, country, city, phone — is optional.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFile(e.target.files[0]);
              }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* File info bar */}
            <div className="flex items-center justify-between rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                  <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-800">{file.name}</p>
                  <p className="text-xs text-blue-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={reset}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors"
              >
                Change file
              </button>
            </div>

            {/* Preview table */}
            {preview.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Preview <span className="text-gray-400 font-normal">(first 5 rows)</span>
                </h4>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-500">Email</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-500">Name</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-500">Company</th>
                        <th className="hidden px-3 py-2.5 text-left font-semibold text-gray-500 sm:table-cell">Title</th>
                        <th className="hidden px-3 py-2.5 text-left font-semibold text-gray-500 sm:table-cell">Country</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {preview.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-700">{row.email}</td>
                          <td className="px-3 py-2 text-gray-700">
                            {row.firstName} {row.lastName}
                          </td>
                          <td className="px-3 py-2 text-gray-600">{row.company || '-'}</td>
                          <td className="hidden px-3 py-2 text-gray-600 sm:table-cell">{row.jobTitle || '-'}</td>
                          <td className="hidden px-3 py-2 text-gray-600 sm:table-cell">{row.country || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tag assignment */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-1">Assign tags to imported leads</h4>
              <p className="text-xs text-gray-400 mb-2">Optional — pick existing tags or create a new one. It&apos;ll be applied to every lead in this file.</p>

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {tags.map((tag) => {
                    const active = selectedTagIds.has(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`rounded-full border px-1 transition-all ${active ? 'border-blue-400 ring-2 ring-blue-200' : 'border-transparent opacity-70 hover:opacity-100'}`}
                      >
                        <TagBadge name={tag.name} color={tag.color} />
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="New tag name (e.g. Canada Hotel)"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateTag(); } }}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                />
                <button
                  type="button"
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim() || creatingTag}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {creatingTag ? 'Adding...' : 'Create & select'}
                </button>
              </div>

              {selectedTagIds.size > 0 && (
                <p className="mt-2 text-xs text-gray-500">
                  {selectedTagIds.size} tag{selectedTagIds.size !== 1 ? 's' : ''} will be applied to imported leads.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Result message */}
        {result && (
          <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
            result.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {result.type === 'success' ? (
              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {result.text}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
          <button
            onClick={handleClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!file || importing}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {importing && (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {importing ? 'Importing...' : 'Import Leads'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
