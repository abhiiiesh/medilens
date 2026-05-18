import { useState, useEffect } from 'react'
import { ArrowLeft, MapPin, Search, Navigation, AlertCircle, CheckCircle, ShoppingBag, Plus } from 'lucide-react'
import { API_BASE_URL } from '../config'

export default function PharmacyRadar({ token, onBack, cart, addToCart, onCheckout, initialQuery = '', onClearQuery }) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [ordering, setOrdering] = useState(null)
  
  // Geolocation state
  const [userLocation, setUserLocation] = useState('Springfield')
  const [isLocating, setIsLocating] = useState(true)

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            // Use free Nominatim API for reverse geocoding
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            const data = await res.json();
            const town = data.address.city || data.address.town || data.address.village || data.address.county || "Local Area";
            setUserLocation(town);
          } catch (e) {
            console.error("Geocoding failed", e);
          } finally {
            setIsLocating(false);
          }
        },
        (error) => {
          console.error("Geolocation error", error);
          setIsLocating(false); // fallback to Springfield
        }
      );
    } else {
      setIsLocating(false);
    }
  }, []);

  // Auto-search if launched from Vault with a pre-filled drug name
  useEffect(() => {
    if (initialQuery && !isLocating) {
      setQuery(initialQuery)
      onClearQuery && onClearQuery()
      // Trigger the search after setting query
      const timer = setTimeout(() => {
        document.getElementById('radar-search-btn')?.click()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [initialQuery, isLocating])

  const handleAddToCart = (pharmacyName, price) => {
    setOrdering(pharmacyName)
    setTimeout(() => {
      setOrdering(null)
      addToCart({ drugName: query, pharmacy: pharmacyName, price: price, quantity: 1 })
    }, 500)
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query) return
    
    setIsSearching(true)
    setHasSearched(true)
    
    try {
      const res = await fetch(`${API_BASE_URL}/pharmacy/inventory/${encodeURIComponent(query)}?location=${encodeURIComponent(userLocation)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        setResults(await res.json())
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-6 pb-32">
      <div className="flex items-center gap-4 mb-8 mt-4">
        <button onClick={onBack} className="p-3 bg-white border border-gray-200 rounded-full text-gray-600 hover:bg-gray-100 shadow-sm transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-3xl font-bold">Pharmacy Radar</h1>
      </div>

      <div className="bg-gradient-to-r from-violet-500 to-fuchsia-600 rounded-3xl p-6 text-white mb-8 shadow-lg">
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2"><MapPin size={24}/> Local Inventory</h2>
        <p className="text-violet-50 text-sm leading-relaxed font-medium mb-3">
          Locate rare or out-of-stock medications in real-time. We scan nearby pharmacies to save you the trip.
        </p>
        <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-max">
          📍 Scanning inventory near: {isLocating ? "Locating you..." : userLocation}
        </div>
      </div>

      <form onSubmit={handleSearch} className="relative mb-8 shadow-sm">
        <input 
          type="text" 
          placeholder="e.g. Adderall, Amoxicillin" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-violet-500 font-medium"
          required
        />
        <Search className="absolute left-4 top-4 text-gray-400" size={24} />
        <button type="submit" id="radar-search-btn" className="absolute right-2 top-2 bottom-2 bg-violet-600 hover:bg-violet-700 text-white px-6 rounded-xl font-bold transition-colors">
          {isSearching ? 'Scanning...' : 'Find'}
        </button>
      </form>

      {hasSearched && !isSearching && (
        <div>
          <h3 className="font-bold text-gray-700 mb-4 px-2">Results for "{query}"</h3>
          <div className="space-y-4">
            {results.map((pharmacy, idx) => (
              <div key={idx} className={`bg-white p-5 rounded-2xl border shadow-sm ${pharmacy.in_stock ? 'border-gray-200' : 'border-red-100'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-lg text-gray-900">{pharmacy.name}</h4>
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                      <Navigation size={14} /> {pharmacy.distance} • {pharmacy.address}
                    </p>
                  </div>
                  <div className="text-right">
                    {pharmacy.in_stock ? (
                      <span className="flex items-center gap-1 text-sm font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                        <CheckCircle size={14} /> In Stock
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-sm font-bold text-red-700 bg-red-50 px-3 py-1 rounded-full border border-red-100">
                        <AlertCircle size={14} /> Out of Stock
                      </span>
                    )}
                    {pharmacy.in_stock && pharmacy.price && (
                      <p className="text-xs font-bold text-gray-500 mt-2">Est. {pharmacy.price}</p>
                    )}
                  </div>
                </div>
                
                {pharmacy.in_stock && (
                  <div className="flex gap-2 mt-4">
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pharmacy.name + ' ' + pharmacy.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 flex justify-center items-center gap-2 border border-violet-200 text-violet-700 font-bold rounded-xl hover:bg-violet-50 transition-colors"
                    >
                      <Navigation size={16} /> Get Directions
                    </a>
                    <button 
                      onClick={() => handleAddToCart(pharmacy.name, pharmacy.price)}
                      disabled={ordering === pharmacy.name}
                      className="flex-1 py-3 flex justify-center items-center gap-2 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50"
                    >
                      <Plus size={16} /> {ordering === pharmacy.name ? 'Adding...' : 'Add to Cart'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating View Cart Button */}
      {cart && cart.length > 0 && (
        <div className="fixed bottom-8 left-0 right-0 px-6 flex justify-center z-50">
          <button 
            onClick={onCheckout}
            className="w-full max-w-sm bg-gray-900 text-white font-bold text-lg py-4 rounded-full shadow-2xl flex justify-between items-center px-8 hover:bg-gray-800 transition-transform hover:scale-105"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag size={20} />
              <span>View Cart</span>
            </div>
            <span className="bg-white text-gray-900 px-3 py-1 rounded-full text-sm">{cart.length} item{cart.length > 1 ? 's' : ''}</span>
          </button>
        </div>
      )}
    </div>
  )
}
