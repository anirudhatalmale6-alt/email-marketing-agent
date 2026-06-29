'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import TagBadge from './TagBadge';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Template {
  id: string;
  name: string;
  subject: string;
}

interface CampaignData {
  id?: string;
  name: string;
  subject: string;
  templateId: string;
  segmentTags: string[];
  scheduledAt: string;
  dailyLimit: number;
  delaySeconds: number;
  aiPersonalize: boolean;
  followUpEnabled: boolean;
  followUpDays: number;
  followUpMaxCount: number;
  fromName: string;
  fromEmail: string;
}

interface CampaignFormProps {
  campaignId?: string;
  onSaved?: () => void;
  onCancel?: () => void;
}

const defaultForm: CampaignData = {
  name: '',
  subject: '',
  templateId: '',
  segmentTags: [],
  scheduledAt: '',
  dailyLimit: 1000,
  delaySeconds: 30,
  aiPersonalize: false,
  followUpEnabled: false,
  followUpDays: 3,
  followUpMaxCount: 2,
  fromName: '',
  fromEmail: '',
};

export default function CampaignForm({ campaignId, onSaved, onCancel }: CampaignFormProps) {
  const [form, setForm] = useState<CampaignData>(defaultForm);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [segmentOpen, setSegmentOpen] = useState(false);
  const segmentRef = useRef<HTMLDivElement>(null);

  const fetchDeps = useCallback(async () => {
    try {
      const [tplRes, tagRes] = await Promise.all([
        fetch('/api/templates'),
        fetch('/api/tags'),
      ]);
      if (tplRes.ok) {
        const data = await tplRes.json();
        setTemplates(data.templates ?? data);
      }
      if (tagRes.ok) {
        const data = await tagRes.json();
        setTags(data.tags ?? data);
      }
    } catch (err) {
      console.error('Failed to fetch dependencies:', err);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (segmentRef.current && !segmentRef.current.contains(e.target as Node)) {
        setSegmentOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchDeps();

    if (campaignId) {
      fetch(`/api/campaigns/${campaignId}`)
        .then((res) => res.json())
        .then((data) => {
          setForm({
            id: data.id,
            name: data.name || '',
            subject: data.subject || '',
            templateId: data.templateId || '',
            segmentTags: data.segmentTags ? JSON.parse(data.segmentTags) : [],
            scheduledAt: data.scheduledAt ? new Date(data.scheduledAt).toISOString().slice(0, 16) : '',
            dailyLimit: data.dailyLimit ?? 300,
            delaySeconds: data.delaySeconds ?? 30,
            aiPersonalize: data.aiPersonalize ?? false,
            followUpEnabled: data.followUpEnabled ?? false,
            followUpDays: data.followUpDays ?? 3,
            followUpMaxCount: data.followUpMaxCount ?? 2,
            fromName: data.fromName || '',
            fromEmail: data.fromEmail || '',
          });
        })
        .catch(console.error);
    }
  }, [campaignId, fetchDeps]);

  const handleChange = (field: keyof CampaignData, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const toggleSegmentTag = (tagId: string) => {
    setForm((prev) => ({
      ...prev,
      segmentTags: prev.segmentTags.includes(tagId)
        ? prev.segmentTags.filter((id) => id !== tagId)
        : [...prev.segmentTags, tagId],
    }));
  };

  const handleTemplateSelect = (templateId: string) => {
    handleChange('templateId', templateId);
    const tpl = templates.find((t) => t.id === templateId);
    if (tpl && !form.subject) {
      handleChange('subject', tpl.subject);
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Campaign name is required';
    if (!form.subject.trim()) errs.subject = 'Subject line is required';
    if (!form.templateId) errs.templateId = 'Please select a template';
    if (form.segmentTags.length === 0) errs.segmentTags = 'Select at least one tag segment';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (send = false) => {
    if (!validate()) return;

    send ? setSending(true) : setSaving(true);

    try {
      const url = form.id ? `/api/campaigns/${form.id}` : '/api/campaigns';
      const method = form.id ? 'PUT' : 'POST';

      const payload = {
        ...form,
        segmentTags: JSON.stringify(form.segmentTags),
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
        status: send ? 'sending' : 'draft',
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        if (send) {
          const data = await res.json();
          await fetch(`/api/campaigns/${data.id}/send`, { method: 'POST' });
        }
        onSaved?.();
      } else {
        const data = await res.json();
        setErrors({ submit: data.error || 'Failed to save campaign' });
      }
    } catch (err) {
      console.error('Save failed:', err);
      setErrors({ submit: 'Network error. Please try again.' });
    } finally {
      setSaving(false);
      setSending(false);
    }
  };

  const inputClass = (field: string) =>
    `w-full rounded-lg border ${errors[field] ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-gray-200 focus:border-blue-400 focus:ring-blue-100'} bg-white px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors`;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {form.id ? 'Edit Campaign' : 'Create Campaign'}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure your email campaign settings
          </p>
        </div>

        <div className="p-6 space-y-6">
          {errors.submit && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {errors.submit}
            </div>
          )}

          {/* Campaign name & subject */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Campaign Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Q3 Product Launch"
                className={inputClass('name')}
              />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject Line <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => handleChange('subject', e.target.value)}
                placeholder="Exciting news for {{firstName}}!"
                className={inputClass('subject')}
              />
              {errors.subject && <p className="mt-1 text-xs text-red-500">{errors.subject}</p>}
            </div>
          </div>

          {/* Template selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Template <span className="text-red-500">*</span>
            </label>
            <select
              value={form.templateId}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              className={inputClass('templateId')}
            >
              <option value="">Select a template...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name} - {t.subject}</option>
              ))}
            </select>
            {errors.templateId && <p className="mt-1 text-xs text-red-500">{errors.templateId}</p>}
          </div>

          {/* Segment tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Segments <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-400 mb-2">Select tags to target specific lead segments</p>
            <div className="relative" ref={segmentRef}>
              <button
                type="button"
                onClick={() => setSegmentOpen(!segmentOpen)}
                className={`w-full flex items-center justify-between rounded-lg border ${errors.segmentTags ? 'border-red-300' : 'border-gray-200'} bg-white px-3 py-2.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors`}
              >
                {form.segmentTags.length > 0 ? (
                  <span className="flex flex-wrap gap-1.5">
                    {form.segmentTags.map((tagId) => {
                      const tag = tags.find((t) => t.id === tagId);
                      return tag ? <TagBadge key={tagId} name={tag.name} color={tag.color} /> : null;
                    })}
                  </span>
                ) : (
                  <span className="text-gray-400">Select target segments...</span>
                )}
                <svg className={`h-4 w-4 text-gray-400 flex-shrink-0 ml-2 transition-transform ${segmentOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {segmentOpen && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
                  {tags.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-gray-400 text-center">No tags available. Create tags in the Leads page first.</div>
                  ) : (
                    <>
                      <div className="px-3 py-2 border-b border-gray-100">
                        <button type="button" onClick={() => {
                          if (form.segmentTags.length === tags.length) {
                            handleChange('segmentTags', []);
                          } else {
                            handleChange('segmentTags', tags.map((t) => t.id));
                          }
                        }} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                          {form.segmentTags.length === tags.length ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                      {tags.map((tag) => {
                        const isSelected = form.segmentTags.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => toggleSegmentTag(tag.id)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
                          >
                            <div className={`flex-shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                              {isSelected && (
                                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <TagBadge name={tag.name} color={tag.color} />
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
            {errors.segmentTags && <p className="mt-1 text-xs text-red-500">{errors.segmentTags}</p>}
          </div>

          {/* Schedule & Limits */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => handleChange('scheduledAt', e.target.value)}
                className={inputClass('scheduledAt')}
              />
              <p className="mt-1 text-xs text-gray-400">Leave empty to send immediately</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Daily Limit</label>
              <input
                type="number"
                min={1}
                max={10000}
                value={form.dailyLimit}
                onChange={(e) => handleChange('dailyLimit', parseInt(e.target.value) || 1000)}
                className={inputClass('dailyLimit')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delay (seconds)</label>
              <input
                type="number"
                min={5}
                max={300}
                value={form.delaySeconds}
                onChange={(e) => handleChange('delaySeconds', parseInt(e.target.value) || 30)}
                className={inputClass('delaySeconds')}
              />
            </div>
          </div>

          {/* AI Personalization */}
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-700">AI Personalization</p>
              <p className="text-xs text-gray-400 mt-0.5">Use AI to personalize subject and body for each lead</p>
            </div>
            <button
              type="button"
              onClick={() => handleChange('aiPersonalize', !form.aiPersonalize)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${form.aiPersonalize ? 'bg-blue-500' : 'bg-gray-200'}`}
              role="switch"
              aria-checked={form.aiPersonalize}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${form.aiPersonalize ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Follow-up settings */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Follow-up Emails</p>
                <p className="text-xs text-gray-400 mt-0.5">Automatically follow up with non-responders</p>
              </div>
              <button
                type="button"
                onClick={() => handleChange('followUpEnabled', !form.followUpEnabled)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${form.followUpEnabled ? 'bg-blue-500' : 'bg-gray-200'}`}
                role="switch"
                aria-checked={form.followUpEnabled}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${form.followUpEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {form.followUpEnabled && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-gray-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Days Between Follow-ups</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={form.followUpDays}
                    onChange={(e) => handleChange('followUpDays', parseInt(e.target.value) || 3)}
                    className={inputClass('followUpDays')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Follow-ups</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={form.followUpMaxCount}
                    onChange={(e) => handleChange('followUpMaxCount', parseInt(e.target.value) || 2)}
                    className={inputClass('followUpMaxCount')}
                  />
                </div>
              </div>
            )}
          </div>

          {/* From overrides */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Name (override)</label>
              <input
                type="text"
                value={form.fromName}
                onChange={(e) => handleChange('fromName', e.target.value)}
                placeholder="Uses SMTP default if empty"
                className={inputClass('fromName')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Email (override)</label>
              <input
                type="email"
                value={form.fromEmail}
                onChange={(e) => handleChange('fromEmail', e.target.value)}
                placeholder="Uses SMTP default if empty"
                className={inputClass('fromEmail')}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          {onCancel && (
            <button
              onClick={onCancel}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => handleSave(false)}
            disabled={saving || sending}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {saving && (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Save as Draft
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving || sending}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 transition-colors shadow-sm"
          >
            {sending && (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Send Campaign
          </button>
        </div>
      </div>
    </div>
  );
}
