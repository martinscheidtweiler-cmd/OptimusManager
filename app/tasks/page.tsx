import { redirect } from 'next/navigation'

// Legacy staff/training planner is deliberately not part of the new stable manager.
export default function Tasks() { redirect('/manager') }
