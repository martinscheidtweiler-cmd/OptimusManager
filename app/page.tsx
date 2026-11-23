import { redirect } from 'next/navigation'

// Trigger a fresh Vercel preview deployment.
export default function Home() { redirect('/manager') }
