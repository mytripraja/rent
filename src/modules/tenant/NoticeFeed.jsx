import { useEffect, useState } from 'react'
import { subscribeToActiveNotices } from '../../services/noticeService'
import NoticeBanner from '../shared/NoticeBanner'
import { useAuth } from '../../context/AuthContext'

export default function NoticeFeed() {
  const { user } = useAuth()
  const [notices, setNotices] = useState([])

  useEffect(() => {
    const unsub = subscribeToActiveNotices(setNotices, user?.houseId)
    return () => unsub()
  }, [user])

  if (notices.length === 0) return null

  return (
    <div>
      {notices.map((n) => {
        const linkedIds = Array.isArray(n.linkedNoticeIds) ? n.linkedNoticeIds : []
        const relatedNotices = notices.filter(item => item.id !== n.id && linkedIds.includes(item.id))
        return <NoticeBanner key={n.id} notice={n} relatedNotices={relatedNotices} />
      })}
    </div>
  )
}
