import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Minus, Tag, CheckCircle2, Package, ShieldCheck } from 'lucide-react'
import { API_BASE_URL } from '../config'

export default function Checkout({ cart = [], onBack, onSuccess }) {
  // Use a local copy of cart to manage quantities
  const [items, setItems] = useState(
    cart.map(item => ({
      ...item,
      quantity: item.quantity || 1,
      unitPrice: item.price ? parseFloat(item.price.replace('$', '')) : 25.00
    }))
  )
  const [promoCode, setPromoCode] = useState('')
  const [discount, setDiscount] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [orderComplete, setOrderComplete] = useState(false)

  const [addons, setAddons] = useState([
    { id: 1, name: 'Hydration Salts', price: 5.99, added: false },
    { id: 2, name: 'Probiotics 30ct', price: 15.50, added: false },
    { id: 3, name: 'Thermometer', price: 12.00, added: false }
  ])

  // Fetch AI-powered add-ons based on cart contents
  useEffect(() => {
    const drugNames = items.map(i => i.drugName).filter(Boolean)
    if (drugNames.length === 0) return
    fetch(`${API_BASE_URL}/pharmacy/addons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drugs: drugNames })
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setAddons(data.map((a, i) => ({ id: i + 1, name: a.name, price: a.price, added: false })))
        }
      })
      .catch(() => {}) // silently fallback to defaults
  }, [])

  const updateQuantity = (idx, delta) => {
    const newItems = [...items]
    newItems[idx].quantity = Math.max(1, newItems[idx].quantity + delta)
    setItems(newItems)
  }

  const toggleAddon = (id) => {
    setAddons(addons.map(a => a.id === id ? { ...a, added: !a.added } : a))
  }

  const applyPromo = () => {
    if (promoCode.toUpperCase() === 'MEDILENS20') {
      setDiscount(0.20)
      alert("20% Discount Applied!")
    } else {
      setDiscount(0)
      alert("Invalid promo code.")
    }
  }

  const itemsTotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0)
  const addonsTotal = addons.filter(a => a.added).reduce((sum, a) => sum + a.price, 0)
  const subtotal = itemsTotal + addonsTotal
  const discountAmount = subtotal * discount
  const taxes = (subtotal - discountAmount) * 0.08
  const deliveryFee = subtotal > 0 ? 4.99 : 0
  const total = subtotal - discountAmount + taxes + deliveryFee

  const handlePayment = () => {
    setIsProcessing(true)
    setTimeout(() => {
      setIsProcessing(false)
      setOrderComplete(true)
    }, 2000)
  }

  if (orderComplete) {
    const mainDrug = items.length > 0 ? items[0].drugName : "Items"
    const orderLabel = items.length > 1 ? `${mainDrug} + ${items.length - 1} more` : mainDrug

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center font-sans pb-32">
        <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 animate-bounce">
          <CheckCircle2 size={48} />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Order Confirmed!</h1>
        <p className="text-lg text-gray-600 mb-8 max-w-md">
          Your order containing <span className="font-bold text-gray-800">{orderLabel}</span> is being prepared and will be delivered in <span className="font-bold text-emerald-600">under 30 minutes</span>.
        </p>
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm w-full max-w-sm mb-8 text-left">
          <h3 className="font-bold text-gray-800 border-b pb-3 mb-3">Order Receipt</h3>
          <p className="text-gray-600 flex justify-between"><span>Total Paid:</span> <span className="font-bold">${total.toFixed(2)}</span></p>
          <p className="text-gray-600 flex justify-between mt-2"><span>Deliver To:</span> <span>Current Location</span></p>
        </div>
        <button onClick={() => onSuccess({ drugName: orderLabel, pharmacy: items[0]?.pharmacy || "MediLens Network", total: total.toFixed(2) })} className="bg-violet-600 text-white font-bold py-4 px-12 rounded-2xl hover:bg-violet-700 transition-colors w-full max-w-sm shadow-md">
          Track Order on Dashboard
        </button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center font-sans">
        <Package size={48} className="text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Your Cart is Empty</h2>
        <button onClick={onBack} className="text-violet-600 font-bold hover:underline">Return to Radar</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-4 md:p-6 pb-24 md:pb-32">
      <div className="flex items-center gap-4 mb-4 md:mb-8 mt-2 md:mt-4">
        <button onClick={onBack} className="p-2 md:p-3 bg-white border border-gray-200 rounded-full text-gray-600 hover:bg-gray-100 shadow-sm transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl md:text-3xl font-bold">Checkout</h1>
      </div>

      <div className="max-w-xl mx-auto space-y-4">
        
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold text-gray-800 px-2">Your Cart</h3>
          <button onClick={onBack} className="text-sm font-bold text-violet-600 hover:underline px-2">Continue Shopping</button>
        </div>

        {/* Cart Items */}
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-lg">{item.drugName}</p>
                  <p className="text-sm text-gray-500 line-clamp-1">From: {item.pharmacy}</p>
                </div>
                <p className="font-bold text-gray-700">${item.unitPrice.toFixed(2)}</p>
              </div>
              <div className="flex justify-between items-center border-t pt-3">
                <p className="text-sm text-gray-500 font-medium">Quantity</p>
                <div className="flex items-center gap-4 bg-gray-50 border border-gray-200 rounded-xl p-1">
                  <button onClick={() => updateQuantity(idx, -1)} className="p-2 hover:bg-white rounded-lg transition-colors"><Minus size={16}/></button>
                  <span className="font-bold w-4 text-center text-sm">{item.quantity}</span>
                  <button onClick={() => updateQuantity(idx, 1)} className="p-2 hover:bg-white rounded-lg transition-colors"><Plus size={16}/></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add-ons */}
        <div className="pt-4">
          <h3 className="font-bold text-gray-800 mb-3 px-2">Suggested Add-ons</h3>
          <div className="flex gap-3 overflow-x-auto pb-4 px-2 snap-x">
            {addons.map(addon => (
              <div key={addon.id} className={`flex-shrink-0 w-40 p-4 rounded-2xl border snap-start transition-colors cursor-pointer ${addon.added ? 'bg-violet-50 border-violet-200' : 'bg-white border-gray-200 hover:border-violet-300'}`} onClick={() => toggleAddon(addon.id)}>
                <div className="flex justify-between items-start mb-2">
                  <div className={`p-2 rounded-full ${addon.added ? 'bg-violet-200 text-violet-700' : 'bg-gray-100 text-gray-500'}`}>
                    {addon.added ? <CheckCircle2 size={16} /> : <Plus size={16} />}
                  </div>
                </div>
                <p className="font-bold text-sm text-gray-800 line-clamp-2 h-10">{addon.name}</p>
                <p className="text-sm font-bold text-violet-600 mt-1">${addon.price.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Promo Code */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex gap-2">
          <div className="flex-1 relative">
            <Tag size={18} className="absolute left-3 top-3.5 text-gray-400" />
            <input type="text" placeholder="Promo (MEDILENS20)" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-violet-500 font-medium text-sm uppercase" />
          </div>
          <button onClick={applyPromo} className="bg-gray-900 text-white font-bold px-6 rounded-xl hover:bg-gray-800 transition-colors text-sm">
            Apply
          </button>
        </div>

        {/* Order Summary */}
        <div className="bg-white p-4 md:p-6 rounded-3xl border border-gray-200 shadow-sm space-y-2 md:space-y-3">
          <h3 className="font-bold text-gray-800 border-b pb-3 mb-2">Order Summary</h3>
          <div className="flex justify-between text-gray-600 text-sm">
            <span>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-emerald-600 font-medium text-sm">
              <span>Discount ({discount * 100}%)</span>
              <span>-${discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-600 text-sm">
            <span>Taxes</span>
            <span>${taxes.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-600 text-sm">
            <span>Delivery Fee</span>
            <span>${deliveryFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg pt-3 border-t text-gray-900">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Button */}
        <button 
          onClick={handlePayment} 
          disabled={isProcessing}
          className="w-full py-4 bg-violet-600 text-white rounded-2xl font-bold text-lg shadow-md hover:bg-violet-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
        >
          {isProcessing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Processing Securely...
            </>
          ) : (
            <>
              <ShieldCheck size={20} /> Pay ${total.toFixed(2)}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
