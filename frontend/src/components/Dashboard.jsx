import { useState, useEffect } from 'react'
import { Pill, Plus, LogOut, Bell, BellRing, Clock, CheckCircle2, Activity, BrainCircuit, Settings as SettingsIcon, FolderOpen, Apple, MapPin, Truck, ClipboardList } from 'lucide-react'

export default function Dashboard({ token, setToken, activeOrder, onScan, onAddMedication, onSettings, onVault, onFood, onRadar, onHistory }) {
  const [meds, setMeds] = useState([])
  const [user, setUser] = useState(null)
  const [insight, setInsight] = useState("Analyzing your behavioral data...")
  const [symptom, setSymptom] = useState({ description: '', severity: 5 })
  const [notificationsEnabled, setNotificationsEnabled] = useState(Notification.permission === 'granted')

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
  }

  const loadData = () => {
    fetch('http://127.0.0.1:8000/users/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(res => {
      if (res.status === 401) { logout(); throw new Error('Unauthorized'); }
      return res.json();
    }).then(setUser).catch(console.error)

    fetch('http://127.0.0.1:8000/medications', {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(res => res.json()).then(setMeds).catch(console.error)

    fetchInsights();
  }

  const fetchInsights = () => {
    fetch('http://127.0.0.1:8000/intelligence/insights', {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(res => res.json()).then(data => setInsight(data.insight)).catch(() => setInsight("Failed to load insights."));
  }

  useEffect(() => {
    loadData()
  }, [token])

  // Notification Engine
  useEffect(() => {
    if (!notificationsEnabled) return;
    
    const checkReminders = () => {
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${currentHours}:${currentMinutes}`;
      
      meds.forEach(med => {
        if (med.reminder_time === currentTime && now.getSeconds() < 10) {
           new Notification(`MediLens: ${med.drug_name}`, {
             body: `Time to take your ${med.dosage} (${med.frequency}).`,
             icon: "/vite.svg"
           });
        }
      });
    };

    const intervalId = setInterval(checkReminders, 10000); // check every 10 seconds
    return () => clearInterval(intervalId);
  }, [meds, notificationsEnabled]);

  const toggleNotifications = async () => {
    if (Notification.permission === 'default' || Notification.permission === 'denied') {
      const permission = await Notification.requestPermission()
      setNotificationsEnabled(permission === 'granted')
      if (permission === 'granted') {
        new Notification("MediLens Reminders Enabled", {
          body: "You will now receive adherence reminders at your scheduled times."
        })
      }
    } else if (Notification.permission === 'granted') {
      alert("Notifications are already enabled.");
    }
  }

  const handleLogAdherence = async (med_id) => {
    try {
      await fetch('http://127.0.0.1:8000/log/adherence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ medication_id: med_id, status: 'taken' })
      });
      alert("Adherence logged successfully!");
      fetchInsights(); // Refresh insights after logging
    } catch (err) {
      console.error(err);
    }
  }

  const handleLogSymptom = async (e) => {
    e.preventDefault();
    if (!symptom.description) return;

    try {
      await fetch('http://127.0.0.1:8000/log/symptom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ symptom_description: symptom.description, severity_score: parseInt(symptom.severity) })
      });
      alert("Symptom logged successfully!");
      setSymptom({ description: '', severity: 5 });
      fetchInsights(); // Refresh insights after logging
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-6 pb-40">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 mt-4 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Hello, {user?.full_name?.split(' ')[0] || 'User'}</h1>
          <p className="text-gray-500">Your Health Overview</p>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <button onClick={onHistory} className="p-3 bg-white border border-gray-200 rounded-full text-blue-600 hover:bg-blue-50 shadow-sm transition-colors" title="Order History">
            <ClipboardList size={20} />
          </button>
          <button onClick={onRadar} className="p-3 bg-white border border-violet-200 rounded-full text-violet-600 hover:bg-violet-50 shadow-sm transition-colors" title="Pharmacy Radar">
            <MapPin size={20} />
          </button>
          <button onClick={onFood} className="p-3 bg-white border border-emerald-200 rounded-full text-emerald-600 hover:bg-emerald-50 shadow-sm transition-colors" title="Food Scanner">
            <Apple size={20} />
          </button>
          <button onClick={onVault} className="p-3 bg-white border border-gray-200 rounded-full text-indigo-600 hover:bg-indigo-50 shadow-sm transition-colors" title="Health Vault">
            <FolderOpen size={20} />
          </button>
          <button onClick={onSettings} className="p-3 bg-white border border-gray-200 rounded-full text-gray-600 hover:bg-gray-100 shadow-sm transition-colors" title="Settings">
            <SettingsIcon size={20} />
          </button>
          <button onClick={toggleNotifications} className={`p-3 border rounded-full transition-colors shadow-sm ${notificationsEnabled ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'}`} title="Notifications">
            {notificationsEnabled ? <BellRing size={20} /> : <Bell size={20} />}
          </button>
          <button onClick={logout} className="p-3 bg-white border border-gray-200 rounded-full text-gray-600 hover:bg-gray-100 shadow-sm">
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* AI Longitudinal Insights */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl p-6 text-white mb-8 shadow-lg">
        <div className="flex items-center gap-3 mb-3">
          <BrainCircuit size={24} className="text-purple-200" />
          <h2 className="text-xl font-bold">Health Intelligence</h2>
        </div>
        <p className="text-indigo-50 text-sm leading-relaxed font-medium">
          {insight}
        </p>
      </div>

      {/* Active Order Tracking (If Any) */}
      {activeOrder && (
        <div className="bg-white border-2 border-violet-200 rounded-3xl p-6 mb-8 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800 flex items-center gap-2 text-lg"><Truck size={24} className="text-violet-600"/> Delivery on the way!</h2>
            <span className="text-xs font-bold bg-violet-100 text-violet-700 px-3 py-1 rounded-full animate-pulse">Arriving Soon</span>
          </div>
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
            <p className="font-bold text-gray-900 text-lg">{activeOrder.drugName}</p>
            <p className="text-sm text-gray-500 mt-1">From {activeOrder.pharmacy}</p>
            
            {/* Tracking Progress Bar */}
            <div className="mt-6">
              <div className="flex justify-between text-xs font-bold text-gray-400 mb-2">
                <span className="text-violet-600">Preparing</span>
                <span className="text-violet-600">On the way</span>
                <span>Delivered</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 w-1/2 rounded-full relative">
                  <div className="absolute top-0 right-0 bottom-0 left-0 bg-white/20 animate-[shimmer_1s_infinite]"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Medication Timeline */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
          <Clock size={20} className="text-blue-500" /> Today's Schedule
        </h2>
        <div className="space-y-4">
          {meds.length === 0 ? (
            <div className="text-center p-8 text-gray-500 border border-dashed border-gray-300 rounded-3xl bg-white shadow-sm">
              <Pill size={40} className="mx-auto text-gray-300 mb-3" />
              <p>No medications scheduled.</p>
              <p className="text-sm mt-1">Tap + to add your prescriptions.</p>
            </div>
          ) : (
            meds.map(med => (
              <div key={med.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-50 p-4 rounded-full text-blue-600 border border-blue-100">
                      <Pill size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg leading-tight text-gray-900">{med.drug_name}</h3>
                      <p className="text-gray-500 text-sm font-medium">{med.dosage} • {med.frequency}</p>
                    </div>
                  </div>
                  {med.reminder_time && (
                    <div className="flex flex-col items-end text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                      <span className="flex items-center gap-1 text-xs font-bold uppercase"><Clock size={12}/> Reminder</span>
                      <span className="text-lg font-bold tracking-tight">{med.reminder_time}</span>
                    </div>
                  )}
                </div>
                
                {/* Adherence Button */}
                <button onClick={() => handleLogAdherence(med.id)} className="w-full bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 py-2.5 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors">
                  <CheckCircle2 size={18} /> Mark as Taken
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Symptom Logger */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 mb-8">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
          <Activity size={20} className="text-red-400" /> Log Symptom
        </h2>
        <form onSubmit={handleLogSymptom} className="space-y-4">
          <div>
            <label className="block text-gray-600 text-sm mb-1 font-medium">How are you feeling?</label>
            <input type="text" placeholder="e.g. Dizziness, Headache" value={symptom.description} onChange={e => setSymptom({...symptom, description: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl focus:border-blue-500 focus:ring-1 outline-none" required/>
          </div>
          <div>
            <label className="block text-gray-600 text-sm mb-1 font-medium flex justify-between">
              <span>Severity</span>
              <span>{symptom.severity}/10</span>
            </label>
            <input type="range" min="1" max="10" value={symptom.severity} onChange={e => setSymptom({...symptom, severity: e.target.value})} className="w-full accent-red-400" />
          </div>
          <button type="submit" className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-colors">
            Save Symptom
          </button>
        </form>
      </div>

      {/* Floating Action Button for Add Medication */}
      <button 
        onClick={onAddMedication} 
        className="fixed bottom-24 right-6 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-[0_8px_20px_rgba(37,99,235,0.4)] transition-transform active:scale-95 z-40"
      >
        <Plus size={32} />
      </button>

      {/* Scan Identify Action */}
      <div className="fixed bottom-6 left-0 right-0 flex justify-center z-40 px-6">
        <button onClick={onScan} className="bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 font-bold py-4 px-8 rounded-full shadow-lg flex items-center gap-2 transition-transform active:scale-95 w-full max-w-sm justify-center">
          Identify Medication
        </button>
      </div>
    </div>
  )
}
