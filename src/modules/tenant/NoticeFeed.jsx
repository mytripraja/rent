import { useEffect, useState } from 'react'
import { listActiveNotices, noticeAppliesTo } from '../../services/noticeService'
import NoticeBanner from '../shared/NoticeBanner'
import { useAuth } from '../../context/AuthContext'

export default function NoticeFeed() {
  const { user } = useAuth()
  const [notices, setNotices] = useState([])

  useEffect(() => {
    listActiveNotices().then((all) =>
      setNotices(all.filter((n) => noticeAppliesTo(n, user?.houseId)))
    )
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
