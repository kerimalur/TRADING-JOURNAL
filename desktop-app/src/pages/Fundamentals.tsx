/**
 * ========================================================================
 * Trading Journal - Fundamentals Page
 * ========================================================================
 * Zusammenführung von COT, News und Währungsanalyse.
 */

import { Globe2 } from 'lucide-react';
import { PageTransition } from '@/components/ui/PageTransition';

export function Fundamentals() {
  return (
    <PageTransition>
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">
            <Globe2 size={24} />
            Fundamentals
          </h1>
        </div>

        <div className="glass-card p-12 text-center mt-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-accent-primary/10 flex items-center justify-center">
            <Globe2 size={36} className="text-accent-primary" />
          </div>
          <h3 className="text-xl font-semibold text-text-primary mb-2">Fundamentals</h3>
          <p className="text-text-muted max-w-md mx-auto">
            Dieser Bereich wird COT-Daten, News und Währungsanalyse vereinen.
          </p>
        </div>
      </div>
    </PageTransition>
  );
}
