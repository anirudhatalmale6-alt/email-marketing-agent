'use client';

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
  return (
    <div className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all hover:border-gray-300">
      {/* Preview area */}
      <div className="relative h-48 overflow-hidden bg-gray-50 border-b border-gray-100">
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

        {/* Hover overlay with actions */}
        <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              onClick={() => onEdit(id)}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-lg hover:bg-gray-50 transition-colors"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => {
                if (confirm('Delete this template?')) onDelete(id);
              }}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-red-600 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
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
      </div>
    </div>
  );
}
