import React, { useState, useEffect } from 'react'
import { Bell, BellRing, Check, MessageCircle } from 'lucide-react'
import { sendWhatsAppMessage, generateRentReminderMessage } from '../../services/whatsappService'
import { checkAndCreateReminders, getReminderStatus, sendReminder } from '../../services/reminderService'
import { listHouses } from '../../services/houseService'
import { useToast } from '../shared/ui/Toast'

export default function PaymentReminders() {
  const [unpaidHouses, setUnpaidHouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [remindersStatus, setRemindersStatus] = useState({})
  const [sending, setSending] = useState(false)
  const month = new Date().toISOString().slice(0, 7)
  const toast = useToast()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const houses = await checkAndCreateReminders()
      
      const statusMap = {}
      for (const house of houses) {
        const sent = await getReminderStatus(house.id, month)
        statusMap[house.id] = sent
      }
      
      setUnpaidHouses(houses)
      setRemindersStatus(statusMap)
    } catch (error) {
      console.error(error)
      toast.error('Failed to load reminders')
    } finally {
      setLoading(false)
    }
  }

  async function handleSend(house) {
    if (!house.tenantUid) {
      return toast.error('No tenant account linked to this house.')
    }
    setSending(true)
    try {
      await sendReminder(house, month, house.tenantUid)
      setRemindersStatus(prev => ({ ...prev, [house.id]: true }))
      toast.success(`Reminder sent to Door ${house.internalDoorNumber || house.id}`)
    } catch (error) {
      toast.error('Failed to send reminder')
    } finally {
      setSending(false)
    }
  }

  async function handleSendAll() {
    const toSend = unpaidHouses.filter(h => !remindersStatus[h.id] && h.tenantUid)
    if (toSend.length === 0) return toast.info('No pending reminders to send.')
    
    setSending(true)
    try {
      for (const house of toSend) {
        await sendReminder(house, month, house.tenantUid)
      }
      toast.success(`Sent ${toSend.length} reminders`)
      loadData()
    } catch (error) {
      toast.error('Failed to send all reminders')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <div className="text-sm text-ink-soft py-4">Checking rent statuses...</div>
  }

  if (unpaidHouses.length === 0) {
    return (
      <div className="bg-paper-raised border border-brass/20 rounded-xl p-6 text-center">
        <Check className="mx-auto text-stamp-green mb-2" size={32} />
        <h3 className="font-semibold text-ink">All caught up!</h3>
        <p className="text-sm text-ink-soft">Everyone has paid rent for {month}.</p>
      </div>
    )
  }

  const allSent = unpaidHouses.every(h => remindersStatus[h.id])

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-paper-raised p-4 rounded-xl border border-brass/20 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-ink flex items-center gap-2">
            <Bell size={18} className="text-stamp-amber" /> 
            Pending Rent: {month}
          </h2>
          <p className="text-xs text-ink-soft mt-1">{unpaidHouses.length} houses have not paid yet.</p>
        </div>
        <button 
          onClick={handleSendAll}
          disabled={sending || allSent}
          className="bg-stamp-amber text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          Send All Reminders
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {unpaidHouses.map(house => {
          const sent = remindersStatus[house.id]
          
          return (
            <div key={house.id} className="bg-paper border border-brass/20 rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="font-medium text-ink">Door {house.internalDoorNumber || house.id}</p>
                <p className="text-xs text-ink-soft">{house.tenantName || 'Tenant'}</p>
              </div>
              
              {sent ? (
                <span className="text-xs text-stamp-green flex items-center gap-1 font-medium bg-green-50 px-2 py-1 rounded-full">
                  <Check size={14} /> Sent
                </span>
              ) : (
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleSend(house)}
                    disabled={sending || !house.tenantUid}
                    className="text-xs text-brand hover:underline flex items-center gap-1 disabled:opacity-50 disabled:no-underline"
                  >
                    <BellRing size={14} /> Remind in App
                  </button>
                  <button
                    onClick={() => {
                      const msg = generateRentReminderMessage(house.tenantName || 'Tenant', house.internalDoorNumber || house.id, month, house.rentAmount || 0)
                      sendWhatsAppMessage(house.tenantPhone || '', msg)
                    }}
                    className="text-xs text-green-600 hover:underline flex items-center gap-1"
                  >
                    <MessageCircle size={14} /> WhatsApp
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
