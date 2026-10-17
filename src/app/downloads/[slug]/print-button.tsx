'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * "Download PDF" — opens the browser's print dialog, where every modern
 * browser offers "Save as PDF". No PDF library, nothing generated server-side.
 */
export function PrintButton() {
  return (
    <Button variant="accent" size="sm" onClick={() => window.print()} className="print:hidden">
      <Download className="h-4 w-4" aria-hidden="true" />
      Download PDF
    </Button>
  );
}
