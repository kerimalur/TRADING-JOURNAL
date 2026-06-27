/**
 * ========================================================================
 * Trading Journal - Funded Journal Page
 * ========================================================================
 * Thin wrapper around the unified JournalPage component.
 */

import { DollarSign } from 'lucide-react';
import { JournalPage } from '@/features/journal/JournalPage';

export function FundedJournal() {
  return (
    <JournalPage
      accountType="funded"
      title="Funded Journal"
      icon={<DollarSign className="text-accent-primary" size={22} />}
    />
  );
}
