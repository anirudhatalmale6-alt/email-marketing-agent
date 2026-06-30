'use client';

import { useState, useEffect, useCallback } from 'react';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Place {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;
  totalRatings: number;
  types: string[];
  businessStatus: string;
}

interface PlaceDetails {
  placeId: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  rating: number | null;
  totalRatings: number;
  mapsUrl: string;
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

interface BusinessResult {
  details: PlaceDetails;
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

export default function GoogleMapsPage() {
  const [query, setQuery] = useState('hotels in Dubai');
  const [searching, setSearching] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [businesses, setBusinesses] = useState<BusinessResult[]>([]);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [searchingEmails, setSearchingEmails] = useState(false);
  const [emailSearchedCount, setEmailSearchedCount] = useState(0);

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

  async function handleSearch(pageToken?: string) {
    if (!query.trim()) return;

    pageToken ? setLoadingMore(true) : setSearching(true);

    try {
      if (pageToken) await new Promise(r => setTimeout(r, 2000));

      const res = await fetch('/api/google-maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search', query: query.trim(), pageToken }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');

      if (pageToken) {
        setPlaces(prev => [...prev, ...data.places]);
      } else {
        setPlaces(data.places);
        setBusinesses([]);
        setSelected(new Set());
      }
      setNextPageToken(data.nextPageToken);

      if (!pageToken) {
        showNotification('success', `Found ${data.places.length} places`);
      }
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
      setLoadingMore(false);
    }
  }

  async function fetchPlaceDetails() {
    if (places.length === 0) return;

    setFetchingDetails(true);
    const batchSize = 10;
    const allResults: BusinessResult[] = [];
    let apiErrors: string[] = [];

    for (let i = 0; i < places.length; i += batchSize) {
      const batch = places.slice(i, i + batchSize);
      try {
        const res = await fetch('/api/google-maps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'details', placeIds: batch.map(p => p.placeId) }),
        });

        const data = await res.json();
        if (!res.ok) {
          apiErrors.push(data.error || `HTTP ${res.status}`);
          continue;
        }
        if (data.results) {
          for (const detail of data.results) {
            allResults.push({
              details: detail,
              contacts: [],
              loading: false,
              error: '',
              searched: false,
            });
          }
        }
        if (data.errors) {
          apiErrors = apiErrors.concat(data.errors);
        }
      } catch (e) {
        apiErrors.push(e instanceof Error ? e.message : 'Network error');
      }
    }

    setBusinesses(allResults);
    setFetchingDetails(false);

    if (allResults.length > 0) {
      showNotification('success', `Got details for ${allResults.length} businesses (${allResults.filter(b => b.details.website).length} have websites)`);
    } else if (apiErrors.length > 0) {
      showNotification('error', `Failed to get details: ${apiErrors[0]}. Make sure Places API (New) is enabled in Google Cloud Console.`);
    } else {
      showNotification('error', 'No details found. Check your Google Maps API key and enable Places API (New) in Google Cloud Console.');
    }
  }

  async function searchEmails(index: number) {
    const biz = businesses[index];
    if (!biz.details.website) return;

    const domain = extractDomain(biz.details.website);
    if (!domain) return;

    setBusinesses(prev => {
      const next = [...prev];
      next[index] = { ...next[index], loading: true, error: '' };
      return next;
    });

    try {
      const res = await fetch('/api/hunter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search', domain }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Search failed');
      }

      const data = await res.json();
      setBusinesses(prev => {
        const next = [...prev];
        next[index] = { ...next[index], contacts: data.emails || [], loading: false, searched: true };
        return next;
      });
    } catch (err) {
      setBusinesses(prev => {
        const next = [...prev];
        next[index] = { ...next[index], loading: false, error: err instanceof Error ? err.message : 'Failed', searched: true };
        return next;
      });
    }
  }

  async function searchAllEmails() {
    setSearchingEmails(true);
    setEmailSearchedCount(0);

    for (let i = 0; i < businesses.length; i++) {
      if (businesses[i].searched || !businesses[i].details.website) continue;
      await searchEmails(i);
      setEmailSearchedCount(prev => prev + 1);
      await new Promise(r => setTimeout(r, 1500));
    }

    setSearchingEmails(false);
    showNotification('success', 'Email search complete');
  }

  function toggleSelect(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function selectAll() {
    const allKeys = new Set<string>();
    businesses.forEach((b, bi) => {
      b.contacts.forEach((c, ci) => {
        if (c.email) allKeys.add(`${bi}-${ci}`);
      });
    });
    setSelected(prev => prev.size === allKeys.size ? new Set() : allKeys);
  }

  async function handleImport() {
    const toImport: { contact: HunterContact; biz: PlaceDetails }[] = [];
    businesses.forEach((b, bi) => {
      b.contacts.forEach((c, ci) => {
        if (selected.has(`${bi}-${ci}`) && c.email) {
          toImport.push({ contact: c, biz: b.details });
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

    const byCompany = new Map<string, { contacts: HunterContact[]; biz: PlaceDetails }>();
    for (const item of toImport) {
      const key = item.biz.name;
      if (!byCompany.has(key)) byCompany.set(key, { contacts: [], biz: item.biz });
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
            companyName: group.biz.name,
            companyWebsite: group.biz.website,
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

  const totalContacts = businesses.reduce((sum, b) => sum + b.contacts.length, 0);
  const contactsWithEmail = businesses.reduce((sum, b) => sum + b.contacts.filter(c => c.email).length, 0);
  const withWebsite = businesses.filter(b => b.details.website).length;

  return (
    <div className="p-6 space-y-6">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-slide-down ${
          notification.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {notification.message}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Google Maps Lead Finder</h1>
        <p className="text-sm text-gray-500 mt-1">Search businesses on Google Maps, find emails with Hunter.io, and import as leads</p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Step 1: Search Google Maps</h2>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="e.g. hotels in Dubai, restaurants in New York..."
            className="flex-1 h-10 rounded-lg border border-gray-200 px-4 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <button
            onClick={() => handleSearch()}
            disabled={searching || !query.trim()}
            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {searching ? (
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            Search
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400">Try: "5 star hotels in Sharjah", "luxury hotels in Abu Dhabi", "resorts in Ras Al Khaimah"</p>
      </div>

      {/* Places results */}
      {places.length > 0 && businesses.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Found {places.length} Places</h2>
              <p className="text-sm text-gray-500">Click "Get Details" to fetch phone numbers and websites</p>
            </div>
            <button
              onClick={fetchPlaceDetails}
              disabled={fetchingDetails}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {fetchingDetails ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Get Details & Websites
                </>
              )}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Business Name</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Address</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-600">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {places.map((place) => (
                  <tr key={place.placeId} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 font-medium text-gray-900">{place.name}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{place.address}</td>
                    <td className="px-3 py-2.5 text-center">
                      {place.rating && (
                        <span className="inline-flex items-center gap-1 text-xs">
                          <span className="text-yellow-500">&#9733;</span>
                          <span className="font-medium">{place.rating}</span>
                          <span className="text-gray-400">({place.totalRatings})</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {nextPageToken && (
            <div className="mt-4 text-center">
              <button
                onClick={() => handleSearch(nextPageToken)}
                disabled={loadingMore}
                className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
              >
                {loadingMore ? 'Loading...' : 'Load More Results'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Business details with email search */}
      {businesses.length > 0 && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Step 2: Find Emails</h2>
                <p className="text-sm text-gray-500">{withWebsite} of {businesses.length} businesses have websites. Hunter.io searches those domains.</p>
              </div>
              <button
                onClick={searchAllEmails}
                disabled={searchingEmails || withWebsite === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {searchingEmails ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Searching {emailSearchedCount}/{businesses.filter(b => !b.searched && b.details.website).length}...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Search All Emails
                  </>
                )}
              </button>
            </div>

            <div className="space-y-3">
              {businesses.map((item, index) => (
                <div key={item.details.placeId} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 truncate">{item.details.name}</h3>
                        {item.details.rating && (
                          <span className="text-xs text-yellow-600 flex items-center gap-0.5">
                            &#9733; {item.details.rating}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-xs">
                        <span className="text-gray-400">{item.details.address}</span>
                        {item.details.phone && (
                          <span className="text-gray-600">{item.details.phone}</span>
                        )}
                        {item.details.website ? (
                          <a href={item.details.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {extractDomain(item.details.website)}
                          </a>
                        ) : (
                          <span className="text-gray-300 italic">No website</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      {item.searched && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          item.contacts.length > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {item.contacts.length} found
                        </span>
                      )}
                      {item.error && <span className="text-xs text-red-500">{item.error}</span>}
                      {!item.searched && item.details.website && (
                        <button
                          onClick={() => searchEmails(index)}
                          disabled={item.loading || searchingEmails}
                          className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition-colors"
                        >
                          {item.loading ? 'Searching...' : 'Find Emails'}
                        </button>
                      )}
                      {item.details.mapsUrl && (
                        <a href={item.details.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600" title="View on Google Maps">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>

                  {item.contacts.length > 0 && (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <table className="w-full text-xs">
                        <tbody className="divide-y divide-gray-50">
                          {item.contacts.map((contact, ci) => (
                            <tr key={ci} className={selected.has(`${index}-${ci}`) ? 'bg-blue-50/50' : ''}>
                              <td className="py-1.5 pr-2 w-8">
                                {contact.email && (
                                  <input
                                    type="checkbox"
                                    checked={selected.has(`${index}-${ci}`)}
                                    onChange={() => toggleSelect(`${index}-${ci}`)}
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
                                  contact.confidence >= 80 ? 'bg-emerald-100 text-emerald-700'
                                    : contact.confidence >= 50 ? 'bg-yellow-100 text-yellow-700'
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
                  <button onClick={selectAll} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
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
      {places.length === 0 && businesses.length === 0 && !searching && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="mt-2 text-sm font-medium text-gray-900">Search Google Maps for businesses</p>
          <p className="mt-1 text-sm text-gray-500">Find hotels, restaurants, or any business type in any location</p>
          <div className="mt-6 bg-gray-50 rounded-lg p-4 text-left max-w-md mx-auto">
            <p className="text-xs font-medium text-gray-700 mb-2">How it works:</p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>1. Search for businesses (e.g. "hotels in Dubai")</li>
              <li>2. Click "Get Details" to fetch phone numbers and websites</li>
              <li>3. Click "Search All Emails" to find people via Hunter.io</li>
              <li>4. Select contacts and import them as leads</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
