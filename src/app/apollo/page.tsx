'use client';

import { useState, useEffect, useCallback } from 'react';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface ApolloContact {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  title: string;
  email: string;
  linkedinUrl: string;
  headline: string;
  company: string;
  city: string;
  state: string;
  country: string;
  phone: string | null;
  website: string | null;
}

interface Pagination {
  page: number;
  per_page: number;
  total_entries: number;
  total_pages: number;
}

export default function ApolloPage() {
  const [jobTitles, setJobTitles] = useState('General Manager, Operations Director, Procurement Manager');
  const [industry, setIndustry] = useState('hospitality');
  const [locations, setLocations] = useState('Canada, United States');
  const [companyName, setCompanyName] = useState('');
  const [keywords, setKeywords] = useState('hotel');

  const [results, setResults] = useState<ApolloContact[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  useEffect(() => {
    fetch('/api/tags')
      .then(r => r.json())
      .then(setTags)
      .catch(() => {});
  }, []);

  async function handleSearch(page = 1) {
    setSearching(true);
    setError('');
    setCurrentPage(page);

    try {
      const res = await fetch('/api/apollo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'search',
          jobTitles: jobTitles.split(',').map(s => s.trim()).filter(Boolean),
          industry: industry.trim() || undefined,
          locations: locations.split(',').map(s => s.trim()).filter(Boolean),
          companyName: companyName.trim() || undefined,
          keywords: keywords.split(',').map(s => s.trim()).filter(Boolean),
          page,
          perPage: 25,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Search failed');
      }

      const data = await res.json();
      setResults(data.people || []);
      setPagination(data.pagination || null);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleImport() {
    const contactsToImport = results.filter(c => selected.has(c.id) && c.email);
    if (!contactsToImport.length) {
      showNotification('error', 'No contacts with emails selected');
      return;
    }

    setImporting(true);
    try {
      const res = await fetch('/api/apollo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import',
          contacts: contactsToImport.map(c => ({
            id: c.id,
            first_name: c.firstName,
            last_name: c.lastName,
            name: c.name,
            title: c.title,
            email: c.email,
            linkedin_url: c.linkedinUrl,
            headline: c.headline,
            organization_name: c.company,
            city: c.city,
            state: c.state,
            country: c.country,
            phone_numbers: c.phone ? [{ raw_number: c.phone }] : [],
            organization: c.website ? { website_url: c.website } : undefined,
          })),
          tagIds: selectedTagIds,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Import failed');
      }

      const data = await res.json();
      showNotification('success', data.message || `Imported ${data.imported} contacts`);
      setSelected(new Set());
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map(c => c.id)));
    }
  }

  const contactsWithEmail = results.filter(c => c.email);
  const selectedWithEmail = results.filter(c => selected.has(c.id) && c.email);

  return (
    <div className="p-6 space-y-6">
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

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Apollo Lead Finder</h1>
        <p className="text-sm text-gray-500 mt-1">Search Apollo.io for hotel decision-makers and import them as leads</p>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Titles</label>
            <input
              type="text"
              value={jobTitles}
              onChange={e => setJobTitles(e.target.value)}
              placeholder="General Manager, Director of Operations..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">Comma-separated job titles to search for</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
            <input
              type="text"
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              placeholder="hospitality, hotel, resort..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Locations</label>
            <input
              type="text"
              value={locations}
              onChange={e => setLocations(e.target.value)}
              placeholder="Canada, United States, California..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">Comma-separated countries, states, or cities</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="Marriott, Hilton... (leave empty for all)"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
            <input
              type="text"
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              placeholder="hotel, resort, boutique hotel..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => handleSearch(1)}
              disabled={searching}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {searching ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search Apollo
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          {/* Results Header */}
          <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                Found <strong>{pagination?.total_entries || results.length}</strong> contacts
                {contactsWithEmail.length < results.length && (
                  <span className="text-gray-400"> ({contactsWithEmail.length} with emails)</span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Tag selector */}
              {tags.length > 0 && (
                <select
                  value={selectedTagIds[0] || ''}
                  onChange={e => setSelectedTagIds(e.target.value ? [e.target.value] : [])}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No tag on import</option>
                  {tags.map(tag => (
                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                  ))}
                </select>
              )}

              <button
                onClick={handleImport}
                disabled={importing || selectedWithEmail.length === 0}
                className="px-4 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Import {selectedWithEmail.length} to Leads
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selected.size === results.length && results.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Company</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Location</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Links</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.map(contact => (
                  <tr key={contact.id} className={`hover:bg-gray-50 transition-colors ${selected.has(contact.id) ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(contact.id)}
                        onChange={() => toggleSelect(contact.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {contact.firstName} {contact.lastName}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">
                      {contact.title || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{contact.company || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      {contact.email ? (
                        <span className="text-emerald-700 font-mono text-xs bg-emerald-50 px-2 py-0.5 rounded">
                          {contact.email}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">No email</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {[contact.city, contact.state, contact.country].filter(Boolean).join(', ') || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {contact.linkedinUrl && (
                          <a
                            href={contact.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                            title="LinkedIn"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                            </svg>
                          </a>
                        )}
                        {contact.website && (
                          <a
                            href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-gray-600"
                            title="Website"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.total_pages > 1 && (
            <div className="p-4 border-t border-gray-200 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Page {currentPage} of {pagination.total_pages} ({pagination.total_entries} total)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSearch(currentPage - 1)}
                  disabled={currentPage <= 1 || searching}
                  className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => handleSearch(currentPage + 1)}
                  disabled={currentPage >= pagination.total_pages || searching}
                  className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!searching && results.length === 0 && !error && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="mt-2 text-sm font-medium text-gray-900">Search for hotel contacts</p>
          <p className="mt-1 text-sm text-gray-500">
            Enter search criteria above and click Search Apollo to find decision-makers at hotels in Canada and USA.
          </p>
          <div className="mt-6 bg-gray-50 rounded-lg p-4 text-left max-w-md mx-auto">
            <p className="text-xs font-medium text-gray-700 mb-2">Quick Start Tips:</p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>1. Make sure your Apollo API key is set in Settings</li>
              <li>2. Default filters target hotel GMs in Canada/USA</li>
              <li>3. Click Search, select contacts, then Import to Leads</li>
              <li>4. Imported leads appear in the Leads page ready for campaigns</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
