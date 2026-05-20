'use client'

import type { Staff } from './OperationsTab'

export default function StaffView({ staff }: { staff: Staff[] }) {
  return (
    <div className="ops-list">
      {staff.map((person) => (
        <article key={person.id} className="ops-person">
          <strong>{person.name}</strong>
          <span>
            {person.role || 'Staff'} · {person.start_time?.slice(0, 5)}-
            {person.end_time?.slice(0, 5)}
          </span>
        </article>
      ))}
    </div>
  )
}