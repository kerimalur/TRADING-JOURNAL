/**
 * ========================================================================
 * Trading Journal - EK (Eigenkapital) Journal Page
 * ========================================================================
 * Thin wrapper around the unified JournalPage component.
 */

import { Wallet } from 'lucide-react';
import { JournalPage } from '@/features/journal/JournalPage';

export function EKJournal() {
  return (
    <JournalPage
      accountType="ek"
      title="Eigenkapital Journal"
      icon={<Wallet className="text-accent-primary" size={22} />}
    />
  );
}
