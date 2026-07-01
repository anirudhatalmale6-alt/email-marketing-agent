'use client';

import { useState, useEffect, useCallback } from 'react';
import SmtpForm from '@/components/SmtpForm';
import Modal from '@/components/Modal';

interface SmtpConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  isDefault: boolean;
  createdAt: string;
}

interface AppSettings {
  openaiApiKey: string;
  apolloApiKey: string;
  hunterApiKey: string;
  googleMapsApiKey: string;
  zerobounceApiKey: string;
  gmassApiKey: string;
  sendingMethod: string;
  baseUrl: string;
  dailySendLimit: number;
}

export default function SettingsPage() {
  // SMTP
  const [smtpConfigs, setSmtpConfigs] = useState<SmtpConfig[]>([]);
  const [showSmtpForm, setShowSmtpForm] = useState(false);
  const [editingSmtp, setEditingSmtp] = useState<SmtpConfig | null>(null);
  const [testingSmtp, setTestingSmtp] = useState<string | null>(null);
  const [deleteSmtpConfirm, setDeleteSmtpConfirm] = useState<SmtpConfig | null>(null);

  // App Settings
  const [settings, setSettings] = useState<AppSettings>({
    openaiApiKey: '',
    apolloApiKey: '',
    hunterApiKey: '',
    googleMapsApiKey: '',
    zerobounceApiKey: '',
    gmassApiKey: '',
    sendingMethod: 'gmass',
    baseUrl: '',
    dailySendLimit: 300,
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const fetchSmtpConfigs = useCallback(async () => {
    try {
      const res = await fetch('/api/smtp');
      if (!res.ok) throw new Error('Failed to fetch SMTP configs');
      const json = await res.json();
      setSmtpConfigs(json);
    } catch {
      // SMTP endpoint may not exist yet
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      const json = await res.json();
      setSettings({
        openaiApiKey: json.openaiApiKey || '',
        apolloApiKey: json.apolloApiKey || '',
        hunterApiKey: json.hunterApiKey || '',
        googleMapsApiKey: json.googleMapsApiKey || '',
        zerobounceApiKey: json.zerobounceApiKey || '',
        gmassApiKey: json.gmassApiKey || '',
        sendingMethod: json.sendingMethod || 'gmass',
        baseUrl: json.baseUrl || (typeof window !== 'undefined' ? window.location.origin : ''),
        dailySendLimit: json.dailySendLimit || 300,
      });
    } catch {
      // Settings endpoint may not exist yet, use defaults
      if (typeof window !== 'undefined') {
        setSettings((prev) => ({ ...prev, baseUrl: prev.baseUrl || window.location.origin }));
      }
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchSmtpConfigs(), fetchSettings()]).finally(() => setLoading(false));
  }, [fetchSmtpConfigs, fetchSettings]);

  async function handleSaveSmtp(data: Record<string, unknown>) {
    try {
      if (editingSmtp) {
        const res = await fetch(`/api/smtp/${editingSmtp.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to update SMTP config');
        showNotification('success', 'SMTP configuration updated');
      } else {
        const res = await fetch('/api/smtp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to create SMTP config');
        showNotification('success', 'SMTP configuration added');
      }
      setShowSmtpForm(false);
      setEditingSmtp(null);
      fetchSmtpConfigs();
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Failed to save SMTP config');
    }
  }

  async function handleTestSmtp(configId: string) {
    try {
      setTestingSmtp(configId);
      const res = await fetch(`/api/smtp/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Connection test failed');
      }
      showNotification('success', 'SMTP connection successful');
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'SMTP connection failed');
    } finally {
      setTestingSmtp(null);
    }
  }

  async function handleSetDefault(configId: string) {
    try {
      const res = await fetch(`/api/smtp/${configId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) throw new Error('Failed to set default');
      showNotification('success', 'Default SMTP config updated');
      fetchSmtpConfigs();
    } catch {
      showNotification('error', 'Failed to set default SMTP config');
    }
  }

  async function handleDeleteSmtp(config: SmtpConfig) {
    try {
      const res = await fetch(`/api/smtp/${config.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete SMTP config');
      showNotification('success', 'SMTP configuration deleted');
      setDeleteSmtpConfirm(null);
      fetchSmtpConfigs();
    } catch {
      showNotification('error', 'Failed to delete SMTP config');
    }
  }

  async function handleSaveSettings() {
    try {
      setSavingSettings(true);
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      showNotification('success', 'Settings saved');
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  }

  function maskApiKey(key: string): string {
    if (!key) return '';
    if (key.length <= 8) return '****';
    return key.substring(0, 4) + '****' + key.substring(key.length - 4);
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure SMTP, API keys, and application settings</p>
      </div>

      {/* SMTP Configuration */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">SMTP Configuration</h2>
            <p className="text-sm text-gray-500 mt-1">Configure email sending servers</p>
          </div>
          <button
            onClick={() => { setEditingSmtp(null); setShowSmtpForm(true); }}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add SMTP
            </span>
          </button>
        </div>

        {smtpConfigs.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {smtpConfigs.map((config) => (
              <div key={config.id} className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{config.name}</p>
                    {config.isDefault && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {config.host}:{config.port} ({config.secure ? 'SSL' : 'TLS'})
                  </p>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {config.fromName} &lt;{config.fromEmail}&gt;
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestSmtp(config.id)}
                    disabled={testingSmtp === config.id}
                    className="px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                  >
                    {testingSmtp === config.id ? 'Testing...' : 'Test'}
                  </button>
                  {!config.isDefault && (
                    <button
                      onClick={() => handleSetDefault(config.id)}
                      className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => { setEditingSmtp(config); setShowSmtpForm(true); }}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setDeleteSmtpConfirm(config)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="mt-2 text-sm font-medium text-gray-900">No SMTP servers configured</p>
            <p className="mt-1 text-sm text-gray-500">Add an SMTP server to start sending emails.</p>
            <button
              onClick={() => { setEditingSmtp(null); setShowSmtpForm(true); }}
              className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add SMTP Server
            </button>
          </div>
        )}
      </div>

      {/* Sending Method */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Email Sending Method</h2>
        <p className="text-sm text-gray-500 mb-4">Choose how campaigns send emails</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setSettings({ ...settings, sendingMethod: 'gmass' })}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              settings.sendingMethod === 'gmass'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                settings.sendingMethod === 'gmass' ? 'border-blue-500' : 'border-gray-300'
              }`}>
                {settings.sendingMethod === 'gmass' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
              </div>
              <span className="font-semibold text-gray-900">GMass</span>
              <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">Recommended</span>
            </div>
            <p className="text-xs text-gray-500 ml-6">Send through GMass via Gmail. Best deliverability, built-in throttling, and auto follow-ups.</p>
          </button>
          <button
            onClick={() => setSettings({ ...settings, sendingMethod: 'smtp' })}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              settings.sendingMethod === 'smtp'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                settings.sendingMethod === 'smtp' ? 'border-blue-500' : 'border-gray-300'
              }`}>
                {settings.sendingMethod === 'smtp' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
              </div>
              <span className="font-semibold text-gray-900">Direct SMTP</span>
            </div>
            <p className="text-xs text-gray-500 ml-6">Send via your own SMTP server. Configure servers in the section above.</p>
          </button>
        </div>
      </div>

      {/* API Keys */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">API Keys</h2>
        <p className="text-sm text-gray-500 mb-4">Configure API keys for lead scraping, verification, and AI features</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GMass API Key</label>
            <input
              type="password"
              value={settings.gmassApiKey}
              onChange={(e) => setSettings({ ...settings, gmassApiKey: e.target.value })}
              placeholder="Enter GMass API key..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
            />
            <p className="mt-1 text-xs text-gray-400">Required for sending campaigns through GMass. Get it from GMass Settings in Gmail.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Apollo.io API Key</label>
            <input
              type="password"
              value={settings.apolloApiKey}
              onChange={(e) => setSettings({ ...settings, apolloApiKey: e.target.value })}
              placeholder="Enter Apollo API key..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
            />
            <p className="mt-1 text-xs text-gray-400">Required for finding contacts and verified emails at target companies</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hunter.io API Key</label>
            <input
              type="password"
              value={settings.hunterApiKey}
              onChange={(e) => setSettings({ ...settings, hunterApiKey: e.target.value })}
              placeholder="Enter Hunter.io API key..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
            />
            <p className="mt-1 text-xs text-gray-400">Required for finding emails by company domain (Ensun import). Free at hunter.io</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Google Maps API Key</label>
            <input
              type="password"
              value={settings.googleMapsApiKey}
              onChange={(e) => setSettings({ ...settings, googleMapsApiKey: e.target.value })}
              placeholder="Enter Google Maps API key..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
            />
            <p className="mt-1 text-xs text-gray-400">Required for Google Maps lead finder. Enable Places API in Google Cloud Console</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ZeroBounce API Key</label>
            <input
              type="password"
              value={settings.zerobounceApiKey}
              onChange={(e) => setSettings({ ...settings, zerobounceApiKey: e.target.value })}
              placeholder="Enter ZeroBounce API key..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
            />
            <p className="mt-1 text-xs text-gray-400">Optional - extra email verification layer before sending</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">OpenAI API Key</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={showApiKey ? settings.openaiApiKey : maskApiKey(settings.openaiApiKey)}
                  onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                />
              </div>
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">Required for AI-powered email personalization</p>
          </div>
        </div>
      </div>

      {/* App Settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Application Settings</h2>
        <p className="text-sm text-gray-500 mb-4">General application configuration</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base URL (Tracking)</label>
            <input
              type="url"
              value={settings.baseUrl}
              onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
              placeholder="https://yourdomain.com"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-400">Used for open/click tracking links. Auto-detected from your current URL.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Daily Send Limit</label>
            <input
              type="number"
              value={settings.dailySendLimit}
              onChange={(e) => setSettings({ ...settings, dailySendLimit: parseInt(e.target.value) || 0 })}
              min={1}
              max={10000}
              className="w-48 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-400">Maximum emails sent per day across all campaigns</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {savingSettings ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Change Password</h2>
        <p className="text-sm text-gray-500 mb-4">Update your login password</p>

        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={async () => {
              if (!currentPassword || !newPassword) {
                showNotification('error', 'Please fill in all fields');
                return;
              }
              if (newPassword !== confirmPassword) {
                showNotification('error', 'New passwords do not match');
                return;
              }
              if (newPassword.length < 6) {
                showNotification('error', 'Password must be at least 6 characters');
                return;
              }
              setChangingPassword(true);
              try {
                const res = await fetch('/api/auth', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'change-password', currentPassword, newPassword }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to change password');
                showNotification('success', 'Password changed successfully');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
              } catch (err) {
                showNotification('error', err instanceof Error ? err.message : 'Failed to change password');
              } finally {
                setChangingPassword(false);
              }
            }}
            disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {changingPassword ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      </div>

      {/* SMTP Form Modal */}
      {showSmtpForm && (
        <Modal
          isOpen={true}
          title={editingSmtp ? 'Edit SMTP Configuration' : 'Add SMTP Configuration'}
          onClose={() => { setShowSmtpForm(false); setEditingSmtp(null); }}
          maxWidth="max-w-2xl"
        >
          <SmtpForm
            config={editingSmtp ?? undefined}
            onSaved={() => { setShowSmtpForm(false); setEditingSmtp(null); fetchSmtpConfigs(); showNotification('success', 'SMTP configuration saved'); }}
            onCancel={() => { setShowSmtpForm(false); setEditingSmtp(null); }}
          />
        </Modal>
      )}

      {/* Delete SMTP Confirmation */}
      {deleteSmtpConfirm && (
        <Modal isOpen={true} title="Delete SMTP Configuration" onClose={() => setDeleteSmtpConfirm(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to delete <strong>{deleteSmtpConfirm.name}</strong>?
              Campaigns using this configuration will need a new SMTP server.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteSmtpConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSmtp(deleteSmtpConfirm)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
