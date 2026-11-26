'use client';
import { Printer } from 'lucide-react';
import { useState } from 'react';
import { FloatingCoffee } from '@/components/coffee-button';
import { Button } from '@/components/ui/button';

export function PrintButton() {
  const [thanks, setThanks] = useState(false);
  return (
    <>
      <Button
        onClick={() => {
          window.print();
          setThanks(true);
        }}
      >
        <Printer className="h-4 w-4" aria-hidden /> Print or save as PDF
      </Button>
      {thanks ? <FloatingCoffee onClose={() => setThanks(false)} /> : null}
    </>
  );
}
