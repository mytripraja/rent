import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, Image as ImageIcon, Plus, X, Wrench, Zap, Paintbrush, Wind, Shield, Droplets, Home, CircleEllipsis } from 'lucide-react'
import { addExpense, listExpenses, deleteExpense, getMonthlyExpenseTotal } from '../../services/expenseService'
import { getCashReceivers } from '../../services/configService'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../shared/ui/Toast'
import ConfirmDialog from '../shared/ui/ConfirmDialog'

const CATEGORIES = [
  { id: 'plumbing', label: 'Plumbing', icon: Wrench, color: 'bg-blue-100 text-blue-700' },
  { id: 'electrical', label: 'Electrical', icon: Zap, color: 'bg-yellow-100 text-yellow-700' },
  { id: 'painting', label: 'Painting', icon: Paintbrush, color: 'bg-pink-100 text-pink-700' },
  { id: 'cleaning', label: 'Cleaning', icon: Wind, color: 'bg-teal-100 text-teal-700' },
  { id: 'security', label: 'Security', icon: Shield, color: 'bg-slate-100 text-slate-700' },
  { id: 'water_tank', label: 'Water Tank', icon: Droplets, color: 'bg-cyan-100 text-cyan-700' },
  { id: 'common_area', label: 'Common Area', icon: Home, color: 'bg-indigo-100 text-indigo-700' },
  { id: 'other', label: 'Other', icon: CircleEllipsis, color: 'bg-gray-100 text-gray-700' }
]

export default function ExpenseTracker() {
  const { user } = useAuth()
  const toast = useToast()
  const [expenses, setExpenses] = useState([])
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [total, setTotal] = useState(0)
  const [receivers, setReceivers] = useState([])
  const [isAdding, setIsAdding] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [category, setCategory] = useState('other')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [paidBy, setPaidBy] = useState('')
  const [file, setFile] = useState(null)

  useEffect(() => {
    load()
    getCashReceivers().then(setReceivers)
  }, [month])

  async function load() {
    try {
      const data = await listExpenses(month)
      setExpenses(data)
      setTotal(data.reduce((sum, exp) => sum + exp.amount, 0))
    } catch (error) {
      toast.error('Failed to load expenses')
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!description || !amount || !paidBy) {
      return toast.error('Please fill all required fields')
    }
    
    setIsSubmitting(true)
    try {
      await addExpense({
        category,
        description,
        amount,
        date,
        paidBy,
        receiptFile: file,
        createdBy: { uid: user.uid, name: user.name }
      })
      toast.success('Expense added')
      setIsAdding(false)
      resetForm()
      load()
    } catch (error) {
      console.error(error)
      toast.error('Failed to add expense')
    } finally {
      setIsSubmitting(false)
    }
  }

  function resetForm() {
    setCategory('other')
    setDescription('')
    setAmount('')
    setDate(new Date().toISOString().slice(0, 10))
    setPaidBy(receivers[0] || '')
    setFile(null)
  }

  async function handleDelete() {
    try {
      await deleteExpense(deletingId)
      toast.success('Expense deleted')
      setDeletingId(null)
      load()
    } catch (error) {
      toast.error('Failed to delete')
    }
  }

  const getCategoryIcon = (catId) => {
    const cat = CATEGORIES.find(c => c.id === catId) || CATEGORIES[CATEGORIES.length - 1]
    const Icon = cat.icon
    return <div className={`p-2 rounded-lg ${cat.color}`}><Icon size={20} /></div>
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-paper-raised p-4 rounded-2xl border border-brass/20 shadow-sm">
        <div>
          <h2 className="text-sm font-medium text-ink-soft">Total Expenses</h2>
          <p className="text-3xl font-display font-bold text-cover">₹{total.toLocaleString()}</p>
        </div>
        <input 
          type="month" 
          value={month} 
          onChange={e => setMonth(e.target.value)}
          className="border border-brass/30 rounded-lg px-3 py-2 text-sm bg-paper focus:outline-none"
        />
      </div>

      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-ink">Expense Log</h3>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1 bg-brand text-white px-3 py-1.5 rounded-lg text-sm font-medium"
        >
          {isAdding ? <X size={16} /> : <Plus size={16} />}
          {isAdding ? 'Cancel' : 'Add Expense'}
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.form 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-paper-raised p-4 rounded-xl border border-brass/20 shadow-sm space-y-4 overflow-hidden"
            onSubmit={handleAdd}
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-ink mb-1">Category</label>
                <select 
                  value={category} 
                  onChange={e => setCategory(e.target.value)}
                  className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm bg-paper"
                >
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink mb-1">Amount (₹)</label>
                <input 
                  type="number" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)}
                  className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm bg-paper"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Description</label>
              <input 
                value={description} 
                onChange={e => setDescription(e.target.value)}
                className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm bg-paper"
                placeholder="What was this for?"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-ink mb-1">Date</label>
                <input 
                  type="date" 
                  value={date} 
                  onChange={e => setDate(e.target.value)}
                  className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm bg-paper"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink mb-1">Paid By</label>
                <select 
                  value={paidBy} 
                  onChange={e => setPaidBy(e.target.value)}
                  className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm bg-paper"
                  required
                >
                  <option value="">Select...</option>
                  {receivers.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink mb-1">Receipt Photo (Optional)</label>
              <input 
                type="file" 
                accept="image/*"
                onChange={e => setFile(e.target.files[0])}
                className="w-full text-sm text-ink-soft file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brass/10 file:text-brand hover:file:bg-brass/20"
              />
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full bg-cover text-paper py-2 rounded-lg text-sm font-medium disabled:opacity-60"
            >
              {isSubmitting ? 'Saving...' : 'Save Expense'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        {expenses.length === 0 && !isAdding && (
          <p className="text-center text-sm text-ink-soft py-8">No expenses recorded for this month.</p>
        )}
        
        {expenses.map((exp) => (
          <div key={exp.id} className="bg-paper-raised p-4 rounded-xl border border-brass/15 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 overflow-hidden">
              {getCategoryIcon(exp.category)}
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">{exp.description}</p>
                <p className="text-xs text-ink-soft">
                  {new Date(exp.date).toLocaleDateString()} · Paid by {exp.paidBy}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <p className="text-sm font-bold text-ink">₹{exp.amount}</p>
                {exp.receiptUrl && (
                  <a href={exp.receiptUrl} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline inline-flex items-center gap-1">
                    <ImageIcon size={12} /> Receipt
                  </a>
                )}
              </div>
              <button 
                onClick={() => setDeletingId(exp.id)}
                className="p-2 text-ink-soft hover:text-stamp-red hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog 
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete Expense"
        message="Are you sure you want to delete this expense record?"
        confirmText="Delete"
        isDanger={true}
      />
    </div>
  )
}
