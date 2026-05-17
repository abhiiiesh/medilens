import { useState, useEffect } from 'react'
import { ArrowLeft, FileText, UploadCloud, CheckCircle, Clock, AlertCircle, Search, Scan } from 'lucide-react'

export default function Vault({ token, onBack, onFindOnRadar }) {
  const [documents, setDocuments] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [parsingDoc, setParsingDoc] = useState(null) // { id, filename }
  const [parsedDrugs, setParsedDrugs] = useState([]) // [{ drug_name, dosage }]

  const loadDocuments = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/vault/documents', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) setDocuments(await res.json())
    } catch (e) {
      console.error(e)
    }
  }

  // Poll for document status updates every 3 seconds
  useEffect(() => {
    loadDocuments()
    const interval = setInterval(loadDocuments, 3000)
    return () => clearInterval(interval)
  }, [])

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    setIsUploading(true)
    const formData = new FormData()
    formData.append("file", file)

    try {
      await fetch('http://127.0.0.1:8000/vault/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      })
      loadDocuments()
    } catch (error) {
      console.error("Upload failed", error)
    } finally {
      setIsUploading(false)
      e.target.value = null
    }
  }

  const handleParseDoc = async (doc) => {
    setParsingDoc(doc)
    setParsedDrugs([])
    // Re-fetch the file via blob and send to parse-prescription endpoint
    try {
      // We use a mock parse here since we only have the filename, not the file bytes
      // In a real system, we'd call /parse-prescription with the stored file
      // For now, extract drug name from filename as a demo
      const guessedDrug = doc.filename.split('.')[0].replace(/[_-]/g, ' ')
      setParsedDrugs([{ drug_name: guessedDrug, dosage: "As prescribed" }])
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
        <h1 className="text-3xl font-bold">Health Vault</h1>
      </div>

      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-3xl p-6 text-white mb-8 shadow-lg">
        <h2 className="text-xl font-bold mb-2">Agentic Document AI</h2>
        <p className="text-blue-50 text-sm leading-relaxed font-medium">
          Upload your lab reports, discharge summaries, or doctor's notes. Our AI will automatically read them in the background and extract your diagnoses and allergies into your Health Memory.
        </p>
      </div>

      {/* Upload Zone */}
      <div className="mb-8 relative">
        <input 
          type="file" 
          onChange={handleFileUpload}
          accept=".jpg,.jpeg,.png,.pdf" 
          disabled={isUploading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div className={`border-2 border-dashed ${isUploading ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-white hover:bg-gray-50'} rounded-3xl p-8 flex flex-col items-center justify-center text-center transition-colors shadow-sm`}>
          <div className={`p-4 rounded-full mb-3 ${isUploading ? 'bg-blue-100 text-blue-600 animate-pulse' : 'bg-gray-100 text-gray-400'}`}>
            <UploadCloud size={32} />
          </div>
          <h3 className="font-bold text-lg text-gray-800">
            {isUploading ? "Uploading to Vault..." : "Tap to Upload Medical Document"}
          </h3>
          <p className="text-gray-500 text-sm mt-1">Supports PDF, JPG, PNG</p>
        </div>
      </div>

      {/* Document List */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
          <FileText size={20} className="text-indigo-500" /> Uploaded Documents
        </h2>
        <div className="space-y-3">
          {documents.map(doc => (
            <div key={doc.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                <FileText size={20} className="text-gray-400 flex-shrink-0" />
                <span className="font-medium text-gray-800 truncate">{doc.filename}</span>
              </div>
              
              <div className="flex-shrink-0 ml-3 flex items-center gap-2">
                {doc.status === 'processing' && (
                  <span className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 animate-pulse">
                    <Clock size={12}/> Parsing
                  </span>
                )}
                {doc.status === 'completed' && (
                  <>
                    <span className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded-md border border-green-200">
                      <CheckCircle size={12}/> Extracted
                    </span>
                    <button
                      onClick={() => handleParseDoc(doc)}
                      className="flex items-center gap-1 text-xs font-bold text-violet-700 bg-violet-50 px-2 py-1 rounded-md border border-violet-200 hover:bg-violet-100 transition-colors"
                    >
                      <Scan size={12}/> Find Drugs
                    </button>
                  </>
                )}
                {doc.status === 'failed' && (
                  <span className="flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 px-2 py-1 rounded-md border border-red-200">
                    <AlertCircle size={12}/> Failed
                  </span>
                )}
              </div>
            </div>
          ))}
          {documents.length === 0 && (
            <p className="text-center p-6 text-gray-500 italic border border-dashed border-gray-200 rounded-2xl">
              No documents in your vault yet.
            </p>
          )}
        </div>
      </div>

      {/* Parsed Drug Drawer */}
      {parsingDoc && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={() => setParsingDoc(null)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 pb-10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4"></div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Medications Found</h2>
            <p className="text-sm text-gray-500 mb-5">From: <span className="font-medium text-gray-700">{parsingDoc.filename}</span></p>
            <div className="space-y-3">
              {parsedDrugs.map((drug, i) => (
                <div key={i} className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-200">
                  <div>
                    <p className="font-bold text-gray-900 capitalize">{drug.drug_name}</p>
                    <p className="text-xs text-gray-500">{drug.dosage}</p>
                  </div>
                  <button
                    onClick={() => { setParsingDoc(null); onFindOnRadar && onFindOnRadar(drug.drug_name) }}
                    className="flex items-center gap-2 bg-violet-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-violet-700 transition-colors"
                  >
                    <Search size={14} /> Find on Radar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
