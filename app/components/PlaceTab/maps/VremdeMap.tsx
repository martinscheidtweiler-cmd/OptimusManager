'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/app/lib/supabaseClient'
import './VremdeMap.css'

type UnitRow = {
  id: string
  site_id: string
  area_id: string | null
  parent_unit_id: string | null
  name: string
  slug: string | null
  unit_type: string
  description: string | null
  capacity: number
  active: boolean
  sort_order: number
}

type HorsePlaceRow = {
  assignment_id: string
  horse_id: string
  horse_name: string
  horse_active: boolean | null
  site_id: string
  site_name: string
  area_id: string | null
  area_name: string | null
  area_type: string | null
  unit_id: string | null
  unit_name: string | null
  unit_type: string | null
  assigned_at: string
  moved_by: string | null
  move_note: string | null
}

type SiteRow = {
  id: string
  name: string
  slug: string
}

type UnitBlockRow = {
  id: string
  target_type: string
  block_type: string
  product_name: string | null
  reason: string | null
  notes: string | null
  created_by: string | null
  starts_at: string
  ends_at: string
  active: boolean
  site_id: string
  site_name: string | null
  area_id: string | null
  area_name: string | null
  unit_id: string | null
  unit_name: string | null
  unit_type: string | null
}

type PlaceGroupRow = {
  id: string
  site_id: string
  name: string
  active: boolean
  created_at: string
}

type PlaceGroupUnitRow = {
  id: string
  group_id: string
  unit_id: string
  created_at: string
}

type Zone = {
  id: string
  name: string
  unitType: 'pasture' | 'stable'
  points: string
}

const MAP_ZONES: Zone[] = [
  { id: 'vremde-1', name: 'Weide 1', unitType: 'pasture', points: '137,30 233,33 233,190 94,170 94,116 137,116' },
  { id: 'vremde-2', name: 'Weide 2', unitType: 'pasture', points: '15,170 94,170 233,190 260,190 260,240 15,230' },
  { id: 'vremde-3', name: 'Weide 3', unitType: 'pasture', points: '15,230 137,235 137,345 15,345' },
  { id: 'vremde-4', name: 'Weide 4', unitType: 'pasture', points: '137,235 260,240 261,345 137,345' },
  { id: 'vremde-5', name: 'Weide 5', unitType: 'pasture', points: '15,345 137,345 137,430 15,430' },
  { id: 'vremde-6', name: 'Weide 6', unitType: 'pasture', points: '137,345 261,345 261,260 293,260 293,438 293,430 137,430' },
  { id: 'vremde-7', name: 'Weide 7', unitType: 'pasture', points: '293,438 440,438 440,589 293,588' },
  { id: 'vremde-8', name: 'Weide 8', unitType: 'pasture', points: '440,359 580,482 528,550 440,588' },
  { id: 'vremde-9', name: 'Stal 1', unitType: 'stable', points: '233,180 255,180 255,170 293,170 293,190 233,190' },
  { id: 'vremde-10', name: 'Stal 2', unitType: 'stable', points: '260,190 293,190 293,260 261,260' },
]

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('nl-BE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function VremdeMap() {
  const [site, setSite] = useState<SiteRow | null>(null)
  const [units, setUnits] = useState<UnitRow[]>([])
  const [horsePlaces, setHorsePlaces] = useState<HorsePlaceRow[]>([])
  const [blocks, setBlocks] = useState<UnitBlockRow[]>([])
  const [groups, setGroups] = useState<PlaceGroupRow[]>([])
  const [groupUnits, setGroupUnits] = useState<PlaceGroupUnitRow[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [movingHorseId, setMovingHorseId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string>(MAP_ZONES[0].id)

  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)

  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkDays, setBulkDays] = useState('14')
  const [bulkReason, setBulkReason] = useState('bemesten')
  const [selectedBlockUnitIds, setSelectedBlockUnitIds] = useState<string[]>([])
  const [showBlockManager, setShowBlockManager] = useState(false)

  const [groupBusy, setGroupBusy] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [selectedGroupUnitIds, setSelectedGroupUnitIds] = useState<string[]>([])
  const [showGroupManager, setShowGroupManager] = useState(false)

  async function loadData() {
    try {
      setLoading(true)
      setError(null)

      const { data: sitesData, error: sitesError } = await supabase
        .from('sites')
        .select('id, name, slug')
        .eq('slug', 'vremde')
        .limit(1)

      if (sitesError) throw sitesError

      const vremdeSite = sitesData?.[0]
      if (!vremdeSite) throw new Error('Site "vremde" niet gevonden in Supabase.')

      setSite(vremdeSite as SiteRow)

      const [unitsRes, horsesRes, blocksRes, groupsRes, groupUnitsRes] = await Promise.all([
        supabase
          .from('place_units')
          .select('*')
          .eq('site_id', vremdeSite.id)
          .eq('active', true)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),

        supabase
          .from('horse_current_places_v2')
          .select('*')
          .eq('site_id', vremdeSite.id)
          .order('horse_name', { ascending: true }),

        supabase
          .from('place_current_blocks_v2')
          .select('*')
          .eq('site_id', vremdeSite.id)
          .eq('active', true),

        supabase
          .from('place_groups')
          .select('*')
          .eq('site_id', vremdeSite.id)
          .eq('active', true)
          .order('name', { ascending: true }),

        supabase
          .from('place_group_units')
          .select('*'),
      ])

      if (unitsRes.error) throw unitsRes.error
      if (horsesRes.error) throw horsesRes.error
      if (blocksRes.error) throw blocksRes.error
      if (groupsRes.error) throw groupsRes.error
      if (groupUnitsRes.error) throw groupUnitsRes.error

      setUnits((unitsRes.data ?? []) as UnitRow[])
      setHorsePlaces(((horsesRes.data ?? []) as HorsePlaceRow[]).filter((item) => item.horse_active !== false))
      setBlocks((blocksRes.data ?? []) as UnitBlockRow[])
      setGroups((groupsRes.data ?? []) as PlaceGroupRow[])
      setGroupUnits((groupUnitsRes.data ?? []) as PlaceGroupUnitRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij laden')
    } finally {
      setLoading(false)
    }
  }

  async function syncHorseRowLocation(horseId: string, unit: UnitRow) {
    const isStable = unit.unit_type === 'stable'
    const unitName = unit.name?.trim() || ''

    const updatePayload = {
      stable_location: 'Vremde',
      box_number: isStable ? unitName.replace(/^stal\s*/i, '').trim() || unitName : null,
      pasture_name: !isStable ? unitName : null,
    }

    const { error: updateHorseError } = await supabase
      .from('horses')
      .update(updatePayload)
      .eq('id', horseId)

    if (updateHorseError) throw updateHorseError
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('vremde-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'horses' }, async () => {
        await loadData()
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'horse_place_assignments' },
        async () => {
          await loadData()
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'place_units' }, async () => {
        await loadData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'place_blocks' }, async () => {
        await loadData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'place_groups' }, async () => {
        await loadData()
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'place_group_units' },
        async () => {
          await loadData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const zonesWithData = useMemo(() => {
    return MAP_ZONES.map((zone) => {
      const linkedUnit =
        units.find((u) => u.name.trim().toLowerCase() === zone.name.trim().toLowerCase()) ?? null

      const horses = linkedUnit
        ? horsePlaces.filter((item) => item.unit_id === linkedUnit.id)
        : []

      const currentBlock =
        linkedUnit
          ? blocks.find(
              (block) =>
                block.unit_id === linkedUnit.id &&
                block.active === true &&
                new Date(block.ends_at).getTime() > Date.now()
            ) ?? null
          : null

      const memberships = linkedUnit
        ? groupUnits.filter((gu) => gu.unit_id === linkedUnit.id)
        : []

      const activeGroup =
        memberships.length > 0
          ? groups.find((g) => g.id === memberships[0].group_id) ?? null
          : null

      const groupedUnitIds = activeGroup
        ? groupUnits.filter((gu) => gu.group_id === activeGroup.id).map((gu) => gu.unit_id)
        : linkedUnit
          ? [linkedUnit.id]
          : []

      const groupedUnitNames = groupedUnitIds
        .map((id) => units.find((u) => u.id === id)?.name ?? null)
        .filter((v): v is string => !!v)

      const groupedHorses = horsePlaces.filter(
        (horse) => !!horse.unit_id && groupedUnitIds.includes(horse.unit_id)
      )

      return {
        ...zone,
        linkedUnit,
        horses,
        count: horses.length,
        isBlocked: !!currentBlock,
        currentBlock,
        activeGroup,
        groupedUnitIds,
        groupedUnitNames,
        groupedHorses,
      }
    })
  }, [units, horsePlaces, blocks, groups, groupUnits])

  const selectedZone = useMemo(
    () => zonesWithData.find((zone) => zone.id === selectedId) ?? zonesWithData[0] ?? null,
    [selectedId, zonesWithData]
  )

  const hoveredZone = useMemo(
    () => (hoveredId ? zonesWithData.find((z) => z.id === hoveredId) ?? null : null),
    [hoveredId, zonesWithData]
  )

  const horsesInSelectedZone = useMemo(() => {
    if (!selectedZone) return []
    return selectedZone.groupedHorses
  }, [selectedZone])

  const unplacedHorses = useMemo(() => {
    return horsePlaces.filter((item) => !item.unit_id)
  }, [horsePlaces])

  function toggleSelectedBlockUnit(unitId: string) {
    setSelectedBlockUnitIds((prev) =>
      prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId]
    )
  }

  function toggleSelectedGroupUnit(unitId: string) {
    setSelectedGroupUnitIds((prev) =>
      prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId]
    )
  }

  function allowDrop(e: React.DragEvent) {
    e.preventDefault()
  }

  function handleDragStart(horseId: string) {
    setMovingHorseId(horseId)
  }

  function handleDragEnd() {
    setMovingHorseId(null)
  }

  async function moveHorseToZone(horseId: string, zoneName: string) {
    if (!site) return

    const targetZone = zonesWithData.find(
      (zone) => zone.name.trim().toLowerCase() === zoneName.trim().toLowerCase()
    )

    if (!targetZone?.linkedUnit) {
      setError(`Geen gekoppelde unit gevonden in Supabase voor "${zoneName}".`)
      return
    }

    if (targetZone.isBlocked) {
      setError(`${targetZone.name} is tijdelijk afgesloten.`)
      return
    }

    try {
      setMovingHorseId(horseId)
      setError(null)

      const { error: moveError } = await supabase.rpc('move_horse_v2', {
        p_horse_id: horseId,
        p_site_id: site.id,
        p_area_id: targetZone.linkedUnit.area_id,
        p_unit_id: targetZone.linkedUnit.id,
        p_moved_by: 'Martin',
        p_move_note: `Verplaatst naar ${targetZone.linkedUnit.name} via Vremde map`,
        p_assigned_at: new Date().toISOString(),
      })

      if (moveError) throw moveError

      await syncHorseRowLocation(horseId, targetZone.linkedUnit)
      await loadData()
      setSelectedId(targetZone.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij verplaatsen')
    } finally {
      setMovingHorseId(null)
    }
  }

  async function handleDrop(zoneName: string, e: React.DragEvent) {
    e.preventDefault()

    const horseId = e.dataTransfer.getData('text/plain')
    if (!horseId) return

    const zone = zonesWithData.find(
      (z) => z.name.trim().toLowerCase() === zoneName.trim().toLowerCase()
    )

    if (zone?.isBlocked) {
      setError(`${zone.name} is tijdelijk afgesloten.`)
      return
    }

    await moveHorseToZone(horseId, zoneName)
  }

  async function blockSelectedUnits() {
    if (!site) return
    if (!selectedBlockUnitIds.length) {
      setError('Duid eerst minstens 1 weide of stal aan.')
      return
    }

    const days = Number(bulkDays)
    if (!Number.isFinite(days) || days <= 0) {
      setError('Geef een geldig aantal dagen in.')
      return
    }

    try {
      setBulkBusy(true)
      setError(null)

      const startsAt = new Date()
      const endsAt = new Date()
      endsAt.setDate(endsAt.getDate() + days)

      const rows = selectedBlockUnitIds
        .map((unitId) => {
          const unit = units.find((u) => u.id === unitId)
          if (!unit) return null

          return {
            target_type: 'unit',
            site_id: site.id,
            area_id: unit.area_id,
            unit_id: unit.id,
            block_type: 'maintenance',
            product_name: null,
            reason: bulkReason?.trim() || 'bemesten',
            notes: `Automatisch ${days} dagen geblokkeerd via Vremde map`,
            created_by: 'Martin',
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
            active: true,
          }
        })
        .filter(Boolean)

      if (!rows.length) {
        setError('Geen geldige plaatsen geselecteerd.')
        return
      }

      const { error: insertError } = await supabase.from('place_blocks').insert(rows)

      if (insertError) throw new Error(insertError.message || 'Fout bij blokkeren')

      setSelectedBlockUnitIds([])
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij blokkeren')
    } finally {
      setBulkBusy(false)
    }
  }

  async function unblockSelectedUnits() {
    try {
      setBulkBusy(true)
      setError(null)

      const targetIds = [...selectedBlockUnitIds]
      if (!targetIds.length) {
        setError('Duid eerst minstens 1 geblokkeerde weide of stal aan.')
        return
      }

      const ids = blocks
        .filter(
          (block) =>
            !!block.unit_id &&
            targetIds.includes(block.unit_id) &&
            block.active === true &&
            new Date(block.ends_at).getTime() > Date.now()
        )
        .map((block) => block.id)

      if (!ids.length) {
        setError('Geen actieve blokkeringen gevonden voor de geselecteerde plaatsen.')
        return
      }

      const nowIso = new Date().toISOString()

      const { error: updateError } = await supabase
        .from('place_blocks')
        .update({
          active: false,
          ends_at: nowIso,
        })
        .in('id', ids)

      if (updateError) throw new Error(updateError.message || 'Fout bij vrijgeven')

      setSelectedBlockUnitIds([])
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij vrijgeven')
    } finally {
      setBulkBusy(false)
    }
  }

  async function saveGroup() {
    if (!site) return
    if (selectedGroupUnitIds.length < 2) {
      setError('Kies minstens 2 plaatsen om te koppelen.')
      return
    }

    try {
      setGroupBusy(true)
      setError(null)

      const currentGroupId = selectedZone?.activeGroup?.id ?? null

      if (currentGroupId) {
        const { error: deleteMembersError } = await supabase
          .from('place_group_units')
          .delete()
          .eq('group_id', currentGroupId)

        if (deleteMembersError) throw deleteMembersError

        const { error: updateGroupError } = await supabase
          .from('place_groups')
          .update({
            name: groupName.trim() || selectedZone?.activeGroup?.name || 'Open verbinding',
          })
          .eq('id', currentGroupId)

        if (updateGroupError) throw updateGroupError

        const rows = selectedGroupUnitIds.map((unitId) => ({
          group_id: currentGroupId,
          unit_id: unitId,
        }))

        const { error: insertMembersError } = await supabase
          .from('place_group_units')
          .insert(rows)

        if (insertMembersError) throw insertMembersError
      } else {
        const { data: newGroup, error: groupError } = await supabase
          .from('place_groups')
          .insert({
            site_id: site.id,
            name: groupName.trim() || 'Open verbinding',
            active: true,
          })
          .select('id')
          .single()

        if (groupError) throw groupError

        const rows = selectedGroupUnitIds.map((unitId) => ({
          group_id: newGroup.id,
          unit_id: unitId,
        }))

        const { error: insertMembersError } = await supabase
          .from('place_group_units')
          .insert(rows)

        if (insertMembersError) throw insertMembersError
      }

      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij koppelen')
    } finally {
      setGroupBusy(false)
    }
  }

  async function removeCurrentGroup() {
    const currentGroupId = selectedZone?.activeGroup?.id
    if (!currentGroupId) return

    try {
      setGroupBusy(true)
      setError(null)

      const { error: deleteMembersError } = await supabase
        .from('place_group_units')
        .delete()
        .eq('group_id', currentGroupId)

      if (deleteMembersError) throw deleteMembersError

      const { error: updateGroupError } = await supabase
        .from('place_groups')
        .update({ active: false })
        .eq('id', currentGroupId)

      if (updateGroupError) throw updateGroupError

      setGroupName('')
      setSelectedGroupUnitIds([])
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij verwijderen van koppeling')
    } finally {
      setGroupBusy(false)
    }
  }

  useEffect(() => {
    if (!selectedZone) return

    setGroupName(selectedZone.activeGroup?.name ?? '')

    if (selectedZone.activeGroup) {
      setSelectedGroupUnitIds(selectedZone.groupedUnitIds)
    } else if (selectedZone.linkedUnit?.id) {
      setSelectedGroupUnitIds([selectedZone.linkedUnit.id])
    } else {
      setSelectedGroupUnitIds([])
    }
  }, [selectedZone?.id, selectedZone?.activeGroup?.id])

  return (
    <div className="vremde-shell">
      <div className="vremde-layout">
        <div className="vremde-map-card">
          <div className="vremde-card-head">
            <div>
              <h2>Vremde</h2>
              <p>Sleep een paard naar een weide of stal. Hover voor info.</p>
            </div>
            {loading ? <span className="vremde-small-note">Laden...</span> : null}
          </div>

          {error ? <div className="vremde-error">{error}</div> : null}

          <div className="vremde-map-stage">
            <img
              src="/maps/vremde-map.png"
              alt="Vremde map"
              className="vremde-map-image"
            />

            <svg
              className="vremde-map-overlay"
              viewBox="0 0 629 628"
              preserveAspectRatio="none"
            >
              {zonesWithData.map((zone) => (
                <g key={zone.id}>
                  <polygon
                    points={zone.points}
                    className={`vremde-zone ${
                      zone.unitType === 'stable' ? 'is-stable' : 'is-pasture'
                    } ${zone.isBlocked ? 'is-blocked' : ''} ${
                      selectedId === zone.id ? 'is-active' : ''
                    } ${zone.activeGroup ? 'is-grouped' : ''}`}
                    onClick={() => setSelectedId(zone.id)}
                    onDragOver={allowDrop}
                    onDrop={(e) => handleDrop(zone.name, e)}
                    onMouseEnter={(e) => {
                      setHoveredId(zone.id)
                      setHoverPos({ x: e.clientX, y: e.clientY })
                    }}
                    onMouseMove={(e) => {
                      setHoverPos({ x: e.clientX, y: e.clientY })
                    }}
                    onMouseLeave={() => {
                      setHoveredId(null)
                      setHoverPos(null)
                    }}
                  />
                </g>
              ))}
            </svg>
          </div>

          {hoveredZone && hoverPos ? (
            <div
              className="vremde-hover-card"
              style={{
                left: hoverPos.x,
                top: hoverPos.y,
              }}
            >
              <div className="vremde-hover-head">
                <strong>{hoveredZone.name}</strong>
                <span>{hoveredZone.unitType === 'stable' ? 'Stal' : 'Weide'}</span>
              </div>

              {hoveredZone.activeGroup ? (
                <div className="vremde-hover-group">
                  Verbonden: {hoveredZone.groupedUnitNames.join(' + ')}
                </div>
              ) : null}

              {hoveredZone.isBlocked && hoveredZone.currentBlock ? (
                <div className="vremde-hover-alert">
                  Afgesloten voor {hoveredZone.currentBlock.reason ?? 'blokkering'} tot{' '}
                  {formatDateTime(hoveredZone.currentBlock.ends_at)}
                </div>
              ) : null}

              <div className="vremde-hover-section">
                <span>
                  {hoveredZone.activeGroup
                    ? `${hoveredZone.groupedHorses.length} paard(en) in gekoppelde zone`
                    : `${hoveredZone.count} paard(en)`}
                </span>
              </div>

              <div className="vremde-hover-horses">
                {(hoveredZone.activeGroup ? hoveredZone.groupedHorses : hoveredZone.horses).length ? (
                  (hoveredZone.activeGroup ? hoveredZone.groupedHorses : hoveredZone.horses).map((horse) => (
                    <div key={horse.horse_id} className="vremde-hover-horse">
                      <strong>{horse.horse_name}</strong>
                      <span>{horse.unit_name ?? '—'}</span>
                    </div>
                  ))
                ) : (
                  <div className="vremde-hover-empty">Geen paarden</div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="vremde-sidebar">
          <div className="vremde-panel">
            <h3>Geselecteerde plaats</h3>

            {selectedZone ? (
              <>
                <div className="vremde-selected-name">{selectedZone.name}</div>

                <div className="vremde-selected-meta">
                  <span>{selectedZone.unitType === 'stable' ? 'Stal' : 'Weide'}</span>
                  <span>{horsesInSelectedZone.length} paard(en)</span>
                  {selectedZone.isBlocked ? <span className="is-red">Geblokkeerd</span> : null}
                  {selectedZone.activeGroup ? <span className="is-blue">Gekoppeld</span> : null}
                </div>

                {selectedZone.activeGroup ? (
                  <div className="vremde-group-banner">
                    <strong>{selectedZone.activeGroup.name}</strong>
                    <span>{selectedZone.groupedUnitNames.join(' + ')}</span>
                  </div>
                ) : null}

                <div
                  className={`vremde-dropbox ${selectedZone.isBlocked ? 'is-disabled' : ''}`}
                  onDragOver={allowDrop}
                  onDrop={(e) => handleDrop(selectedZone.name, e)}
                >
                  {selectedZone.isBlocked
                    ? 'Deze plaats is tijdelijk afgesloten'
                    : 'Sleep paard hierheen'}
                </div>

                <div className="vremde-list">
                  {horsesInSelectedZone.length ? (
                    horsesInSelectedZone.map((horse) => (
                      <div
                        key={horse.horse_id}
                        className={`vremde-horse-row is-draggable ${
                          movingHorseId === horse.horse_id ? 'is-dragging' : ''
                        }`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', horse.horse_id)
                          handleDragStart(horse.horse_id)
                        }}
                        onDragEnd={handleDragEnd}
                      >
                        <div>
                          <strong>{horse.horse_name}</strong>
                          <span>{horse.unit_name ?? '—'}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="vremde-empty">Geen paarden in deze plaats.</div>
                  )}
                </div>
              </>
            ) : (
              <div className="vremde-empty">Geen plaats geselecteerd.</div>
            )}
          </div>

          <div className="vremde-panel">
            <h3>Alle paarden</h3>

            <div className="vremde-list">
              {horsePlaces.length ? (
                horsePlaces.map((horse) => (
                  <div
                    key={horse.horse_id}
                    className={`vremde-horse-row is-draggable ${
                      movingHorseId === horse.horse_id ? 'is-dragging' : ''
                    }`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', horse.horse_id)
                      handleDragStart(horse.horse_id)
                    }}
                    onDragEnd={handleDragEnd}
                  >
                    <div>
                      <strong>{horse.horse_name}</strong>
                      <span>{horse.unit_name ?? 'Nog niet geplaatst'}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="vremde-empty">Geen actieve paarden gevonden.</div>
              )}
            </div>

            <div className="vremde-collapsible">
              <button
                type="button"
                className="vremde-collapse-btn"
                onClick={() => setShowBlockManager((prev) => !prev)}
              >
                {showBlockManager ? 'Sluit tijdelijk sluiten' : 'Open tijdelijk sluiten'}
              </button>

              {showBlockManager ? (
                <div className="vremde-block-manager">
                  <h4>Weides / stallen tijdelijk sluiten</h4>

                  <div className="vremde-check-grid">
                    {zonesWithData.map((zone) => {
                      const unitId = zone.linkedUnit?.id
                      if (!unitId) return null

                      return (
                        <label key={zone.id} className="vremde-check-item">
                          <input
                            type="checkbox"
                            checked={selectedBlockUnitIds.includes(unitId)}
                            onChange={() => toggleSelectedBlockUnit(unitId)}
                          />
                          <span>{zone.name}</span>
                          {zone.isBlocked ? <em>al dicht</em> : null}
                        </label>
                      )
                    })}
                  </div>

                  <div className="vremde-block-form">
                    <div className="vremde-field">
                      <label>Aantal dagen</label>
                      <input
                        type="number"
                        min="1"
                        value={bulkDays}
                        onChange={(e) => setBulkDays(e.target.value)}
                      />
                    </div>

                    <div className="vremde-field">
                      <label>Reden</label>
                      <input
                        type="text"
                        value={bulkReason}
                        onChange={(e) => setBulkReason(e.target.value)}
                        placeholder="bv. bemesten"
                      />
                    </div>
                  </div>

                  <div className="vremde-block-actions">
                    <button
                      type="button"
                      className="vremde-btn-primary"
                      onClick={blockSelectedUnits}
                      disabled={bulkBusy}
                    >
                      Geselecteerde plaatsen sluiten
                    </button>

                    <button
                      type="button"
                      className="vremde-btn-secondary"
                      onClick={unblockSelectedUnits}
                      disabled={bulkBusy}
                    >
                      Geselecteerde plaatsen vrijgeven
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="vremde-panel">
            <h3>Plaatsen koppelen</h3>

            <div className="vremde-collapsible">
              <button
                type="button"
                className="vremde-collapse-btn"
                onClick={() => setShowGroupManager((prev) => !prev)}
              >
                {showGroupManager ? 'Sluit plaatsen koppelen' : 'Open plaatsen koppelen'}
              </button>

              {showGroupManager ? (
                <>
                  <div className="vremde-field" style={{ marginTop: 14 }}>
                    <label>Naam koppeling</label>
                    <input
                      type="text"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="bv. Open verbinding Stal 2 + Weide 1 + Weide 2"
                    />
                  </div>

                  <div className="vremde-check-grid">
                    {zonesWithData.map((zone) => {
                      const unitId = zone.linkedUnit?.id
                      if (!unitId) return null

                      return (
                        <label key={zone.id} className="vremde-check-item">
                          <input
                            type="checkbox"
                            checked={selectedGroupUnitIds.includes(unitId)}
                            onChange={() => toggleSelectedGroupUnit(unitId)}
                          />
                          <span>{zone.name}</span>
                        </label>
                      )
                    })}
                  </div>

                  <div className="vremde-block-actions">
                    <button
                      type="button"
                      className="vremde-btn-primary"
                      onClick={saveGroup}
                      disabled={groupBusy}
                    >
                      Koppeling opslaan
                    </button>

                    {selectedZone?.activeGroup ? (
                      <button
                        type="button"
                        className="vremde-btn-secondary"
                        onClick={removeCurrentGroup}
                        disabled={groupBusy}
                      >
                        Koppeling verwijderen
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {unplacedHorses.length > 0 ? (
            <div className="vremde-panel">
              <h3>Nog niet geplaatst</h3>
              <div className="vremde-list">
                {unplacedHorses.map((horse) => (
                  <div
                    key={horse.horse_id}
                    className={`vremde-horse-row is-draggable ${
                      movingHorseId === horse.horse_id ? 'is-dragging' : ''
                    }`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', horse.horse_id)
                      handleDragStart(horse.horse_id)
                    }}
                    onDragEnd={handleDragEnd}
                  >
                    <div>
                      <strong>{horse.horse_name}</strong>
                      <span>Sleep naar een weide of stal</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  )
}