import { useEffect, useState } from 'react'
import { ArrowLeft, BarChart3, Download, RefreshCcw, ShieldAlert, Users } from 'lucide-react'
import { API_BASE_URL } from '../config'

export default function PilotOps({ token, onBack }) {
  const [days, setDays] = useState(7)
  const [report, setReport] = useState(null)
  const [summary, setSummary] = useState(null)
  const [cohort, setCohort] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const headers = { Authorization: `Bearer ${token}` }

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch(`${API_BASE_URL}/pilot/report?days=${days}`, { headers }),
        fetch(`${API_BASE_URL}/feedback/clinical/summary?days=${days}`, { headers }),
        fetch(`${API_BASE_URL}/pilot/metrics/cohort?days=${days}`, { headers }),
      ])
      if (!r1.ok) throw new Error('Failed to load pilot report')
      const d1 = await r1.json()
      setReport(d1)

      if (r2.ok) setSummary(await r2.json())
      else setSummary(null)

      if (r3.ok) setCohort(await r3.json())
      else setCohort(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [days])

  const downloadExport = async () => {
    const res = await fetch(`${API_BASE_URL}/pilot/export?days=${days}`, { headers })
    if (!res.ok) return alert('Export failed')
    const data = await res.json()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pilot_export_${days}d.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadMarkdown = async () => {
    const res = await fetch(`${API_BASE_URL}/pilot/report/markdown?days=${days}`, { headers })
    if (!res.ok) return alert('Markdown report failed')
    const data = await res.json()
    const blob = new Blob([data.markdown || ''], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pilot_report_${days}d.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 pb-32 text-gray-900">
      <div className="flex items-center gap-3 mb-6 mt-2">
        <button onClick={onBack} className="p-3 bg-white border border-gray-200 rounded-full"><ArrowLeft size={18}/></button>
        <h1 className="text-2xl font-bold">Pilot Ops</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
        <label className="text-sm font-semibold">Window (days)</label>
        <input type="number" min={1} max={90} value={days} onChange={e => setDays(parseInt(e.target.value || '7'))} className="w-20 border rounded px-2 py-1" />
        <button onClick={load} className="ml-auto flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg"><RefreshCcw size={14}/>Refresh</button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl mb-4">{error}</div>}
      {loading && <div className="text-gray-500 mb-4">Loading...</div>}

      {report && (
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white border rounded-2xl p-4">
            <h2 className="font-bold mb-2 flex items-center gap-2"><BarChart3 size={16}/>Reliability</h2>
            <p>Success Rate: <b>{report.reliability?.analyze_success_rate}</b></p>
            <p>p95 Latency: <b>{report.reliability?.analyze_p95_latency_ms} ms</b></p>
            <p>Fails: <b>{report.reliability?.analyze_fail}</b></p>
          </div>
          <div className="bg-white border rounded-2xl p-4">
            <h2 className="font-bold mb-2 flex items-center gap-2"><ShieldAlert size={16}/>Outcomes</h2>
            <p>Adherence Rate: <b>{report.outcomes?.adherence?.adherence_rate}</b></p>
            <p>Avg Symptom Severity: <b>{report.outcomes?.symptoms?.avg_severity ?? 'N/A'}</b></p>
            <p>Feedback Avg Rating: <b>{report.outcomes?.clinical_feedback?.avg_rating ?? 'N/A'}</b></p>
          </div>
        </div>
      )}

      {summary && (
        <div className="bg-white border rounded-2xl p-4 mb-6">
          <h2 className="font-bold mb-2">Clinical Feedback Summary</h2>
          <p>Entries: <b>{summary.entries}</b> | Unsafe: <b>{summary.unsafe_flags}</b> | Safe: <b>{summary.safe_flags}</b></p>
        </div>
      )}

      {cohort && (
        <div className="bg-white border rounded-2xl p-4 mb-6">
          <h2 className="font-bold mb-2 flex items-center gap-2"><Users size={16}/>Cohort Metrics</h2>
          <p>Adherence Rate: <b>{cohort.adherence?.adherence_rate}</b></p>
          <p>Avg Symptom Severity: <b>{cohort.symptoms?.avg_severity ?? 'N/A'}</b></p>
          <p>Feedback Avg Rating: <b>{cohort.clinical_feedback?.avg_rating ?? 'N/A'}</b></p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button onClick={downloadExport} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Download size={16}/>Export Pilot JSON</button>
        <button onClick={downloadMarkdown} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Download size={16}/>Download MD Report</button>
      </div>
    </div>
  )
}
