import { useState } from 'react'
import { ArrowLeft, Camera, UploadCloud, Utensils, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react'

export default function FoodScanner({ token, onBack }) {
  const [isScanning, setIsScanning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    setIsScanning(true)
    setResult(null)
    setError(null)
    
    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch('http://127.0.0.1:8000/intelligence/food', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      })
      if (!res.ok) throw new Error("Failed to analyze food")
      const data = await res.json()
      setResult(data)
    } catch (error) {
      console.error(error)
      setError("AI was unable to process the food image.")
    } finally {
      setIsScanning(false)
      e.target.value = null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-6 pb-32">
      <div className="flex items-center gap-4 mb-8 mt-4">
        <button onClick={onBack} className="p-3 bg-white border border-gray-200 rounded-full text-gray-600 hover:bg-gray-100 shadow-sm transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-3xl font-bold">Food as Medicine</h1>
      </div>

      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-3xl p-6 text-white mb-8 shadow-lg">
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2"><Utensils size={24}/> Nutritional Intelligence</h2>
        <p className="text-emerald-50 text-sm leading-relaxed font-medium">
          Snap a photo of your meal. Our AI will instantly check for conflicts with your allergies, conditions, and active medications!
        </p>
      </div>

      {!result && !isScanning && (
        <div className="relative mb-8">
          <input 
            type="file" 
            onChange={handleFileUpload}
            accept="image/jpeg, image/png"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="border-2 border-dashed border-gray-300 bg-white hover:bg-gray-50 rounded-3xl p-10 flex flex-col items-center justify-center text-center transition-colors shadow-sm">
            <div className="p-5 rounded-full mb-4 bg-emerald-100 text-emerald-600">
              <Camera size={40} />
            </div>
            <h3 className="font-bold text-xl text-gray-800">Scan Meal</h3>
            <p className="text-gray-500 mt-2">Take a photo or upload an image to check for safety.</p>
          </div>
        </div>
      )}

      {isScanning && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
          <h3 className="text-xl font-bold text-emerald-800 animate-pulse">Analyzing Meal Safety...</h3>
          <p className="text-emerald-600 text-sm mt-2">Cross-referencing your Health Memory...</p>
        </div>
      )}

      {error && (
        <div className="p-6 bg-red-50 border border-red-200 rounded-3xl text-center mb-8">
          <AlertTriangle size={32} className="text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-red-800 mb-1">Scan Failed</h3>
          <p className="text-red-600">{error}</p>
          <button onClick={() => setError(null)} className="mt-4 px-6 py-2 bg-red-100 text-red-700 rounded-full font-bold">Try Again</button>
        </div>
      )}

      {result && (
        <div className={`p-6 rounded-3xl shadow-sm border mb-8 ${result.is_safe ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-4 rounded-full ${result.is_safe ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
              {result.is_safe ? <CheckCircle size={32} /> : <ShieldAlert size={32} />}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 capitalize">{result.food_name}</h2>
              <p className={`font-bold uppercase tracking-wide text-sm ${result.is_safe ? 'text-emerald-700' : 'text-red-700'}`}>
                {result.is_safe ? "Safe to Eat" : "Warning: Risk Detected"}
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-4">
            <p className="text-gray-800 leading-relaxed font-medium">
              {result.safety_message}
            </p>
          </div>

          {result.interactions && result.interactions.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-bold text-red-800 flex items-center gap-2 text-sm uppercase">
                <AlertTriangle size={16}/> Specific Conflicts
              </h4>
              <ul className="list-disc pl-5 text-gray-700 space-y-1">
                {result.interactions.map((i, idx) => (
                  <li key={idx}>{i}</li>
                ))}
              </ul>
            </div>
          )}

          <button onClick={() => setResult(null)} className={`mt-6 w-full py-4 rounded-2xl font-bold text-lg text-white transition-colors ${result.is_safe ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
            Scan Another Meal
          </button>
        </div>
      )}
    </div>
  )
}
