'use client';

import { useState } from 'react';

interface TemplateCardProps {
  id: string;
  name: string;
  subject: string;
  category: string;
  thumbnail?: string | null;
  htmlContent?: string;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const categoryColors: Record<string, string> = {
  general: 'bg-gray-100 text-gray-600',
  welcome: 'bg-emerald-100 text-emerald-700',
  promotional: 'bg-purple-100 text-purple-700',
  followup: 'bg-yellow-100 text-yellow-700',
  newsletter: 'bg-blue-100 text-blue-700',
  transactional: 'bg-orange-100 text-orange-700',
};

export default function TemplateCard({
  id,
  name,
  subject,
  category,
  thumbnail,
  htmlContent,
  onEdit,
  onDelete,
}: TemplateCardProps) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <>
      <div className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all hover:border-gray-300">
        {/* Preview area */}
        <div className="relative h-48 overflow-hidden bg-gray-50 border-b border-gray-100 cursor-pointer" onClick={() => htmlContent && setShowPreview(true)}>
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={name}
              className="h-full w-full object-cover object-top"
            />
          ) : htmlContent ? (
            <div className="h-full w-full overflow-hidden p-3">
              <div
                className="h-full w-full origin-top-left scale-[0.4] overflow-hidden pointer-events-none"
                style={{ width: '250%', height: '250%' }}
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
          )}
          {htmlContent && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm flex items-center gap-1.5">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                Preview
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-gray-900 truncate">{name}</h3>
              <p className="mt-0.5 text-xs text-gray-500 truncate" title={subject}>
                Subject: {subject}
              </p>
            </div>
            <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${categoryColors[category] || categoryColors.general}`}>
              {category}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            {htmlContent && (
              <button
                onClick={() => setShowPreview(true)}
                className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
              >
                Preview
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => onEdit(id)}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => {
                  if (confirm('Delete this template?')) onDelete(id);
                }}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && htmlContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowPreview(false)}>
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
                <p className="text-sm text-gray-500 mt-0.5">Subject: {subject}</p>
              </div>
              <button onClick={() => setShowPreview(false)} className="rounded-lg p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-gray-100">
              <div className="mx-auto max-w-[600px] bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <iframe
                  srcDoc={htmlContent}
                  className="w-full border-0"
                  style={{ minHeight: '500px', height: '600px' }}
                  title="Template Preview"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
