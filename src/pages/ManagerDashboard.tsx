import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BarChart3, Crown, Pencil, Plus, Search, Trash2, UserPlus, Users, X } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import {
  assignMemberToGroup,
  createGroup,
  declineOrLeaveTeam,
  deleteGroup,
  inviteToTeam,
  listMyGroups,
  listMyTeam,
  renameGroup,
  searchPeopleForTeam,
} from '../lib/teams'
import type { PersonRef, TeamEdge, TeamGroup } from '../lib/types'
import { Avatar, Chip, ConfirmDialog, EmptyState, Sheet, Spinner } from '../components/ui'
import { useToast } from '../components/Toast'
import { logSilentError } from '../lib/auditLog'

const COLORS = ['#941010', '#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#4b5563']

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`h-6 w-6 rounded-full transition-transform ${value === c ? 'ring-2 ring-offset-2 ring-offset-surface-card scale-110' : ''}`}
          style={{ background: c }}
          aria-label={c}
        />
      ))}
    </div>
  )
}

const fullName = (p: PersonRef) => `${p.first_name} ${p.last_name}`.trim()

/* ---------------- Adicionar membro ---------------- */
function AddMemberSheet({
  me,
  open,
  onClose,
  known,
  onInvited,
}: {
  me: string
  open: boolean
  onClose: () => void
  known: string[]
  onInvited: () => void
}) {
  const toast = useToast()
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<PersonRef[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const q = term.trim()
    if (q.length < 2) {
      setResults(null)
      return
    }
    const id = setTimeout(() => {
      searchPeopleForTeam(me, q, known)
        .then(setResults)
        .catch(() => setResults([]))
    }, 300)
    return () => clearTimeout(id)
  }, [term, open, me, known])

  async function add(p: PersonRef) {
    setBusy(p.id)
    try {
      await inviteToTeam(me, p.id)
      toast('Convite enviado')
      setTerm('')
      setResults(null)
      onInvited()
      onClose()
    } catch (err) {
      logSilentError('client:ManagerDashboard.add', err)
      toast('Não foi possível enviar o convite', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Adicionar à equipe">
      <div className="relative mb-3">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
        <input
          className="input pl-10"
          placeholder="Buscar por nome ou e-mail"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus
        />
      </div>

      {results === null ? (
        <p className="text-sm text-content-muted py-6 text-center">Digite pelo menos 2 letras para buscar.</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-content-muted py-6 text-center">Nenhum resultado.</p>
      ) : (
        <ul className="space-y-2 max-h-[40vh] overflow-y-auto">
          {results.map((p) => (
            <li key={p.id} className="flex items-center gap-3 p-2 rounded-xl bg-surface-elevated">
              <Avatar first={p.first_name} last={p.last_name} size={36} url={p.avatar_url} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{fullName(p)}</p>
                <p className="text-xs text-content-muted truncate">{p.email}</p>
              </div>
              <button onClick={() => add(p)} disabled={busy === p.id} className="btn-outline h-9 px-3 text-sm shrink-0">
                {busy === p.id ? <Spinner size={14} /> : <UserPlus size={15} />}
                Convidar
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}

/* ---------------- Pagina ---------------- */
export function ManagerDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const me = profile?.id ?? ''

  const [tab, setTab] = useState<'overview' | 'team'>('overview')
  const [edges, setEdges] = useState<TeamEdge[] | null>(null)
  const [groups, setGroups] = useState<TeamGroup[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [pendingRemove, setPendingRemove] = useState<TeamEdge | null>(null)

  const [groupName, setGroupName] = useState('')
  const [groupColor, setGroupColor] = useState(COLORS[0])
  const [editingGroup, setEditingGroup] = useState<TeamGroup | null>(null)
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<TeamGroup | null>(null)

  const [scopeKind, setScopeKind] = useState<'all' | 'group' | 'member'>('all')
  const [scopeGroupId, setScopeGroupId] = useState<string>('')
  const [scopeMemberId, setScopeMemberId] = useState<string>('')

  const refresh = useCallback(() => {
    if (!me) return
    listMyTeam(me)
      .then(setEdges)
      .catch((err) => {
        setEdges([])
        logSilentError('client:ManagerDashboard.refresh', err)
        toast('Não foi possível carregar a equipe', 'error')
      })
    listMyGroups(me)
      .then(setGroups)
      .catch(() => setGroups([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me])

  useEffect(refresh, [refresh])

  const accepted = useMemo(() => (edges ?? []).filter((e) => e.link.status === 'accepted'), [edges])
  const pending = useMemo(() => (edges ?? []).filter((e) => e.link.status === 'pending'), [edges])
  const knownIds = useMemo(() => (edges ?? []).map((e) => e.person.id), [edges])

  async function run(key: string, fn: () => Promise<unknown>, okMsg?: string) {
    setBusy(key)
    try {
      await fn()
      if (okMsg) toast(okMsg)
      refresh()
    } catch (err) {
      logSilentError('client:ManagerDashboard.run', err)
      toast('Não foi possível concluir a ação', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function addGroup() {
    if (!groupName.trim() || !me) return
    try {
      await createGroup(me, groupName, groupColor)
      setGroupName('')
      setGroupColor(COLORS[0])
      refresh()
    } catch (err) {
      logSilentError('client:ManagerDashboard.addGroup', err)
      toast('Não foi possível criar o grupo', 'error')
    }
  }

  async function saveGroupEdit() {
    if (!editingGroup) return
    try {
      await renameGroup(editingGroup.id, editingGroup.name, editingGroup.color)
      setEditingGroup(null)
      refresh()
    } catch (err) {
      logSilentError('client:ManagerDashboard.saveGroupEdit', err)
      toast('Não foi possível salvar o grupo', 'error')
    }
  }

  return (
    <div className="px-5 safe-top pb-12">
      <header className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/config')}
          className="grid place-items-center h-10 w-10 rounded-full bg-surface-elevated border border-surface-border shrink-0"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Crown size={20} className="text-accent" /> Gerente/Sênior
        </h1>
      </header>

      <div className="flex gap-2 mb-6">
        <Chip active={tab === 'overview'} onClick={() => setTab('overview')}>
          Visão geral
        </Chip>
        <Chip active={tab === 'team'} onClick={() => setTab('team')}>
          Equipe
        </Chip>
      </div>

      {tab === 'overview' ? (
        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            <Chip active={scopeKind === 'all'} onClick={() => setScopeKind('all')}>
              Toda equipe
            </Chip>
            <Chip active={scopeKind === 'group'} onClick={() => setScopeKind('group')}>
              Por grupo
            </Chip>
            <Chip active={scopeKind === 'member'} onClick={() => setScopeKind('member')}>
              Individual
            </Chip>
          </div>

          {scopeKind === 'group' && (
            <select
              className="input mb-4"
              value={scopeGroupId}
              onChange={(e) => setScopeGroupId(e.target.value)}
            >
              <option value="">Selecione um grupo...</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}

          {scopeKind === 'member' && (
            <select
              className="input mb-4"
              value={scopeMemberId}
              onChange={(e) => setScopeMemberId(e.target.value)}
            >
              <option value="">Selecione uma pessoa...</option>
              {accepted.map((e) => (
                <option key={e.link.id} value={e.person.id}>
                  {fullName(e.person)}
                </option>
              ))}
            </select>
          )}

          <EmptyState
            icon={<BarChart3 size={40} />}
            title="KPIs em breve"
            subtitle="Os indicadores da equipe ainda vão ser definidos e aparecerão aqui."
          />
        </div>
      ) : (
        <div className="pb-10">
          {/* Grupos */}
          <p className="text-xs uppercase tracking-wide text-content-muted mb-2 px-1">Grupos</p>
          <div className="card p-3 mb-3">
            <div className="flex gap-2 mb-2">
              <input
                className="input py-2"
                placeholder="Nome do grupo"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addGroup()}
              />
              <button className="btn-primary h-11 px-4" onClick={addGroup} disabled={!groupName.trim()}>
                <Plus size={18} /> Criar
              </button>
            </div>
            <ColorPicker value={groupColor} onChange={setGroupColor} />
          </div>

          {groups.length > 0 && (
            <ul className="space-y-2 mb-6">
              {groups.map((g) =>
                editingGroup?.id === g.id ? (
                  <li key={g.id} className="card p-3 space-y-2">
                    <input
                      className="input py-2"
                      value={editingGroup.name}
                      onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                    />
                    <ColorPicker value={editingGroup.color} onChange={(c) => setEditingGroup({ ...editingGroup, color: c })} />
                    <div className="flex gap-2">
                      <button className="btn-outline flex-1 h-9" onClick={() => setEditingGroup(null)}>
                        Cancelar
                      </button>
                      <button className="btn-primary flex-1 h-9" onClick={saveGroupEdit}>
                        Salvar
                      </button>
                    </div>
                  </li>
                ) : (
                  <li key={g.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 border border-surface-border bg-surface-elevated">
                    <span className="h-4 w-4 rounded-full shrink-0" style={{ background: g.color }} />
                    <span className="font-medium text-sm flex-1 min-w-0 truncate">{g.name}</span>
                    <button onClick={() => setEditingGroup(g)} className="text-content-muted hover:text-content-primary" aria-label="Editar grupo">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => setPendingDeleteGroup(g)} className="text-content-muted hover:text-accent" aria-label="Excluir grupo">
                      <Trash2 size={16} />
                    </button>
                  </li>
                ),
              )}
            </ul>
          )}

          {/* Membros */}
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-xs uppercase tracking-wide text-content-muted">Membros</p>
            <button onClick={() => setAddOpen(true)} className="btn-primary h-9 px-3 text-sm">
              <UserPlus size={15} /> Adicionar
            </button>
          </div>

          {pending.length > 0 && (
            <ul className="space-y-2 mb-4">
              {pending.map((e) => (
                <li key={e.link.id} className="card p-3 flex items-center gap-3 opacity-70">
                  <Avatar first={e.person.first_name} last={e.person.last_name} size={40} url={e.person.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{fullName(e.person)}</p>
                    <p className="text-xs text-content-muted">Convite pendente</p>
                  </div>
                  <button
                    onClick={() => run(e.link.id, () => declineOrLeaveTeam(e.link.id), 'Convite cancelado')}
                    disabled={busy === e.link.id}
                    className="grid place-items-center h-9 w-9 rounded-xl text-content-muted hover:text-accent shrink-0"
                    aria-label="Cancelar convite"
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {edges === null ? (
            <div className="grid place-items-center py-16">
              <Spinner className="text-accent" />
            </div>
          ) : accepted.length === 0 && pending.length === 0 ? (
            <EmptyState icon={<Users size={40} />} title="Sua equipe está vazia" subtitle="Adicione alguém para começar." />
          ) : (
            <ul className="space-y-2">
              {accepted.map((e) => (
                <li key={e.link.id} className="card p-3 flex items-center gap-3">
                  <Avatar first={e.person.first_name} last={e.person.last_name} size={40} url={e.person.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{fullName(e.person)}</p>
                    <p className="text-xs text-content-muted truncate">{e.person.email}</p>
                  </div>
                  <select
                    className="input py-1.5 text-sm w-32 shrink-0"
                    value={e.link.group_id ?? ''}
                    onChange={(ev) => run(e.link.id, () => assignMemberToGroup(e.link.id, ev.target.value || null))}
                  >
                    <option value="">Sem grupo</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setPendingRemove(e)}
                    disabled={busy === e.link.id}
                    className="grid place-items-center h-9 w-9 rounded-xl text-content-muted hover:text-accent shrink-0"
                    aria-label="Remover da equipe"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingRemove}
        title="Remover da equipe?"
        message="A pessoa deixa de fazer parte da equipe e o acesso às métricas dela é revogado."
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        danger
        onConfirm={() => {
          const e = pendingRemove
          if (!e) return
          run(e.link.id, () => declineOrLeaveTeam(e.link.id), 'Removido da equipe')
        }}
        onClose={() => setPendingRemove(null)}
      />

      <ConfirmDialog
        open={!!pendingDeleteGroup}
        title="Excluir grupo?"
        message="Os membros deste grupo continuam na equipe, apenas sem grupo atribuído."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        danger
        onConfirm={() => {
          const g = pendingDeleteGroup
          if (!g) return
          deleteGroup(g.id)
            .then(refresh)
            .catch((err) => {
              logSilentError('client:ManagerDashboard.deleteGroup', err)
              toast('Não foi possível excluir o grupo', 'error')
            })
          setPendingDeleteGroup(null)
        }}
        onClose={() => setPendingDeleteGroup(null)}
      />

      {me && <AddMemberSheet me={me} open={addOpen} onClose={() => setAddOpen(false)} known={knownIds} onInvited={refresh} />}
    </div>
  )
}
