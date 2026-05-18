import { useState, useEffect } from 'react'
import { ArrowLeft, User, ShieldPlus, AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { API_BASE_URL } from '../config'

export default function Settings({ token, onBack }) {
  const [memory, setMemory] = useState([])
  const [caregivers, setCaregivers] = useState([])
  
  const [newMemory, setNewMemory] = useState({ memory_type: 'allergy', description: '' })
  const [newCaregiver, setNewCaregiver] = useState('')
  
  const [address, setAddress] = useState(localStorage.getItem('medilens_delivery_address') || '')
  const [isSavingAddress, setIsSavingAddress] = useState(false)

  const handleSaveAddress = (e) => {
    e.preventDefault()
    setIsSavingAddress(true)
    setTimeout(() => {
      localStorage.setItem('medilens_delivery_address', address)
      setIsSavingAddress(false)
      alert("Delivery address saved!")
    }, 500)
  }

  const loadData = async () => {
    try {
      const memRes = await fetch(`${API_BASE_URL}/health-memory`, { headers: { 'Authorization': `Bearer ${token}` } })
      if (memRes.ok) setMemory(await memRes.json())

      const careRes = await fetch(`${API_BASE_URL}/caregivers`, { headers: { 'Authorization': `Bearer ${token}` } })
      if (careRes.ok) setCaregivers(await careRes.json())
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleAddMemory = async (e) => {
    e.preventDefault()
    if (!newMemory.description) return
    try {
      await fetch(`${API_BASE_URL}/health-memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newMemory)
      })
      setNewMemory({ ...newMemory, description: '' })
      loadData()
    } catch (e) {
      console.error(e)
    }
  }

  const handleAddCaregiver = async (e) => {
    e.preventDefault()
    if (!newCaregiver) return
    try {
      await fetch(`${API_BASE_URL}/caregivers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ caregiver_email: newCaregiver, permissions: 'read_adherence,read_alerts' })
      })
      setNewCaregiver('')
      loadData()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-6 pb-32">
      <div className="flex items-center gap-4 mb-8 mt-4">
        <button onClick={onBack} className="p-3 bg-white border border-gray-200 rounded-full text-gray-600 hover:bg-gray-100 shadow-sm transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-3xl font-bold">User Hub</h1>
      </div>

      <div className="space-y-8">
        {/* Personal Profile Section */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
              <User size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Delivery Profile</h2>
              <p className="text-sm text-gray-500">Your physical address for Quick Commerce deliveries.</p>
            </div>
          </div>
          <form onSubmit={handleSaveAddress} className="flex gap-2">
            <input 
              type="text" 
              placeholder="e.g. 123 Main St, Apt 4B" 
              value={address} 
              onChange={e => setAddress(e.target.value)} 
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:ring-1 focus:ring-violet-500" 
              required
            />
            <button type="submit" className="bg-violet-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-violet-700 transition-colors">
              {isSavingAddress ? 'Saving...' : 'Save'}
            </button>
          </form>
        </section>

        {/* Health Memory Section */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-red-50 text-red-600 rounded-xl">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Health Memory</h2>
              <p className="text-sm text-gray-500">Allergies and chronic conditions used for AI risk detection.</p>
            </div>
          </div>

          <form onSubmit={handleAddMemory} className="flex gap-2 mb-6">
            <select value={newMemory.memory_type} onChange={e => setNewMemory({...newMemory, memory_type: e.target.value})} className="bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:ring-1 focus:ring-blue-500">
              <option value="allergy">Allergy</option>
              <option value="condition">Condition</option>
            </select>
            <input type="text" placeholder="e.g. Penicillin, Diabetes" value={newMemory.description} onChange={e => setNewMemory({...newMemory, description: e.target.value})} className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:ring-1 focus:ring-blue-500" required/>
            <button type="submit" className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-colors">
              <Plus size={24} />
            </button>
          </form>

          <div className="space-y-3">
            {memory.map(m => (
              <div key={m.id} className="flex justify-between items-center p-4 bg-gray-50 border border-gray-100 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${m.memory_type === 'allergy' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                    {m.memory_type}
                  </span>
                  <span className="font-medium text-gray-800">{m.description}</span>
                </div>
              </div>
            ))}
            {memory.length === 0 && <p className="text-gray-500 text-sm italic">No health memory records yet.</p>}
          </div>
        </section>

        {/* Caregiver RBAC Section */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <ShieldPlus size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Caregiver Access</h2>
              <p className="text-sm text-gray-500">Link a caregiver to share adherence and alerts securely.</p>
            </div>
          </div>

          <form onSubmit={handleAddCaregiver} className="flex gap-2 mb-6">
            <input type="email" placeholder="caregiver@email.com" value={newCaregiver} onChange={e => setNewCaregiver(e.target.value)} className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:ring-1 focus:ring-blue-500" required/>
            <button type="submit" className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-colors">
              <Plus size={24} />
            </button>
          </form>

          <div className="space-y-3">
            {caregivers.map(c => (
              <div key={c.id} className="flex flex-col p-4 bg-gray-50 border border-gray-100 rounded-xl gap-2">
                <div className="flex items-center gap-3">
                  <User size={18} className="text-gray-400" />
                  <span className="font-bold text-gray-800">{c.caregiver_email}</span>
                </div>
                <div className="text-xs text-gray-500 bg-white border border-gray-200 p-2 rounded-lg mt-1">
                  <span className="font-bold text-gray-700">Permissions: </span> {c.permissions.split(',').join(', ')}
                </div>
              </div>
            ))}
            {caregivers.length === 0 && <p className="text-gray-500 text-sm italic">No caregivers linked yet.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
