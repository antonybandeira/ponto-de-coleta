'use client'
import { useEffect, useState, useCallback } from 'react'
import { formatDate } from '@/lib/format'
import Toast from '@/components/Toast'
import type { Occurrence } from '@/lib/supabase'

const PLATFORMS = ['Mercado Livre', 'Shopee', 'Amazon', 'Loggi', 'Outro']
const STATUS_LABEL: Record<string, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  resolvido: 'Resolvido',
}
const STATUS_COLORS: Record<string, string> = {
  aberto: 'bg-red-100 text-red-700',
  em_andamento: 'bg-yellow-100 text-yellow-700',
  resolvido: 'bg-green-100 text-green-700',
}
const NEXT_STATUS: Record<string, string> = {
  aberto: 'em_andamento',
  em_andamento: 'resolvido',
  resolvido: 'aberto',
}

export default function OcorrenciasPage() {
  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Register form
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [platform, setPlatform] = useState('')
  const [desc, setDesc] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Status change modal
  const [statusModal, setStatusModal] = useState<{ id: string; nextStatus: string } | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState('')

  // Edit modal
  const [editOcc, setEditOcc] = useState<Occurrence | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editPlatform, setEditPlatform] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Delete modal
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(() => {
    fetch('/api/occurrences').then(r => r.json()).then(setOccurrences)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const res = await fetch('/api/occurrences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: name, customer_phone: phone || null, platform: platform || null, description: desc }),
    })
    setSubmitting(false)
    if (res.ok) {
      setName(''); setPhone(''); setPlatform(''); setDesc('')
      load()
      setToast({ msg: 'Ocorrência registrada!', type: 'success' })
    } else {
      setToast({ msg: 'Erro ao registrar.', type: 'error' })
    }
  }

  async function confirmStatusChange() {
    if (!statusModal) return
    const res = await fetch(`/api/occurrences/${statusModal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: statusModal.nextStatus, resolution_notes: resolutionNotes || null }),
    })
    if (res.ok) {
      setStatusModal(null); setResolutionNotes(''); load()
      setToast({ msg: 'Status atualizado!', type: 'success' })
    }
  }

  function openEdit(o: Occurrence) {
    setEditOcc(o)
    setEditName(o.customer_name)
    setEditPhone(o.customer_phone ?? '')
    setEditPlatform(o.platform ?? '')
    setEditDesc(o.description)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editOcc) return
    setEditSaving(true)
    const res = await fetch(`/api/occurrences/${editOcc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: editName,
        customer_phone: editPhone || null,
        platform: editPlatform || null,
        description: editDesc,
      }),
    })
    setEditSaving(false)
    if (res.ok) {
      setEditOcc(null); load()
      setToast({ msg: 'Ocorrência atualizada!', type: 'success' })
    } else {
      setToast({ msg: 'Erro ao salvar.', type: 'error' })
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    const res = await fetch(`/api/occurrences/${deleteId}`, { method: 'DELETE' })
    setDeleting(false)
    setDeleteId(null)
    if (res.ok) {
      load()
      setToast({ msg: 'Ocorrência excluída.', type: 'success' })
    } else {
      setToast({ msg: 'Erro ao excluir.', type: 'error' })
    }
  }

  const groups: Record<string, Occurrence[]> = { aberto: [], em_andamento: [], resolvido: [] }
  for (const o of occurrences) groups[o.status]?.push(o)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Ocorrências</h1>

      {/* Register form */}
      <form onSubmit={handleRegister} className="bg-white rounded-xl border border-gray-200 p-5 grid sm:grid-cols-2 gap-4">
        <h2 className="sm:col-span-2 font-semibold text-gray-700">Registrar ocorrência</h2>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Nome do cliente *</label>
          <input required value={name} onChange={e => setName(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Telefone</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Plataforma</label>
          <select value={platform} onChange={e => setPlatform(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400">
            <option value="">Selecionar...</option>
            {PLATFORMS.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-xs text-gray-500 font-medium">Descrição *</label>
          <textarea required value={desc} onChange={e => setDesc(e.target.value)} rows={3} className="border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-400" />
        </div>
        <div className="sm:col-span-2">
          <button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors disabled:bg-blue-300">
            {submitting ? 'Registrando...' : 'Registrar Ocorrência'}
          </button>
        </div>
      </form>

      {/* Groups */}
      {(['aberto', 'em_andamento', 'resolvido'] as const).map(status => (
        <div key={status}>
          <h2 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${STATUS_COLORS[status]}`}>{STATUS_LABEL[status]}</span>
            <span className="text-gray-400 text-sm">({groups[status].length})</span>
          </h2>
          {groups[status].length === 0 ? (
            <p className="text-gray-400 text-sm pl-2">Nenhuma.</p>
          ) : (
            <div className="space-y-2">
              {groups[status].map(o => (
                <div key={o.id} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="font-semibold text-gray-800">{o.customer_name}</span>
                      {o.customer_phone && (
                        <a href={`tel:${o.customer_phone}`} className="text-blue-600 text-sm hover:underline">{o.customer_phone}</a>
                      )}
                      {o.platform && (
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">{o.platform}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700">{o.description}</p>
                    {o.resolution_notes && (
                      <p className="text-xs text-green-700 bg-green-50 rounded px-2 py-1">Resolução: {o.resolution_notes}</p>
                    )}
                    <p className="text-xs text-gray-400">{formatDate(o.created_at)}{o.resolved_at && ` · Resolvido em ${formatDate(o.resolved_at)}`}</p>
                  </div>
                  <div className="flex sm:flex-col gap-2 items-start sm:items-end">
                    <button
                      onClick={() => { setStatusModal({ id: o.id, nextStatus: NEXT_STATUS[o.status] }); setResolutionNotes('') }}
                      className="text-xs border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors"
                    >
                      → {STATUS_LABEL[NEXT_STATUS[o.status]]}
                    </button>
                    <button
                      onClick={() => openEdit(o)}
                      className="text-xs border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors text-blue-600"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setDeleteId(o.id)}
                      className="text-xs border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors text-red-500"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Status change modal */}
      {statusModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-gray-800 text-lg">Mudar status para <span className={`px-2 py-0.5 rounded text-sm ${STATUS_COLORS[statusModal.nextStatus]}`}>{STATUS_LABEL[statusModal.nextStatus]}</span></h3>
            {statusModal.nextStatus === 'resolvido' && (
              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-500">Notas de resolução</label>
                <textarea value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} rows={3} className="border border-gray-200 rounded-lg p-2 text-sm resize-none focus:outline-none focus:border-blue-400" placeholder="Descreva como foi resolvido..." />
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setStatusModal(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={confirmStatusChange} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editOcc && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="font-bold text-gray-800 text-lg mb-4">Editar ocorrência</h3>
            <form onSubmit={handleEdit} className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">Nome do cliente *</label>
                <input required value={editName} onChange={e => setEditName(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">Telefone</label>
                <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="(11) 99999-9999" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">Plataforma</label>
                <select value={editPlatform} onChange={e => setEditPlatform(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400">
                  <option value="">Selecionar...</option>
                  {PLATFORMS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">Descrição *</label>
                <textarea required value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} className="border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-400" />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => setEditOcc(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={editSaving} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg font-medium">
                  {editSaving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-gray-800 text-lg">Excluir ocorrência?</h3>
            <p className="text-sm text-gray-500">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-lg font-medium"
              >
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
