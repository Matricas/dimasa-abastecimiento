import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { listUsers, setUserRole } from '../services/userService'

export function useUsers() {
  const { user } = useAuth()
  const currentUserId = user?.id
  const [users, setUsers] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const [saveError, setSaveError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setUsers(await listUsers())
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const changeRole = useCallback(async (userId, role) => {
    setSavingId(userId)
    setSaveError(null)
    try {
      const saved = await setUserRole(userId, role)
      // Si el admin se cambió su propio rol, recargar para que menú y permisos reflejen el nuevo rol
      if (userId === currentUserId) {
        window.location.reload()
        return
      }
      setUsers((prev) => prev.map((u) => (u.user_id === userId ? { ...u, role: saved } : u)))
    } catch (err) {
      setSaveError({ userId, error: err })
    } finally {
      setSavingId(null)
    }
  }, [currentUserId])

  useEffect(() => {
    load()
  }, [load])

  return { users, loading, error, reload: load, changeRole, savingId, saveError }
}
