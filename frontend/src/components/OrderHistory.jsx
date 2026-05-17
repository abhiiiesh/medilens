import { ArrowLeft, Package, Clock, CheckCircle2, Truck } from 'lucide-react'

export default function OrderHistory({ pastOrders = [], activeOrder, onBack }) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-6 pb-32">
      <div className="flex items-center gap-4 mb-8 mt-4">
        <button onClick={onBack} className="p-3 bg-white border border-gray-200 rounded-full text-gray-600 hover:bg-gray-100 shadow-sm transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-3xl font-bold">Order History</h1>
      </div>

      <div className="max-w-xl mx-auto space-y-4">
        {activeOrder && (
          <div className="bg-white p-5 rounded-3xl border-2 border-violet-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 bottom-0 left-0 bg-violet-50/50 animate-[pulse_2s_infinite] pointer-events-none"></div>
            <div className="relative">
              <div className="flex justify-between items-start mb-3 border-b border-violet-100 pb-3">
                <div className="flex items-center gap-2 text-violet-600 font-bold text-sm bg-violet-100 px-3 py-1 rounded-full">
                  <Truck size={16} /> In Transit
                </div>
                <span className="text-sm text-violet-500 font-medium animate-pulse">
                  Arriving Soon
                </span>
              </div>
              
              <h3 className="font-bold text-lg text-gray-900">{activeOrder.drugName}</h3>
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                <Package size={14} /> Fulfilling from {activeOrder.pharmacy}
              </p>
              
              <div className="mt-4 pt-3 border-t border-violet-100 flex justify-between items-center">
                <span className="text-sm text-gray-500 font-medium">Total Paid</span>
                <span className="font-bold text-gray-900">${activeOrder.total}</span>
              </div>
            </div>
          </div>
        )}

        {pastOrders.length === 0 && !activeOrder ? (
          <div className="text-center p-10 bg-white border border-gray-200 rounded-3xl shadow-sm">
            <Package size={48} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">No Past Orders</h2>
            <p className="text-gray-500">Your delivery history will appear here once you make a purchase.</p>
          </div>
        ) : (
          pastOrders.map((order, idx) => (
            <div key={idx} className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm">
              <div className="flex justify-between items-start mb-3 border-b pb-3">
                <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm bg-emerald-50 px-3 py-1 rounded-full">
                  <CheckCircle2 size={16} /> Delivered
                </div>
                <span className="text-sm text-gray-500 font-medium">
                  {order.deliveredAt ? new Date(order.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recently"}
                </span>
              </div>
              
              <h3 className="font-bold text-lg text-gray-900">{order.drugName}</h3>
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                <Package size={14} /> Fulfilled by {order.pharmacy}
              </p>
              
              <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                <span className="text-sm text-gray-500 font-medium">Total Paid</span>
                <span className="font-bold text-gray-900">${order.total}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
