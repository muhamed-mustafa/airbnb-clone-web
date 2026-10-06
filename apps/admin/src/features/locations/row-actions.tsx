'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/ui/button';
import { PencilIcon, TrashIcon } from '@/ui/icons';

interface RowActionsProps {
  name: string;
  onEdit: () => void;
  onDelete: () => void;
}

export function RowActions({ name, onEdit, onDelete }: RowActionsProps) {
  const tc = useTranslations('common');
  return (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        className="px-2.5"
        icon={<PencilIcon width={18} height={18} />}
        aria-label={`${tc('edit')} ${name}`}
        onClick={onEdit}
      >
        <span className="max-sm:sr-only">{tc('edit')}</span>
      </Button>
      <Button
        variant="ghost"
        className="px-2.5 text-danger"
        icon={<TrashIcon width={18} height={18} />}
        aria-label={`${tc('delete')} ${name}`}
        onClick={onDelete}
      >
        <span className="max-sm:sr-only">{tc('delete')}</span>
      </Button>
    </div>
  );
}
