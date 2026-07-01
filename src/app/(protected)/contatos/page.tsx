'use client'
import { useEffect, useState, useCallback } from 'react'
import Toast from '@/components/Toast'
import { normalizePhone, waLink } from '@/lib/whatsapp'
import type { Contact } from '@/lib/supabase'

const TYPE_LABEL: Record<string, string> = {
  vendedor: 'Vendedor',
  comprador: 'Comprador',
}
const TYPE_COLORS: Record<string, string> = {
  vendedor: 'bg-blue-100 text-blue-700',
  comprador: 'bg-purple-100 text-purple-700',
}

export default function ContatosPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Register form
  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [phone, setPhone] = useState('')
  const [type, setType] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Filter + broadcast
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'todos' | 'vendedor' | 'comprador'>('todos')
  const [message, setMessage] = useState('')

  // Edit modal
  const [editContact, setEditContact] = useState<Contact | null>(null)
  const [editName, setEditName] = useState('')
  const [editNickname, setEditNickname] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editType, setEditType] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Delete modal
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(() => {
    fetch('/api/contacts').then(r => r.json()).then(setContacts)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, nickname: nickname || null, phone, type }),
    })
    setSubmitting(false)
    if (res.ok) {
      setName(''); setNickname(''); setPhone(''); setType('')
      load()
      setToast({ msg: 'Contato cadastrado!', type: 'success' })
    } else {
      setToast({ msg: 'Erro ao cadastrar.', type: 'error' })
    }
  }

  function openEdit(c: Contact) {
    setEditContact(c)
    setEditName(c.name)
    setEditNickname(c.nickname ?? '')
    setEditPhone(c.phone)
    setEditType(c.type)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editContact) return
    setEditSaving(true)
    const res = await fetch(`/api/contacts/${editContact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editName,
        nickname: editNickname || null,
        phone: editPhone,
        type: editType,
      }),
    })
    setEditSaving(false)
    if (res.ok) {
      setEditContact(null); load()
      setToast({ msg: 'Contato atualizado!', type: 'success' })
    } else {
      setToast({ msg: 'Erro ao salvar.', type: 'error' })
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    const res = await fetch(`/api/contacts/${deleteId}`, { method: 'DELETE' })
    setDeleting(false)
    setDeleteId(null)
    if (res.ok) {
      load()
      setToast({ msg: 'Contato excluído.', type: 'success' })
    } else {
      setToast({ msg: 'Erro ao excluir.', type: 'error' })
    }
  }

  const filtered = contacts.filter(c => {
    if (typeFilter !== 'todos' && c.type !== typeFilter) return false
    const q = search.trim().toLowerCase()
    if (q && !c.name.toLowerCase().includes(q) && !(c.nickname ?? '').toLowerCase().includes(q)) return false
    return true
  })

  async function copyNumbers() {
    const nums = filtered.map(c => normalizePhone(c.phone)).filter(Boolean).join('\n')
    if (!nums) {
      setToast({ msg: 'Nenhum contato na lista.', type: 'error' })
      return
    }
    try {
      await navigator.clipboard.writeText(nums)
      setToast({ msg: `${filtered.length} número(s) copiado(s)!`, type: 'success' })
    } catch {
      setToast({ msg: 'Não foi possível copiar.', type: 'error' })
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Contatos</h1>

      {/* Register form */}
      <form onSubmit={handleRegister} className="bg-white rounded-xl border border-gray-200 p-5 grid sm:grid-cols-2 gap-4">
        <h2 className="sm:col-span-2 font-semibold text-gray-700">Cadastrar contato</h2>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Nome *</label>
          <input required value={name} onChange={e => setName(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Apelido / loja</label>
          <input value={nickname} onChange={e => setNickname(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">WhatsApp *</label>
          <input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Tipo *</label>
          <select required value={type} onChange={e => setType(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400">
            <option value="">Selecionar...</option>
            <option value="vendedor">Vendedor</option>
            <option value="comprador">Comprador</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors disabled:bg-blue-300">
            {submitting ? 'Cadastrando...' : 'Cadastrar Contato'}
          </button>
        </div>
      </form>

      {/* Filter + broadcast */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Buscar</label>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome ou apelido..." className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Tipo</label>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as 'todos' | 'vendedor' | 'comprador')} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400">
              <option value="todos">Todos</option>
              <option value="vendedor">Vendedores</option>
              <option value="comprador">Compradores</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Mensagem do aviso (opcional)</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2} placeholder="Ex: Amanhã fecharemos às 12h." className="border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-400" />
          <p className="text-xs text-gray-400">A mensagem é usada nos botões de WhatsApp abaixo.</p>
        </div>
        <button
          onClick={copyNumbers}
          className="text-sm border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Copiar números da lista filtrada ({filtered.length})
        </button>
      </div>

      {/* Contact list */}
      {filtered.length === 0 ? (
        <p className="text-gray-400 text-sm pl-2">Nenhum contato.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="font-semibold text-gray-800">{c.name}</span>
                  {c.nickname && <span className="text-gray-500 text-sm">({c.nickname})</span>}
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${TYPE_COLORS[c.type]}`}>{TYPE_LABEL[c.type]}</span>
                </div>
                <p className="text-sm text-gray-600">{c.phone}</p>
              </div>
              <div className="flex sm:flex-col gap-2 items-start sm:items-end">
                <a
                  href={waLink(c.phone, message)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs border border-green-300 text-green-700 hover:bg-green-50 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors"
                >
                  WhatsApp
                </a>
                <button
                  onClick={() => openEdit(c)}
                  className="text-xs border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors text-blue-600"
                >
                  Editar
                </button>
                <button
                  onClick={() => setDeleteId(c.id)}
                  className="text-xs border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors text-red-500"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editContact && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="font-bold text-gray-800 text-lg mb-4">Editar contato</h3>
            <form onSubmit={handleEdit} className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">Nome *</label>
                <input required value={editName} onChange={e => setEditName(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">Apelido / loja</label>
                <input value={editNickname} onChange={e => setEditNickname(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">WhatsApp *</label>
                <input required value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="(11) 99999-9999" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">Tipo *</label>
                <select required value={editType} onChange={e => setEditType(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400">
                  <option value="">Selecionar...</option>
                  <option value="vendedor">Vendedor</option>
                  <option value="comprador">Comprador</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => setEditContact(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
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
            <h3 className="font-bold text-gray-800 text-lg">Excluir contato?</h3>
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
