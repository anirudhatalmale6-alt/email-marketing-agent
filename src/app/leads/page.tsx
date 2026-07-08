'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import LeadTable from '@/components/LeadTable';
import LeadForm from '@/components/LeadForm';
import TagBadge from '@/components/TagBadge';
import ImportModal from '@/components/ImportModal';
import Modal from '@/components/Modal';

interface Tag {
  id: string;
  name: string;
  color: string;
  leadCount?: number;
}

interface LeadTag {
  id: string;
  tagId: string;
  tag: Tag;
}

interface Lead {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company: string | null;
  jobTitle: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  website: string | null;
  source: string | null;
  verified: boolean;
  status: string;
  createdAt: string;
  tags: LeadTag[];
}

function LeadsContent() {
  const searchParams = useSearchParams();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());

  // Modals
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Lead | null>(null);
  const [bulkTagModal, setBulkTagModal] = useState(false);

  // Tag management
  const [showTagManager, setShowTagManager] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');

  // Notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const fetchLeads = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (tagFilter) params.set('tag', tagFilter);
      const res = await fetch(`/api/leads?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch leads');
      const json = await res.json();
      setLeads(json);
    } catch {
      showNotification('error', 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [search, tagFilter, showNotification]);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch('/api/tags');
      if (!res.ok) throw new Error('Failed to fetch tags');
      const json = await res.json();
      setTags(json);
    } catch {
      // Silently fail for tags
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchTags();
  }, [fetchLeads, fetchTags]);

  useEffect(() => {
    if (searchParams.get('import') === 'true') {
      setShowImport(true);
    }
  }, [searchParams]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLeads();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, tagFilter, fetchLeads]);

  async function handleSaveLead(leadData: Record<string, unknown>) {
    try {
      if (editingLead) {
        const res = await fetch(`/api/leads/${editingLead.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(leadData),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to update lead');
        }
        showNotification('success', 'Lead updated successfully');
      } else {
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(leadData),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to create lead');
        }
        showNotification('success', 'Lead created successfully');
      }
      setEditingLead(null);
      setShowAddForm(false);
      fetchLeads();
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Failed to save lead');
    }
  }

  async function handleDeleteLead(lead: Lead) {
    try {
      const res = await fetch(`/api/leads/${lead.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete lead');
      showNotification('success', 'Lead deleted successfully');
      setDeleteConfirm(null);
      fetchLeads();
    } catch {
      showNotification('error', 'Failed to delete lead');
    }
  }

  async function handleExport() {
    try {
      const params = new URLSearchParams();
      if (tagFilter) params.set('tag', tagFilter);
      const res = await fetch(`/api/export?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to export');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showNotification('success', 'Leads exported successfully');
    } catch {
      showNotification('error', 'Failed to export leads');
    }
  }

  async function handleBulkTagAssign(tagId: string) {
    try {
      const promises = Array.from(selectedLeads).map((leadId) =>
        fetch(`/api/leads/${leadId}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tagIds: [tagId] }),
        })
      );
      await Promise.all(promises);
      showNotification('success', `Tag assigned to ${selectedLeads.size} leads`);
      setBulkTagModal(false);
      setSelectedLeads(new Set());
      fetchLeads();
    } catch {
      showNotification('error', 'Failed to assign tags');
    }
  }

  async function handleCreateTag() {
    if (!newTagName.trim()) return;
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim(), color: newTagColor }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create tag');
      }
      showNotification('success', 'Tag created');
      setNewTagName('');
      setNewTagColor('#3B82F6');
      fetchTags();
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Failed to create tag');
    }
  }

  async function handleUpdateTag(tag: Tag) {
    try {
      const res = await fetch(`/api/tags/${tag.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tag.name, color: tag.color }),
      });
      if (!res.ok) throw new Error('Failed to update tag');
      showNotification('success', 'Tag updated');
      setEditingTag(null);
      fetchTags();
    } catch {
      showNotification('error', 'Failed to update tag');
    }
  }

  async function handleDeleteTag(tagId: string) {
    try {
      const res = await fetch(`/api/tags/${tagId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete tag');
      showNotification('success', 'Tag deleted');
      if (tagFilter === tagId) setTagFilter('');
      fetchTags();
      fetchLeads();
    } catch {
      showNotification('error', 'Failed to delete tag');
    }
  }

  async function handleDeleteAllTags() {
    if (tags.length === 0) return;
    if (!confirm(`Delete ALL ${tags.length} tag(s)? This removes them from every lead. The leads themselves are not deleted.`)) return;
    try {
      await Promise.all(tags.map((t) => fetch(`/api/tags/${t.id}`, { method: 'DELETE' })));
      showNotification('success', 'All tags deleted');
      setTagFilter('');
      fetchTags();
      fetchLeads();
    } catch {
      showNotification('error', 'Failed to delete all tags');
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-slide-down ${
            notification.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-1">
            {leads.length} total lead{leads.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedLeads.size > 0 && (
            <button
              onClick={() => setBulkTagModal(true)}
              className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
            >
              Tag Selected ({selectedLeads.size})
            </button>
          )}
          <button
            onClick={handleExport}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </span>
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import
            </span>
          </button>
          <button
            onClick={() => { setEditingLead(null); setShowAddForm(true); }}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Lead
            </span>
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name, email, or company..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">All Tags</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name} ({tag.leadCount || 0})
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowTagManager(!showTagManager)}
              className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Tags
              </span>
            </button>
          </div>

          {/* Lead Table */}
          <LeadTable
            onEdit={(lead) => { setEditingLead(lead as unknown as Lead); setShowAddForm(true); }}
            onAdd={() => { setEditingLead(null); setShowAddForm(true); }}
            onImport={() => setShowImport(true)}
          />

          {leads.length === 0 && !loading && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="mt-2 text-sm font-medium text-gray-900">No leads found</p>
              <p className="mt-1 text-sm text-gray-500">
                {search || tagFilter ? 'Try adjusting your search or filters.' : 'Get started by adding or importing leads.'}
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  onClick={() => { setEditingLead(null); setShowAddForm(true); }}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Lead
                </button>
                <button
                  onClick={() => setShowImport(true)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Import CSV
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tag Manager Sidebar */}
        {showTagManager && (
          <div className="w-72 flex-shrink-0 bg-white rounded-xl border border-gray-200 p-4 shadow-sm h-fit animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Tags</h3>
              <div className="flex items-center gap-2">
                {tags.length > 0 && (
                  <button
                    onClick={handleDeleteAllTags}
                    className="text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    Delete all
                  </button>
                )}
                <button onClick={() => setShowTagManager(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              </div>
            </div>

            {/* Create Tag */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Tag name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-gray-300"
              />
              <button
                onClick={handleCreateTag}
                className="px-2 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            {/* Tag List */}
            <div className="space-y-2">
              {tags.map((tag) => (
                <div key={tag.id} className="flex items-center justify-between group">
                  {editingTag?.id === tag.id ? (
                    <div className="flex-1 flex gap-1">
                      <input
                        type="text"
                        value={editingTag.name}
                        onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <input
                        type="color"
                        value={editingTag.color}
                        onChange={(e) => setEditingTag({ ...editingTag, color: e.target.value })}
                        className="w-6 h-7 rounded cursor-pointer"
                      />
                      <button onClick={() => handleUpdateTag(editingTag)} className="text-emerald-600 hover:text-emerald-700">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button onClick={() => setEditingTag(null)} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <TagBadge name={tag.name} color={tag.color} />
                        <span className="text-xs text-gray-400">{tag.leadCount || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditingTag(tag)} title="Rename tag" className="text-gray-400 hover:text-gray-600 p-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete tag "${tag.name}"? It will be removed from ${tag.leadCount || 0} lead(s). The leads themselves are not deleted.`)) {
                              handleDeleteTag(tag.id);
                            }
                          }}
                          title="Delete tag"
                          className="text-gray-400 hover:text-red-600 p-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {tags.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No tags yet. Create one above.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Lead Modal */}
      <LeadForm
        isOpen={showAddForm}
        onClose={() => { setShowAddForm(false); setEditingLead(null); }}
        onSaved={() => {
          setShowAddForm(false);
          setEditingLead(null);
          showNotification('success', editingLead ? 'Lead updated' : 'Lead added');
          fetchLeads();
        }}
        editData={editingLead as unknown as Parameters<typeof LeadForm>[0]['editData']}
      />

      {/* Import Modal */}
      {showImport && (
        <ImportModal
          isOpen={true}
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            showNotification('success', 'Leads imported successfully');
            fetchLeads();
            fetchTags();
          }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <Modal isOpen={true}
          title="Delete Lead"
          onClose={() => setDeleteConfirm(null)}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to delete <strong>{deleteConfirm.firstName} {deleteConfirm.lastName}</strong> ({deleteConfirm.email})? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteLead(deleteConfirm)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Bulk Tag Assignment Modal */}
      {bulkTagModal && (
        <Modal isOpen={true}
          title={`Assign Tag to ${selectedLeads.size} Leads`}
          onClose={() => setBulkTagModal(false)}
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Select a tag to assign to the selected leads:</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => handleBulkTagAssign(tag.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
                >
                  <TagBadge name={tag.name} color={tag.color} />
                </button>
              ))}
            </div>
            {tags.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No tags available. Create tags first.</p>
            )}
            <div className="flex justify-end">
              <button
                onClick={() => setBulkTagModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="p-6 flex justify-center"><div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <LeadsContent />
    </Suspense>
  );
}
