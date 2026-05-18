import { useState, useEffect, useRef, useCallback } from 'react'
import Webcam from 'react-webcam'
import { Camera, AlertTriangle, CheckCircle2, RotateCcw, Volume2, ArrowLeft } from 'lucide-react'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import AddMedication from './components/AddMedication'
import Settings from './components/Settings'
import Vault from './components/Vault'
import FoodScanner from './components/FoodScanner'
import PharmacyRadar from './components/PharmacyRadar'
import Checkout from './components/Checkout'
import OrderHistory from './components/OrderHistory'
import PilotOps from './components/PilotOps'
import { API_BASE_URL } from './config'

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null)
  const [view, setView] = useState(token ? 'dashboard' : 'login')
  const [cart, setCart] = useState([]) // Array of items
  const [activeOrder, setActiveOrder] = useState(() => {
    const saved = localStorage.getItem('medilens_active_order')
    return saved ? JSON.parse(saved) : null
  })
  const [pastOrders, setPastOrders] = useState(() => {
    const saved = localStorage.getItem('medilens_orders')
    return saved ? JSON.parse(saved) : []
  })
  const [radarQuery, setRadarQuery] = useState('')

  // Sync activeOrder to localStorage
  useEffect(() => {
    if (activeOrder) {
      localStorage.setItem('medilens_active_order', JSON.stringify(activeOrder))
    } else {
      localStorage.removeItem('medilens_active_order')
    }
  }, [activeOrder])

  // Simulate delivery process (15 seconds)
  useEffect(() => {
    if (activeOrder) {
      const timer = setTimeout(() => {
        setPastOrders(prev => {
          const updated = [{ ...activeOrder, deliveredAt: new Date().toISOString() }, ...prev]
          localStorage.setItem('medilens_orders', JSON.stringify(updated))
          return updated
        })
        setActiveOrder(null)
      }, 15000)
      return () => clearTimeout(timer)
    }
  }, [activeOrder])
  
  const webcamRef = useRef(null)
  const [appState, setAppState] = useState('idle') // idle | processing | result
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)
  const [feedbackRating, setFeedbackRating] = useState(5)
  const [feedbackSafe, setFeedbackSafe] = useState('unknown')
  const [feedbackComment, setFeedbackComment] = useState('')

  // Watch token changes to handle logout/login dynamically
  if (token && view === 'login') setView('dashboard')
  if (!token && view !== 'login') setView('login')

  // Trigger Haptic Feedback
  const triggerHaptic = (type = 'light') => {
    if ('vibrate' in navigator) {
      if (type === 'heavy') navigator.vibrate([100, 50, 100])
      else navigator.vibrate(50)
    }
  }

  // Text-to-Speech
  const speak = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.9
      window.speechSynthesis.speak(utterance)
    }
  }

  // Capture Image & Send to Backend
  const captureAndAnalyze = useCallback(async () => {
    triggerHaptic('light')
    setAppState('processing')
    setErrorMsg(null)

    // Capture base64 string from webcam
    const imageSrc = webcamRef.current.getScreenshot()
    if (!imageSrc) {
      setErrorMsg("Failed to capture image. Please try again.")
      setAppState('idle')
      return
    }

    // Strip "data:image/jpeg;base64," prefix
    const base64Data = imageSrc.split(',')[1]

    try {
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          image_base64: base64Data
        })
      })

      if (!response.ok) {
        let errMessage = `Server Error: ${response.status}`
        try {
          const errData = await response.json()
          errMessage = errData.detail || errMessage
        } catch(e) {}
        throw new Error(errMessage)
      }

      const data = await response.json()
      setResult(data)
      setAppState('result')

      // Haptics & Speech based on risk
      if (data.is_high_risk || data.interaction_alert || data.is_medication === false) {
        triggerHaptic('heavy')
      } else {
        triggerHaptic('light')
      }
      speak(data.speak_text)

    } catch (err) {
      console.error(err)
      setErrorMsg(err.message || "Analysis failed. Please ensure the backend is running.")
      setAppState('idle')
    }
  }, [webcamRef])

  // Reset App
  const resetApp = () => {
    setAppState('idle')
    setResult(null)
    setErrorMsg(null)
    window.speechSynthesis?.cancel()
    setFeedbackRating(5)
    setFeedbackSafe('unknown')
    setFeedbackComment('')
  }

  const submitClinicalFeedback = async () => {
    if (!token || !result) return
    try {
      await fetch(`${API_BASE_URL}/feedback/clinical`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          case_type: 'analyze',
          model_output_summary: `${result.drug_name || 'unknown'} | ${result.instructions || result.speak_text || ''}`,
          reviewer_role: 'patient',
          rating: feedbackRating,
          is_safe: feedbackSafe,
          comments: feedbackComment
        })
      })
      alert('Feedback submitted. Thank you!')
    } catch (e) {
      alert('Failed to submit feedback')
    }
  }

  return (
    <>
      {view === 'login' && <Login setToken={setToken} />}
      {view === 'dashboard' && <Dashboard token={token} setToken={setToken} activeOrder={activeOrder} onScan={() => setView('scanner')} onAddMedication={() => setView('add')} onSettings={() => setView('settings')} onVault={() => setView('vault')} onFood={() => setView('food')} onRadar={() => setView('radar')} onHistory={() => setView('history')} onPilotOps={() => setView('pilotOps')} />}
      {view === 'add' && <AddMedication token={token} onBack={() => setView('dashboard')} onAdded={() => setView('dashboard')} />}
      {view === 'settings' && <Settings token={token} onBack={() => setView('dashboard')} />}
      {view === 'vault' && <Vault token={token} onBack={() => setView('dashboard')} onFindOnRadar={(drugName) => { setRadarQuery(drugName); setView('radar'); }} />}
      {view === 'food' && <FoodScanner token={token} onBack={() => setView('dashboard')} />}
      {view === 'history' && <OrderHistory pastOrders={pastOrders} activeOrder={activeOrder} onBack={() => setView('dashboard')} />}
      {view === 'radar' && <PharmacyRadar token={token} onBack={() => setView('dashboard')} cart={cart} addToCart={(item) => setCart([...cart, item])} onCheckout={() => setView('checkout')} initialQuery={radarQuery} onClearQuery={() => setRadarQuery('')} />}
      {view === 'checkout' && <Checkout cart={cart} onBack={() => setView('radar')} onSuccess={(order) => { setActiveOrder(order); setCart([]); setView('dashboard'); }} />}
      {view === 'pilotOps' && <PilotOps token={token} onBack={() => setView('dashboard')} />}
      
      {view === 'scanner' && (
        <div className="relative h-screen w-full bg-black overflow-hidden flex flex-col font-sans">
          {/* 1. Full Screen Camera View */}
          <div className="absolute inset-0 z-0">
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: "environment" }}
              className="h-full w-full object-cover"
            />
            {/* Overlay Darken */}
            <div className="absolute inset-0 bg-black/20 pointer-events-none"></div>
          </div>

          {/* 2. Top Header Overlay */}
          <div className="absolute top-0 inset-x-0 z-10 p-6 flex justify-between items-center bg-gradient-to-b from-black/70 to-transparent">
            <div className="flex items-center gap-4">
              <button onClick={() => { setView('dashboard'); resetApp(); }} className="bg-black/50 p-2 rounded-full text-white backdrop-blur-md">
                <ArrowLeft size={24} />
              </button>
              <h1 className="text-3xl font-bold text-blue-400 tracking-tight">MediLens</h1>
            </div>
            {errorMsg && (
              <div className="bg-red-500/90 text-white px-4 py-2 rounded-full text-sm font-medium backdrop-blur-md shadow-lg border border-red-400">
                {errorMsg}
              </div>
            )}
          </div>

      {/* 3. Scanning Animation (Only during processing) */}
      {appState === 'processing' && (
        <div className="absolute inset-0 z-20 pointer-events-none flex justify-center items-center">
          <div className="w-full max-w-sm h-64 border-4 border-blue-500/50 rounded-3xl relative overflow-hidden">
            <div className="w-full h-1 bg-blue-400 shadow-[0_0_15px_3px_rgba(59,130,246,0.8)] animate-scan-line"></div>
          </div>
          <div className="absolute bottom-32 text-blue-400 font-bold text-xl animate-pulse tracking-wider">
            ANALYZING LABEL...
          </div>
        </div>
      )}

      {/* 4. Bottom Controls / Shutter Button (Idle State) */}
      {appState === 'idle' && (
        <div className="absolute bottom-0 inset-x-0 z-20 p-10 flex justify-center pb-16 bg-gradient-to-t from-black/80 to-transparent">
          <button
            onClick={captureAndAnalyze}
            className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.4)] active:scale-95 transition-transform"
          >
            <div className="w-16 h-16 border-2 border-black rounded-full flex items-center justify-center">
              <Camera size={32} color="black" />
            </div>
          </button>
        </div>
      )}

      {/* 5. Glassmorphism Result Bottom Sheet */}
      {appState === 'result' && result && (
        <div className="absolute bottom-0 inset-x-0 z-30 p-4 transform transition-all duration-500 ease-out translate-y-0">
          <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-3xl p-6 shadow-2xl">

            {/* Header / Title */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white leading-tight">{result.drug_name}</h2>
                <p className="text-gray-300 font-medium">{result.dose_plain}</p>
              </div>
              <button onClick={() => speak(result.speak_text)} className="p-3 bg-blue-500/20 rounded-full text-blue-400 active:bg-blue-500/40">
                <Volume2 size={24} />
              </button>
            </div>

            {/* Main Instructions or Non-Medication Fallback */}
            <div className="bg-gray-800/60 rounded-2xl p-4 mb-4">
              {!result.is_medication ? (
                <div className="flex items-center gap-2 text-yellow-400 font-bold mb-2">
                  <AlertTriangle size={20} />
                  <span>Not a Medication</span>
                </div>
              ) : null}
              <p className="text-lg text-white leading-relaxed">
                {result.is_medication ? result.instructions : result.speak_text}
              </p>
            </div>

            {/* Warnings & Risk Detection Layer */}
            {result.warnings?.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-2 text-red-400 font-bold">
                  <AlertTriangle size={20} />
                  <span>Important Safety Warnings</span>
                </div>
                <ul className="space-y-2">
                  {result.warnings.map((w, i) => (
                    <li key={i} className="text-red-200 text-md leading-snug">• {w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Interaction Alert */}
            {result.interaction_alert && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 mb-6">
                <div className="flex items-center gap-2 mb-2 text-orange-400 font-bold">
                  <AlertTriangle size={20} />
                  <span>Interaction Detected</span>
                </div>
                <p className="text-orange-200 text-md">{result.interaction_alert}</p>
              </div>
            )}

            {/* Quick Clinical Feedback */}
            <div className="bg-gray-800/60 rounded-2xl p-4 mb-4">
              <p className="text-white font-semibold mb-2">Rate this AI result</p>
              <div className="flex gap-2 mb-3">
                <input type="number" min={1} max={5} value={feedbackRating} onChange={(e)=>setFeedbackRating(parseInt(e.target.value||'5'))} className="w-20 rounded px-2 py-1 bg-gray-700 text-white" />
                <select value={feedbackSafe} onChange={(e)=>setFeedbackSafe(e.target.value)} className="rounded px-2 py-1 bg-gray-700 text-white">
                  <option value="unknown">Safety: Unknown</option>
                  <option value="yes">Safety: Safe</option>
                  <option value="no">Safety: Unsafe</option>
                </select>
              </div>
              <textarea value={feedbackComment} onChange={(e)=>setFeedbackComment(e.target.value)} placeholder="Optional comments" className="w-full rounded p-2 bg-gray-700 text-white mb-2" rows={2} />
              <button onClick={submitClinicalFeedback} className="w-full bg-indigo-600 text-white py-2 rounded-xl font-bold">Submit Feedback</button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => { triggerHaptic('light'); resetApp(); }}
                className="flex-1 bg-gray-700/50 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:bg-gray-700"
              >
                <RotateCcw size={20} /> Scan Another
              </button>
              <button
                onClick={() => {
                  triggerHaptic('heavy');
                  speak("Dose confirmed. Great job!");
                  setTimeout(() => resetApp(), 3000);
                }}
                className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:bg-blue-700 shadow-lg shadow-blue-600/30"
              >
                <CheckCircle2 size={20} /> Confirm Dose
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
    )}
    </>
  )
}

export default App
