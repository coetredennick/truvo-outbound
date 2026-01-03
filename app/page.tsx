'use client'

import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import { supabase, Campaign, Contact } from '@/lib/supabase'

export default function Home() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string>('')
  const [contacts, setContacts] = useState<Contact[]>([])
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
  const [stats, setStats] = useState({ pending: 0, completed: 0, failed: 0 })

  // Load campaigns on mount
  useEffect(() => {
    loadCampaigns()
  }, [])

  // Load contacts when campaign changes
  useEffect(() => {
    if (selectedCampaign) {
      loadContacts()
      loadStats()
    }
  }, [selectedCampaign])

  async function loadCampaigns() {
    const { data } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false })
    if (data) setCampaigns(data)
  }

  async function loadContacts() {
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('campaign_id', selectedCampaign)
      .order('created_at', { ascending: false })
      .limit(100)
    if (data) setContacts(data)
  }

  async function loadStats() {
    const { data } = await supabase
      .from('contacts')
      .select('status')
      .eq('campaign_id', selectedCampaign)

    if (data) {
      const pending = data.filter(c => c.status === 'pending' || c.status === 'failed').length
      const completed = data.filter(c => c.status === 'completed').length
      const failed = data.filter(c => c.status === 'dnc').length
      setStats({ pending, completed, failed })
    }
  }

  async function createCampaign() {
    const name = prompt('Campaign name:')
    if (!name) return

    const { data, error } = await supabase.from('campaigns').insert({
      name,
      assistant_id: process.env.NEXT_PUBLIC_DEFAULT_ASSISTANT_ID || '133504a9-be77-4b3a-8923-2e9dad3c029a',
      phone_number_id: process.env.NEXT_PUBLIC_DEFAULT_PHONE_NUMBER_ID || 'ec4706e8-b8aa-45af-ac49-3632d73fc451',
      status: 'paused'
    }).select().single()

    if (data) {
      setCampaigns([data, ...campaigns])
      setSelectedCampaign(data.id)
    }
  }

  async function toggleCampaign(campaign: Campaign) {
    const newStatus = campaign.status === 'active' ? 'paused' : 'active'
    await supabase.from('campaigns').update({ status: newStatus }).eq('id', campaign.id)
    loadCampaigns()
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      complete: (results) => {
        setCsvData(results.data)
        // Auto-detect field mappings
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
    if (!selectedCampaign || csvData.length === 0) return
    setLoading(true)

    const contactsToInsert = csvData
      .filter(row => row[fieldMapping.phone]) // Must have phone
      .map(row => ({
        campaign_id: selectedCampaign,
        phone: row[fieldMapping.phone],
        first_name: row[fieldMapping.first_name] || '',
        last_name: row[fieldMapping.last_name] || '',
        company: row[fieldMapping.company] || '',
        location: row[fieldMapping.location] || '',
        industry: row[fieldMapping.industry] || '',
        status: 'pending'
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

  const csvHeaders = csvData[0] ? Object.keys(csvData[0]) : []

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Truvo Outbound</h1>

        {/* Campaign Selection */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Campaigns</h2>
            <button
              onClick={createCampaign}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
            >
              + New Campaign
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {campaigns.map(c => (
              <div
                key={c.id}
                onClick={() => setSelectedCampaign(c.id)}
                className={`p-4 rounded-lg cursor-pointer border-2 ${selectedCampaign === c.id
                    ? 'border-blue-500 bg-gray-700'
                    : 'border-gray-600 bg-gray-750 hover:border-gray-500'
                  }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{c.name}</h3>
                    <p className="text-sm text-gray-400">
                      {c.call_window_start} - {c.call_window_end}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleCampaign(c) }}
                    className={`px-3 py-1 rounded text-sm ${c.status === 'active'
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-gray-600 hover:bg-gray-500'
                      }`}
                  >
                    {c.status === 'active' ? 'Active' : 'Paused'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedCampaign && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-yellow-600/20 border border-yellow-600 rounded-lg p-4">
                <p className="text-yellow-400 text-sm">Pending</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
              <div className="bg-green-600/20 border border-green-600 rounded-lg p-4">
                <p className="text-green-400 text-sm">Completed</p>
                <p className="text-2xl font-bold">{stats.completed}</p>
              </div>
              <div className="bg-red-600/20 border border-red-600 rounded-lg p-4">
                <p className="text-red-400 text-sm">DNC/Failed</p>
                <p className="text-2xl font-bold">{stats.failed}</p>
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
                          {field.replace('_', ' ')}
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
              <h2 className="text-xl font-semibold mb-4">Contacts</h2>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-700">
                      <th className="pb-3">Name</th>
                      <th className="pb-3">Company</th>
                      <th className="pb-3">Phone</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Attempts</th>
                      <th className="pb-3">Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map(contact => (
                      <tr key={contact.id} className="border-b border-gray-700/50">
                        <td className="py-3">{contact.first_name} {contact.last_name}</td>
                        <td className="py-3 text-gray-400">{contact.company}</td>
                        <td className="py-3 font-mono text-sm">{contact.phone}</td>
                        <td className="py-3">
                          <span className={`px-2 py-1 rounded text-xs ${contact.status === 'completed' ? 'bg-green-600/30 text-green-400' :
                              contact.status === 'pending' ? 'bg-yellow-600/30 text-yellow-400' :
                                contact.status === 'calling' ? 'bg-blue-600/30 text-blue-400' :
                                  'bg-red-600/30 text-red-400'
                            }`}>
                            {contact.status}
                          </span>
                        </td>
                        <td className="py-3">{contact.attempts}</td>
                        <td className="py-3 text-gray-400">{contact.outcome || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
