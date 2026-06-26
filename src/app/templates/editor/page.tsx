'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TemplateEditor from '@/components/TemplateEditor';

function EditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('id') || undefined;

  return (
    <TemplateEditor
      templateId={templateId}
      onSaved={() => router.push('/templates')}
      onCancel={() => router.push('/templates')}
    />
  );
}

export default function TemplateEditorPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 flex items-center justify-center h-64">
          <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <EditorContent />
    </Suspense>
  );
}
