'use client';

import { useState, useEffect, useCallback } from 'react';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface EnsunCompany {
  name: string;
  uri: string;
  domain: string;
  description: string;
  headquarter: string;
  size: string;
  linkedin: string;
  phone: string;
  emails: string;
}

interface HunterContact {
  email: string;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  seniority: string | null;
  department: string | null;
  confidence: number;
  linkedin: string | null;
  phone: string | null;
}

interface CompanyResult {
  company: EnsunCompany;
  contacts: HunterContact[];
  loading: boolean;
  error: string;
  searched: boolean;
}

function extractDomain(url: string): string {
  try {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  } catch {
    return url;
  }
}

export default function EnsunPage() {
  const [companies, setCompanies] = useState<CompanyResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [searchingAll, setSearchingAll] = useState(false);
  const [searchedCount, setSearchedCount] = useState(0);

  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  useEffect(() => {
    fetch('/api/tags').then(r => r.json()).then(setTags).catch(() => {});
  }, []);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(Boolean);
      if (lines.length < 2) return;

      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

      const parsed: CompanyResult[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

        if (!row['Name'] && !row['name']) continue;

        const uri = row['URI'] || row['uri'] || row['Website'] || row['website'] || '';
        parsed.push({
          company: {
            name: row['Name'] || row['name'] || '',
            uri,
            domain: extractDomain(uri),
            description: (row['Description'] || row['description'] || '').slice(0, 150),
            headquarter: row['Headquarter'] || row['headquarter'] || row['Location'] || '',
            size: row['Size'] || row['size'] || '',
            linkedin: row['LinkedIn'] || row['linkedin'] || '',
            phone: row['Phone'] || row['phone'] || '',
            emails: row['Emails'] || row['emails'] || '',
          },
          contacts: [],
          loading: false,
          error: '',
          searched: false,
        });
      }

      setCompanies(parsed);
      setSelected(new Set());
      showNotification('success', `Loaded ${parsed.length} companies from CSV`);
    };
    reader.readAsText(file);
  }

  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  async function searchCompany(index: number) {
    const company = companies[index];
    if (!company.company.domain) return;

    setCompanies(prev => {
      const next = [...prev];
      next[index] = { ...next[index], loading: true, error: '' };
      return next;
    });

    try {
      const res = await fetch('/api/hunter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search', domain: company.company.domain }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Search failed');
      }

      const data = await res.json();
      setCompanies(prev => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          contacts: data.emails || [],
          loading: false,
          searched: true,
        };
        return next;
      });
    } catch (err) {
      setCompanies(prev => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          loading: false,
          error: err instanceof Error ? err.message : 'Search failed',
          searched: true,
        };
        return next;
      });
    }
  }

  async function searchAllCompanies() {
    setSearchingAll(true);
    setSearchedCount(0);

    for (let i = 0; i < companies.length; i++) {
      if (companies[i].searched) continue;
      await searchCompany(i);
      setSearchedCount(prev => prev + 1);
      await new Promise(r => setTimeout(r, 1500));
    }

    setSearchingAll(false);
    showNotification('success', 'All companies searched');
  }

  function toggleContactSelect(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAllContacts() {
    const allKeys = new Set<string>();
    companies.forEach((c, ci) => {
      c.contacts.forEach((contact, ei) => {
        if (contact.email) allKeys.add(`${ci}-${ei}`);
      });
    });
    if (selected.size === allKeys.size) {
      setSelected(new Set());
    } else {
      setSelected(allKeys);
    }
  }

  async function handleImport() {
    const toImport: { contact: HunterContact; company: EnsunCompany }[] = [];
    companies.forEach((c, ci) => {
      c.contacts.forEach((contact, ei) => {
        if (selected.has(`${ci}-${ei}`) && contact.email) {
          toImport.push({ contact, company: c.company });
        }
      });
    });

    if (!toImport.length) {
      showNotification('error', 'No contacts selected');
      return;
    }

    setImporting(true);
    let totalImported = 0;
    let totalSkipped = 0;

    const byCompany = new Map<string, { contacts: HunterContact[]; company: EnsunCompany }>();
    for (const item of toImport) {
      const key = item.company.name;
      if (!byCompany.has(key)) byCompany.set(key, { contacts: [], company: item.company });
      byCompany.get(key)!.contacts.push(item.contact);
    }

    for (const [, group] of byCompany) {
      try {
        const res = await fetch('/api/hunter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'import',
            contacts: group.contacts.map(c => ({
              value: c.email,
              first_name: c.firstName,
              last_name: c.lastName,
              position: c.position,
              confidence: c.confidence,
              phone_number: c.phone,
              linkedin: c.linkedin,
            })),
            companyName: group.company.name,
            companyWebsite: group.company.uri,
            tagIds: selectedTagIds,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          totalImported += data.imported || 0;
          totalSkipped += data.skipped || 0;
        }
      } catch {
        totalSkipped += group.contacts.length;
      }
    }

    showNotification('success', `Imported ${totalImported} contacts (${totalSkipped} skipped)`);
    setSelected(new Set());
    setImporting(false);
  }

  const totalContacts = companies.reduce((sum, c) => sum + c.contacts.length, 0);
  const contactsWithEmail = companies.reduce((sum, c) => sum + c.contacts.filter(e => e.email).length, 0);

  return (
    <div className="p-6 space-y-6">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-slide-down ${
          notification.type === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {notification.message}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ensun Company Import</h1>
        <p className="text-sm text-gray-500 mt-1">Upload your Ensun CSV, find emails with Hunter.io, and import as leads</p>
      </div>

      {/* Upload */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Step 1: Upload Ensun CSV</h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload CSV
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
          </label>
          {companies.length > 0 && (
            <span className="text-sm text-gray-600">{companies.length} companies loaded</span>
          )}
        </div>
      </div>

      {/* Companies */}
      {companies.length > 0 && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Step 2: Find Emails</h2>
                <p className="text-sm text-gray-500">Hunter.io will search for people at each company domain</p>
              </div>
              <button
                onClick={searchAllCompanies}
                disabled={searchingAll}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {searchingAll ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Searching {searchedCount}/{companies.filter(c => !c.searched).length}...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Search All Companies
                  </>
                )}
              </button>
            </div>

            <div className="space-y-3">
              {companies.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 truncate">{item.company.name}</h3>
                        <span className="text-xs text-gray-400">{item.company.size}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-blue-600">{item.company.domain}</span>
                        <span className="text-xs text-gray-400">{item.company.headquarter}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.searched && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          item.contacts.length > 0
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {item.contacts.length} found
                        </span>
                      )}
                      {item.error && (
                        <span className="text-xs text-red-500">{item.error}</span>
                      )}
                      {!item.searched && (
                        <button
                          onClick={() => searchCompany(index)}
                          disabled={item.loading || searchingAll}
                          className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition-colors"
                        >
                          {item.loading ? 'Searching...' : 'Find Emails'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Contacts found */}
                  {item.contacts.length > 0 && (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <table className="w-full text-xs">
                        <tbody className="divide-y divide-gray-50">
                          {item.contacts.map((contact, ei) => (
                            <tr key={ei} className={`${selected.has(`${index}-${ei}`) ? 'bg-blue-50/50' : ''}`}>
                              <td className="py-1.5 pr-2 w-8">
                                {contact.email && (
                                  <input
                                    type="checkbox"
                                    checked={selected.has(`${index}-${ei}`)}
                                    onChange={() => toggleContactSelect(`${index}-${ei}`)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                )}
                              </td>
                              <td className="py-1.5 pr-3 font-medium text-gray-900 whitespace-nowrap">
                                {[contact.firstName, contact.lastName].filter(Boolean).join(' ') || '-'}
                              </td>
                              <td className="py-1.5 pr-3 text-gray-500">{contact.position || '-'}</td>
                              <td className="py-1.5 pr-3">
                                {contact.email ? (
                                  <span className="text-emerald-700 font-mono bg-emerald-50 px-1.5 py-0.5 rounded">{contact.email}</span>
                                ) : (
                                  <span className="text-gray-300">No email</span>
                                )}
                              </td>
                              <td className="py-1.5 text-right">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  contact.confidence >= 80
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : contact.confidence >= 50
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-red-100 text-red-600'
                                }`}>
                                  {contact.confidence}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Import bar */}
          {totalContacts > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm sticky bottom-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={selectAllContacts}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {selected.size === contactsWithEmail ? 'Deselect All' : 'Select All'} ({contactsWithEmail} with email)
                  </button>
                  <span className="text-sm text-gray-500">{selected.size} selected</span>
                </div>

                <div className="flex items-center gap-3">
                  {tags.length > 0 && (
                    <select
                      value={selectedTagIds[0] || ''}
                      onChange={e => setSelectedTagIds(e.target.value ? [e.target.value] : [])}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">No tag</option>
                      {tags.map(tag => (
                        <option key={tag.id} value={tag.id}>{tag.name}</option>
                      ))}
                    </select>
                  )}

                  <button
                    onClick={handleImport}
                    disabled={importing || selected.size === 0}
                    className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2"
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
                        Import {selected.size} to Leads
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {companies.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-2 text-sm font-medium text-gray-900">Upload your Ensun CSV</p>
          <p className="mt-1 text-sm text-gray-500">
            Download a company list from Ensun, then upload it here to find emails at each company.
          </p>
          <div className="mt-6 bg-gray-50 rounded-lg p-4 text-left max-w-md mx-auto">
            <p className="text-xs font-medium text-gray-700 mb-2">How it works:</p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>1. Download hotel list from Ensun as CSV</li>
              <li>2. Upload the CSV here</li>
              <li>3. Click "Search All Companies" to find emails via Hunter.io</li>
              <li>4. Select contacts and import them as leads</li>
              <li>5. Send campaigns from the Campaigns page</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
