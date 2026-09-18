import { useEffect, useState } from 'react'
import { subscribeToActiveNotices, noticeAppliesTo } from '../../services/noticeService'
import NoticeBanner from '../shared/NoticeBanner'
import { useAuth } from '../../context/AuthContext'

export default function NoticeFeed() {
  const { user } = useAuth()
  const [notices, setNotices] = useState([])

  useEffect(() => {
    const unsub = subscribeToActiveNotices((all) => {
      setNotices(all.filter((n) => noticeAppliesTo(n, user?.houseId)))
    })
    return () => unsub()
  }, [user])

  if (notices.length === 0) return null

  return (
    <div>
      {notices.map((n) => (
        <NoticeBanner key={n.id} notice={n} />
      ))}
    </div>
  )
}
