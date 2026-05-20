'use client'

import type { DailyStatus, Horse, RidingPlanWithHorse, Staff } from './OperationsTab'

type Props = {
  todayStaff: Staff[]
  sportHorses: Horse[]
  ridingPlans: RidingPlanWithHorse[]
  getStatus: (horseId: string) => DailyStatus
  updateStatus: (horseId: string, patch: Partial<DailyStatus>) => void
}

export default function TodayView({
  todayStaff,
  sportHorses,
  ridingPlans,
  getStatus,
  updateStatus,
}: Props) {
  return (
    <div className="ops-today-grid">
      <article className="ops-panel">
        <div className="ops-panel-head">
          <div>
            <span>Step 1</span>
            <h3>Present today</h3>
          </div>
          <strong>{todayStaff.length}</strong>
        </div>

        <div className="ops-mini-list">
          {todayStaff.map((person) => (
            <div key={person.id} className="ops-mini-row">
              <strong>{person.name}</strong>
              <span>
                {person.role || 'Staff'} · {person.start_time?.slice(0, 5)}-
                {person.end_time?.slice(0, 5)}
              </span>
            </div>
          ))}
        </div>
      </article>

      <article className="ops-panel ops-wide">
        <div className="ops-panel-head">
          <div>
            <span>Step 2</span>
            <h3>Riding planning today</h3>
          </div>
          <strong>{ridingPlans.length}</strong>
        </div>

        {ridingPlans.length === 0 ? (
          <div className="ops-empty-task">
            No riding planning for today. Add horses in Planning tab first.
          </div>
        ) : (
          <div className="ops-ride-list">
            {ridingPlans.map((plan) => (
              <div key={plan.id} className="ops-ride-row">
                <div>
                  <strong>{plan.horseName}</strong>
                  <span>
                    {plan.stableLocation}
                    {plan.boxNumber ? ` · Box ${plan.boxNumber}` : ''}
                  </span>
                </div>

                <div className="ops-ride-pill">
                  {plan.rider_name} · {plan.ride_type || 'Ride'} · {plan.minutes || 40} min
                </div>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="ops-panel ops-wide">
        <div className="ops-panel-head">
          <div>
            <span>Step 3</span>
            <h3>47B horse exceptions</h3>
          </div>
          <strong>{sportHorses.length}</strong>
        </div>

        <div className="ops-horse-list">
          {sportHorses.map((horse) => {
            const status = getStatus(horse.id)

            return (
              <div key={horse.id} className="ops-horse-row">
                <div className="ops-horse-main">
                  <strong>{horse.name || 'Unnamed horse'}</strong>
                  <span>
                    {horse.stable_location || 'No location'}
                    {horse.box_number ? ` · Box ${horse.box_number}` : ''}
                  </span>
                </div>

                <label>
                  <input
                    type="checkbox"
                    checked={status.vet_visit}
                    onChange={(event) =>
                      updateStatus(horse.id, {
                        vet_visit: event.target.checked,
                        stay_inside: event.target.checked ? true : status.stay_inside,
                      })
                    }
                  />
                  Vet
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={status.stay_inside}
                    onChange={(event) =>
                      updateStatus(horse.id, {
                        stay_inside: event.target.checked,
                      })
                    }
                  />
                  Inside
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={status.medication}
                    onChange={(event) =>
                      updateStatus(horse.id, {
                        medication: event.target.checked,
                      })
                    }
                  />
                  Meds
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={status.skip_walker}
                    onChange={(event) =>
                      updateStatus(horse.id, {
                        skip_walker: event.target.checked,
                      })
                    }
                  />
                  No walker
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={status.skip_turnout}
                    onChange={(event) =>
                      updateStatus(horse.id, {
                        skip_turnout: event.target.checked,
                      })
                    }
                  />
                  No turnout
                </label>
              </div>
            )
          })}
        </div>
      </article>
    </div>
  )
}