'use client';

import { useState, useEffect, useCallback } from 'react';
import Modal from './Modal';
import TagBadge from './TagBadge';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface LeadData {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  jobTitle: string;
  phone: string;
  country: string;
  city: string;
  website: string;
  tagIds: string[];
}

interface LeadFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editData?: Partial<LeadData & { tags?: { tag: Tag }[] }> | null;
}

const emptyForm: LeadData = {
  firstName: '',
  lastName: '',
  email: '',
  company: '',
  jobTitle: '',
  phone: '',
  country: '',
  city: '',
  website: '',
  tagIds: [],
};

export default function LeadForm({ isOpen, onClose, onSaved, editData }: LeadFormProps) {
  const [form, setForm] = useState<LeadData>(emptyForm);
  const [tags, setTags] = useState<Tag[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch('/api/tags');
      if (res.ok) {
        const data = await res.json();
        setTags(data.tags ?? data);
      }
    } catch (err) {
      console.error('Failed to fetch tags:', err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchTags();
      if (editData) {
        setForm({
          id: editData.id,
          firstName: editData.firstName || '',
          lastName: editData.lastName || '',
          email: editData.email || '',
          company: editData.company || '',
          jobTitle: editData.jobTitle || '',
          phone: editData.phone || '',
          country: editData.country || '',
          city: editData.city || '',
          website: editData.website || '',
          tagIds: editData.tags?.map((lt) => lt.tag.id) || [],
        });
      } else {
        setForm(emptyForm);
      }
      setErrors({});
    }
  }, [isOpen, editData, fetchTags]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = 'First name is required';
    if (!form.lastName.trim()) errs.lastName = 'Last name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email format';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (field: keyof LeadData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const toggleTag = (tagId: string) => {
    setForm((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId)
        ? prev.tagIds.filter((id) => id !== tagId)
        : [...prev.tagIds, tagId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const url = form.id ? `/api/leads/${form.id}` : '/api/leads';
      const method = form.id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        onSaved();
        onClose();
      } else {
        const data = await res.json();
        setErrors({ submit: data.error || 'Failed to save lead' });
      }
    } catch (err) {
      console.error('Save failed:', err);
      setErrors({ submit: 'Network error. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const inputClass = (field: string) =>
    `w-full rounded-lg border ${errors[field] ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-gray-200 focus:border-blue-400 focus:ring-blue-100'} bg-white px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={form.id ? 'Edit Lead' : 'Add New Lead'}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {errors.submit && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            {errors.submit}
          </div>
        )}

        {/* Name row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              placeholder="John"
              className={inputClass('firstName')}
            />
            {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              placeholder="Doe"
              className={inputClass('lastName')}
            />
            {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName}</p>}
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="john@company.com"
            className={inputClass('email')}
          />
          {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
        </div>

        {/* Company & Job Title */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
            <input
              type="text"
              value={form.company}
              onChange={(e) => handleChange('company', e.target.value)}
              placeholder="Acme Inc."
              className={inputClass('company')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
            <input
              type="text"
              value={form.jobTitle}
              onChange={(e) => handleChange('jobTitle', e.target.value)}
              placeholder="Marketing Manager"
              className={inputClass('jobTitle')}
            />
          </div>
        </div>

        {/* Phone & Country */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="+1 (555) 000-0000"
              className={inputClass('phone')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <input
              type="text"
              value={form.country}
              onChange={(e) => handleChange('country', e.target.value)}
              placeholder="United States"
              className={inputClass('country')}
            />
          </div>
        </div>

        {/* City & Website */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => handleChange('city', e.target.value)}
              placeholder="New York"
              className={inputClass('city')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
            <input
              type="url"
              value={form.website}
              onChange={(e) => handleChange('website', e.target.value)}
              placeholder="https://company.com"
              className={inputClass('website')}
            />
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
          <div className="flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 min-h-[44px]">
            {tags.length === 0 ? (
              <span className="text-sm text-gray-400">No tags available</span>
            ) : (
              tags.map((tag) => {
                const isSelected = form.tagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`transition-all ${isSelected ? 'ring-2 ring-offset-1 ring-blue-400 scale-105' : 'opacity-60 hover:opacity-100'}`}
                  >
                    <TagBadge
                      name={tag.name}
                      color={tag.color}
                      onRemove={isSelected ? () => toggleTag(tag.id) : undefined}
                    />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {saving && (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {form.id ? 'Update Lead' : 'Add Lead'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
