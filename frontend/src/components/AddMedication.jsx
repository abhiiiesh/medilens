import { useState, useRef } from 'react'
import { Camera, ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react'
import { API_BASE_URL } from '../config'

// Hardcoded for MVP Autocomplete (Matches backend rag_database.py)
const DRUG_DB = ["Ibuprofen", "Lisinopril", "Warfarin", "Metformin", "Omeprazole", "Monocef", "Zerodol-SP", "Monticop"];

export default function AddMedication({ token, onBack, onAdded }) {
  const [pendingMeds, setPendingMeds] = useState([{ drug_name: '', dosage: '', frequency: '', reminder_time: '' }])
  const [isParsing, setIsParsing] = useState(false)
  const [isReviewMode, setIsReviewMode] = useState(false)
  const fileInputRef = useRef(null)

  const handleDrugNameChange = (index, val) => {
    const newMeds = [...pendingMeds];
    newMeds[index].drug_name = val;
    setPendingMeds(newMeds);
  }

  const updateMed = (index, field, value) => {
    const newMeds = [...pendingMeds];
    newMeds[index][field] = value;
    setPendingMeds(newMeds);
  }

  const removeMed = (index) => {
    if (pendingMeds.length === 1) return;
    const newMeds = [...pendingMeds];
    newMeds.splice(index, 1);
    setPendingMeds(newMeds);
  }

  const addEmptyMed = () => {
    setPendingMeds([...pendingMeds, { drug_name: '', dosage: '', frequency: '', reminder_time: '' }]);
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/parse-prescription`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData // No Content-Type header needed for FormData, browser sets it with boundary
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.medications && data.medications.length > 0) {
           const parsed = data.medications.map(m => ({
               drug_name: m.drug_name || '',
               dosage: m.dosage || '',
               frequency: m.frequency || '',
               reminder_time: ''
           }));
           setPendingMeds(parsed);
           setIsReviewMode(true);
        } else {
           alert("No medications found in the document.");
        }
      } else {
        alert("Failed to parse document. Ensure the file is clear and legible.");
      }
    } catch (err) {
      console.error(err);
      alert("Error connecting to server.");
    } finally {
      setIsParsing(false);
      e.target.value = null; // Reset file input
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Filter out completely empty rows just in case
    const validMeds = pendingMeds.filter(m => m.drug_name.trim() !== '');
    if (validMeds.length === 0) return;

    try {
      // POST each medication sequentially
      for (const med of validMeds) {
          await fetch(`${API_BASE_URL}/medications`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(med)
          });
      }
      onAdded(); // Will navigate back to dashboard automatically
    } catch (error) {
      console.error('Failed to add medications', error);
      alert("An error occurred while saving.");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-6 pb-32">
      <div className="flex items-center gap-4 mb-8 mt-4">
        <button onClick={onBack} className="p-3 bg-white border border-gray-200 rounded-full text-gray-600 hover:bg-gray-100 shadow-sm transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-3xl font-bold">Add Medication</h1>
      </div>

      <div className="bg-white border border-blue-100 p-6 rounded-3xl mb-8 shadow-lg shadow-blue-900/5">
        <div className="mb-6 flex justify-between items-center bg-blue-50 p-4 rounded-xl border border-blue-100">
          <div>
            <h3 className="font-semibold text-blue-800">Have a prescription?</h3>
            <p className="text-sm text-blue-600">Upload a photo to auto-fill.</p>
          </div>
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
          <button 
            onClick={() => fileInputRef.current.click()}
            disabled={isParsing}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50"
          >
            {isParsing ? <Loader2 className="animate-spin" size={18} /> : <Camera size={18} />}
            {isParsing ? 'Reading...' : 'Upload'}
          </button>
        </div>

        {isReviewMode && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl mb-6 flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-bold">Review Extracted Medications</p>
              <p className="text-sm">Please verify the details below and set your reminder times before saving.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {pendingMeds.map((med, index) => (
              <div key={index} className="p-4 border border-gray-200 rounded-2xl bg-gray-50 relative">
                {pendingMeds.length > 1 && (
                  <button type="button" onClick={() => removeMed(index)} className="absolute -top-3 -right-3 bg-red-100 text-red-600 p-2 rounded-full hover:bg-red-200 shadow-sm border border-red-200">
                    <Trash2 size={16} />
                  </button>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-600 text-sm mb-1 font-medium">Drug Name</label>
                    <input type="text" placeholder="e.g., Lisinopril" value={med.drug_name} onChange={e => handleDrugNameChange(index, e.target.value)} className="w-full bg-white border border-gray-200 p-3 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors" required/>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-1/2">
                       <label className="block text-gray-600 text-sm mb-1 font-medium">Dosage</label>
                       <input type="text" placeholder="e.g., 10mg" value={med.dosage} onChange={e => updateMed(index, 'dosage', e.target.value)} className="w-full bg-white border border-gray-200 p-3 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors" required/>
                    </div>
                    <div className="w-1/2">
                       <label className="block text-gray-600 text-sm mb-1 font-medium">Frequency</label>
                       <input type="text" placeholder="e.g., Daily" value={med.frequency} onChange={e => updateMed(index, 'frequency', e.target.value)} className="w-full bg-white border border-gray-200 p-3 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors" required/>
                    </div>
                  </div>

                  <div>
                     <label className="block text-gray-600 text-sm mb-1 font-medium">Reminder Time (Optional)</label>
                     <input type="time" value={med.reminder_time} onChange={e => updateMed(index, 'reminder_time', e.target.value)} className="w-full bg-white border border-gray-200 p-3 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors" />
                  </div>
                </div>
              </div>
          ))}

          <button type="button" onClick={addEmptyMed} className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 text-gray-500 rounded-xl hover:bg-gray-50 hover:text-blue-600 hover:border-blue-300 transition-colors font-medium">
            <Plus size={18} /> Add Another
          </button>

          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl active:bg-blue-700 hover:bg-blue-700 transition-colors shadow-md">
            Save All Medications
          </button>
        </form>
      </div>
    </div>
  )
}
