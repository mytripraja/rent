import React, { useEffect, useState } from 'react'
import { X, Printer } from 'lucide-react'
import { getAppConfig } from '../../services/configService'

export default function RentReceipt({ payment, house, onClose }) {
  const [config, setConfig] = useState(null)

  useEffect(() => {
    getAppConfig().then(setConfig)
  }, [])

  if (!payment) return null

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 print:p-0 print:bg-white print:block">
      <div className="bg-paper-raised w-full max-w-lg rounded-2xl shadow-xl overflow-hidden print:shadow-none print:w-full print:max-w-none print:rounded-none border border-brass/20 print:border-none">
        
        {/* Header - hide on print */}
        <div className="flex items-center justify-between p-4 border-b border-brass/20 print:hidden bg-paper">
          <h3 className="font-semibold text-ink">Rent Receipt</h3>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="p-2 text-ink-soft hover:bg-brass/10 rounded-full">
              <Printer size={18} />
            </button>
            <button onClick={onClose} className="p-2 text-ink-soft hover:bg-brass/10 rounded-full">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Receipt Content - this gets printed */}
        <div className="p-8 print:p-4 bg-paper-raised relative" id="receipt-content">
          <style>
            {`
              @media print {
                body * {
                  visibility: hidden;
                }
                #receipt-content, #receipt-content * {
                  visibility: visible;
                }
                #receipt-content {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                }
              }
            `}
          </style>

          <div className="text-center mb-6">
            <h1 className="text-2xl font-display font-bold text-cover uppercase tracking-wider">
              {config?.apartmentName || 'Rental Manager'}
            </h1>
            {config?.apartmentAddress && (
              <p className="text-sm text-ink-soft mt-1 whitespace-pre-line">{config.apartmentAddress}</p>
            )}
            <div className="mt-4 border-b-2 border-brass/30 pb-2 flex justify-between items-end">
              <h2 className="text-lg font-semibold text-ink">RENT RECEIPT</h2>
              <span className="text-sm font-mono text-ink-soft">No: {payment.applicationNumber || payment.id.slice(-6)}</span>
            </div>
          </div>

          <div className="space-y-4 text-sm text-ink">
            <div className="flex justify-between">
              <span className="text-ink-soft">Date:</span>
              <span className="font-medium font-mono">{payment.actionedAt ? new Date(payment.actionedAt).toLocaleDateString() : new Date().toLocaleDateString()}</span>
            </div>

            <div>
              <p className="mb-1">Received with thanks from:</p>
              <p className="font-semibold border-b border-dashed border-brass/40 pb-1">{payment.recordedBy?.name || 'Tenant'} (Door {house?.internalDoorNumber || payment.houseId})</p>
            </div>

            <div className="flex justify-between items-end">
              <span className="text-ink-soft">A sum of Rupees:</span>
              <span className="font-bold text-lg font-mono">₹{payment.amount}</span>
            </div>

            <div>
              <p className="mb-1">By payment mode:</p>
              <p className="font-semibold capitalize border-b border-dashed border-brass/40 pb-1">
                {payment.mode} {payment.mode === 'cash' && payment.cashReceivedBy ? `(to ${payment.cashReceivedBy})` : ''}
              </p>
            </div>

            <div>
              <p className="mb-1">For rent of month:</p>
              <p className="font-semibold border-b border-dashed border-brass/40 pb-1">{payment.month}</p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-brass/20 flex justify-between items-center">
            <div className="text-center">
              <div className="border-2 border-stamp-green text-stamp-green text-lg font-bold font-mono px-4 py-1 rounded-sm rotate-[-5deg] inline-block opacity-80">
                APPROVED
              </div>
            </div>
            <div className="text-right">
              <p className="font-medium text-ink">{payment.actionedBy?.name || 'Owner'}</p>
              <p className="text-xs text-ink-soft">Authorized Signatory</p>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-xs text-ink-soft italic">This is a computer-generated receipt.</p>
          </div>

        </div>
      </div>
    </div>
  )
}
