'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/ui/button';
import { PencilIcon, TrashIcon } from '@/ui/icons';

interface RowActionsProps {
  name: string;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Edit and delete stay distinguishable by text, icon and color on every screen size; both
 * stay quiet until hovered so the row's data reads first.
 */
export function RowActions({ name, onEdit, onDelete }: RowActionsProps) {
  const tc = useTranslations('common');
  return (
    <div className="flex shrink-0 justify-end gap-1">
      <Button
        variant="edit"
        size="sm"
        icon={<PencilIcon width={16} height={16} />}
        aria-label={`${tc('edit')} ${name}`}
        onClick={onEdit}
      >
        {tc('edit')}
      </Button>
      <Button
        variant="delete"
        size="sm"
        icon={<TrashIcon width={16} height={16} />}
        aria-label={`${tc('delete')} ${name}`}
        onClick={onDelete}
      >
        {tc('delete')}
      </Button>
    </div>
  );
}
