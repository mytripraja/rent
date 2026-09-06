import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy, where } from 'firebase/firestore'
import { db } from './firebase'
import { uploadImage } from './cloudinaryService'

const COLLECTION = 'expenses'

export async function addExpense({ category, description, amount, date, paidBy, receiptFile, createdBy }) {
  const ref = doc(collection(db, COLLECTION))
  let receiptUrl = null
  
  if (receiptFile) {
    receiptUrl = await uploadImage(receiptFile, 'expenses')
  }

  const data = {
    id: ref.id,
    category,
    description,
    amount: Number(amount),
    date,
    paidBy,
    receiptUrl,
    createdAt: Date.now(),
    createdBy
  }

  await setDoc(ref, data)
  return data
}

export async function listExpenses(month = null) {
  let q = query(collection(db, COLLECTION), orderBy('date', 'desc'))
  
  if (month) {
    q = query(
      collection(db, COLLECTION),
      where('date', '>=', `${month}-01`),
      where('date', '<=', `${month}-31`),
      orderBy('date', 'desc')
    )
  }

  const snap = await getDocs(q)
  return snap.docs.map(d => d.data())
}

export async function deleteExpense(id) {
  await deleteDoc(doc(db, COLLECTION, id))
}

export async function getMonthlyExpenseTotal(month) {
  const expenses = await listExpenses(month)
  return expenses.reduce((sum, exp) => sum + exp.amount, 0)
}

export async function getExpensesByCategory(month) {
  const expenses = await listExpenses(month)
  const grouped = {}
  expenses.forEach(exp => {
    grouped[exp.category] = (grouped[exp.category] || 0) + exp.amount
  })
  return grouped
}
