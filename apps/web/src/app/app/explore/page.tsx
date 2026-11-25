import { redirect } from 'next/navigation';

/** Explore is now "Make a specific comparison" on the This or that page. */
export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const { a, b } = await searchParams;
  redirect(`/app/compare?mode=specific${a ? `&a=${encodeURIComponent(a)}` : ''}${b ? `&b=${encodeURIComponent(b)}` : ''}`);
}
