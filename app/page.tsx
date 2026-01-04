'use client'

import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import { supabase, Contact } from '@/lib/supabase'

export default function Home() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [csvData, setCsvData] = useState<any[]>([])
  const [fieldMapping, setFieldMapping] = useState({
    phone: '',
    first_name: '',
    last_name: '',
    company: '',
    location: '',
    industry: ''
  })
  const [loading, setLoading] = useState(false)
  const [calling, setCalling] = useState(false)
  const [stats, setStats] = useState({ ready: 0, answered: 0, noAnswer: 0, exhausted: 0 })

  useEffect(() => {
    loadContacts()
    loadStats()
  }, [])

  async function loadContacts() {
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (data) setContacts(data)
  }

  async function loadStats() {
    const { data } = await supabase
      .from('contacts')
      .select('status')

    if (data) {
      setStats({
        ready: data.filter(c => c.status === 'ready').length,
        answered: data.filter(c => c.status === 'answered').length,
        noAnswer: data.filter(c => ['no_answer', 'failed'].includes(c.status)).length,
        exhausted: data.filter(c => c.status === 'exhausted').length
      })
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      complete: (results) => {
        setCsvData(results.data)
        const headers = results.meta.fields || []
        const newMapping = { ...fieldMapping }

        headers.forEach(h => {
          const lower = h.toLowerCase()
          if (lower.includes('phone') || lower.includes('mobile')) newMapping.phone = h
          if (lower.includes('first') && lower.includes('name')) newMapping.first_name = h
          if (lower.includes('last') && lower.includes('name')) newMapping.last_name = h
          if (lower.includes('company') || lower.includes('business')) newMapping.company = h
          if (lower.includes('city') || lower.includes('location') || lower.includes('state')) newMapping.location = h
          if (lower.includes('industry') || lower.includes('type')) newMapping.industry = h
        })

        setFieldMapping(newMapping)
      }
    })
  }

  async function importContacts() {
    if (csvData.length === 0) return
    setLoading(true)

    const contactsToInsert = csvData
      .filter(row => row[fieldMapping.phone])
      .map(row => ({
        phone: row[fieldMapping.phone],
        first_name: row[fieldMapping.first_name] || '',
        last_name: row[fieldMapping.last_name] || '',
        company: row[fieldMapping.company] || '',
        location: row[fieldMapping.location] || '',
        industry: row[fieldMapping.industry] || '',
        status: 'ready',
        call_count: 0
      }))

    const { error } = await supabase.from('contacts').insert(contactsToInsert)

    if (error) {
      alert('Error importing: ' + error.message)
    } else {
      alert(`Imported ${contactsToInsert.length} contacts!`)
      setCsvData([])
      loadContacts()
      loadStats()
    }

    setLoading(false)
  }

  function toggleContact(id: string) {
    const newSelected = new Set(selectedContacts)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedContacts(newSelected)
  }

  function selectAllReady() {
    const readyIds = contacts.filter(c => c.status === 'ready').map(c => c.id)
    setSelectedContacts(new Set(readyIds))
  }

  function clearSelection() {
    setSelectedContacts(new Set())
  }

  async function callSelected() {
    if (selectedContacts.size === 0) return
    setCalling(true)

    try {
      const response = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactIds: Array.from(selectedContacts)
        })
      })

      const result = await response.json()

      if (result.error) {
        alert('Error: ' + result.error)
      } else {
        alert(result.message)
        setSelectedContacts(new Set())
        loadContacts()
        loadStats()
      }
    } catch (err) {
      alert('Error initiating calls')
    }

    setCalling(false)
  }

  async function resetSelected() {
    if (selectedContacts.size === 0) return

    await supabase
      .from('contacts')
      .update({ status: 'ready' })
      .in('id', Array.from(selectedContacts))

    setSelectedContacts(new Set())
    loadContacts()
    loadStats()
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case 'ready': return 'bg-gray-600/30 text-gray-300'
      case 'calling': return 'bg-blue-600/30 text-blue-400 animate-pulse'
      case 'answered': return 'bg-green-600/30 text-green-400'
      case 'no_answer': return 'bg-yellow-600/30 text-yellow-400'
      case 'failed': return 'bg-red-600/30 text-red-400'
      case 'exhausted': return 'bg-gray-600/20 text-gray-500 line-through'
      default: return 'bg-gray-600/30 text-gray-400'
    }
  }

  const csvHeaders = csvData[0] ? Object.keys(csvData[0]) : []

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Truvo Outbound</h1>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-600/20 border border-gray-600 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Ready</p>
            <p className="text-2xl font-bold">{stats.ready}</p>
          </div>
          <div className="bg-green-600/20 border border-green-600 rounded-lg p-4">
            <p className="text-green-400 text-sm">Answered</p>
            <p className="text-2xl font-bold">{stats.answered}</p>
          </div>
          <div className="bg-yellow-600/20 border border-yellow-600 rounded-lg p-4">
            <p className="text-yellow-400 text-sm">No Answer</p>
            <p className="text-2xl font-bold">{stats.noAnswer}</p>
          </div>
          <div className="bg-gray-600/20 border border-gray-500 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Exhausted</p>
            <p className="text-2xl font-bold">{stats.exhausted}</p>
          </div>
        </div>

        {/* CSV Import */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Import Contacts</h2>

          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="mb-4 block w-full text-sm text-gray-400
              file:mr-4 file:py-2 file:px-4
              file:rounded file:border-0
              file:bg-blue-600 file:text-white
              hover:file:bg-blue-700"
          />

          {csvData.length > 0 && (
            <>
              <p className="text-sm text-gray-400 mb-4">
                Found {csvData.length} rows. Map your fields:
              </p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                {Object.keys(fieldMapping).map(field => (
                  <div key={field}>
                    <label className="block text-sm text-gray-400 mb-1">
                      {field.replace('_', ' ')} {field === 'phone' && '*'}
                    </label>
                    <select
                      value={fieldMapping[field as keyof typeof fieldMapping]}
                      onChange={(e) => setFieldMapping({
                        ...fieldMapping,
                        [field]: e.target.value
                      })}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                    >
                      <option value="">-- Select --</option>
                      {csvHeaders.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <button
                onClick={importContacts}
                disabled={loading || !fieldMapping.phone}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-6 py-2 rounded"
              >
                {loading ? 'Importing...' : `Import ${csvData.length} Contacts`}
              </button>
            </>
          )}
        </div>

        {/* Contacts Table */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Contacts</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllReady}
                className="bg-gray-600 hover:bg-gray-500 px-3 py-1 rounded text-sm"
              >
                Select Ready
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="bg-gray-600 hover:bg-gray-500 px-3 py-1 rounded text-sm"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={resetSelected}
                disabled={selectedContacts.size === 0}
                className="bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 px-3 py-1 rounded text-sm"
              >
                Reset Selected
              </button>
              <button
                type="button"
                onClick={callSelected}
                disabled={calling || selectedContacts.size === 0}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-1 rounded text-sm font-medium"
              >
                {calling ? 'Calling...' : `Call Selected (${selectedContacts.size})`}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-3 w-8"></th>
                  <th className="pb-3">Name</th>
                  <th className="pb-3">Company</th>
                  <th className="pb-3">Phone</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Calls</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(contact => (
                  <tr
                    key={contact.id}
                    className={`border-b border-gray-700/50 ${contact.status === 'exhausted' ? 'opacity-50' : ''}`}
                  >
                    <td className="py-3">
                      <input
                        type="checkbox"
                        checked={selectedContacts.has(contact.id)}
                        onChange={() => toggleContact(contact.id)}
                        disabled={contact.status === 'exhausted' || contact.status === 'answered' || contact.status === 'calling'}
                        className="rounded bg-gray-700 border-gray-600"
                      />
                    </td>
                    <td className="py-3">{contact.first_name} {contact.last_name}</td>
                    <td className="py-3 text-gray-400">{contact.company}</td>
                    <td className="py-3 font-mono text-sm">{contact.phone}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs ${getStatusStyle(contact.status)}`}>
                        {contact.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3">
                      {contact.call_count > 0 && (
                        <span className="text-gray-400 text-xs">
                          #{contact.call_count}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}
