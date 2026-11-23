import { redirect } from 'next/navigation'

// Ensure Vercel processes the branch after enabling automatic builds.
export default function Home() { redirect('/manager') }
