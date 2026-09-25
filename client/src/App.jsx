import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, Route, BrowserRouter as Router, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import './App.css'
import { QUEUE_REALTIME_EVENTS, QUEUE_SOCKET_EVENTS } from './constants/queueSocketEvents'
import { disconnectSocket, joinQueueRoom, leaveQueueRoom, onSocketEvent } from './services/socket'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api'
const queryClient = new QueryClient()
const AuthContext = createContext(null)

const getMessage = (error) => error?.message || 'Something went wrong'

const invalidateQueueQueries = (queryClient, queueId) => {
  queryClient.invalidateQueries({ queryKey: ['queues'] })
  queryClient.invalidateQueries({ queryKey: ['staff-queues'] })
  queryClient.invalidateQueries({ queryKey: ['queues', 'my-active'] })

  if (queueId) {
    queryClient.invalidateQueries({ queryKey: ['queue-status', queueId] })
    queryClient.invalidateQueries({ queryKey: ['my-position', queueId] })
    queryClient.invalidateQueries({ queryKey: ['staff-queue', queueId] })
  } else {
    queryClient.invalidateQueries({ queryKey: ['queue-status'] })
    queryClient.invalidateQueries({ queryKey: ['my-position'] })
    queryClient.invalidateQueries({ queryKey: ['staff-queue'] })
  }
}

const CUSTOMER_STATUS_REALTIME_EVENTS = [
  QUEUE_SOCKET_EVENTS.UPDATED,
  QUEUE_SOCKET_EVENTS.CALLED,
  QUEUE_SOCKET_EVENTS.COMPLETED,
  QUEUE_SOCKET_EVENTS.LEFT,
  QUEUE_SOCKET_EVENTS.CLOSED,
]

const request = async (path, options = {}) => {
  const token = localStorage.getItem('ql_token')
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || 'Request failed')
  }

  return data.data ?? data
}

const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: (path, body) => request(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: (path) => request(path, { method: 'DELETE' }),
}

function useQueueRealtime(queueId, { events = QUEUE_REALTIME_EVENTS, onEvent, onError } = {}) {
  const queryClient = useQueryClient()
  const handleQueueEvent = useCallback((payload) => {
    if (payload?.queueId && queueId && payload.queueId !== queueId) return

    invalidateQueueQueries(queryClient, payload?.queueId || queueId)
    onEvent?.(payload)
  }, [onEvent, queryClient, queueId])

  const handleSocketError = useCallback((payload) => {
    onError?.(payload)
  }, [onError])

  const handleSocketDisconnect = useCallback(() => {
    onError?.({ message: 'Live updates disconnected. Reconnecting...' })
  }, [onError])

  const handleSocketConnect = useCallback(() => {
    onEvent?.({ event: 'socket:connected', queueId })
  }, [onEvent, queueId])

  useEffect(() => {
    if (!queueId) return undefined

    joinQueueRoom(queueId, (response) => {
      if (response && !response.success) {
        onError?.(response)
      }
    })

    const cleanupEvents = events.map((eventName) => onSocketEvent(eventName, handleQueueEvent))
    const cleanupError = onSocketEvent(QUEUE_SOCKET_EVENTS.ERROR, handleSocketError)
    const cleanupDisconnect = onSocketEvent('disconnect', handleSocketDisconnect)
    const cleanupConnect = onSocketEvent('connect', handleSocketConnect)

    return () => {
      cleanupEvents.forEach((cleanup) => cleanup())
      cleanupError()
      cleanupDisconnect()
      cleanupConnect()
      leaveQueueRoom(queueId)
    }
  }, [events, handleQueueEvent, handleSocketConnect, handleSocketDisconnect, handleSocketError, onError, queueId])
}

function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('ql_token'))
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('ql_user')
    return saved ? JSON.parse(saved) : null
  })

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password })
    localStorage.setItem('ql_token', data.token)
    localStorage.setItem('ql_user', JSON.stringify(data.user))
    setToken(data.token)
    setUser(data.user)
    return data.user
  }

  const logout = () => {
    localStorage.removeItem('ql_token')
    localStorage.removeItem('ql_user')
    disconnectSocket()
    setToken(null)
    setUser(null)
    queryClient.clear()
  }

  const value = useMemo(() => ({ token, user, login, logout }), [token, user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

const useAuth = () => useContext(AuthContext)

function Button({ children, variant = 'primary', type = 'button', className = '', ...props }) {
  return (
    <button type={type} className={`button ${variant} ${className}`.trim()} {...props}>
      {children}
    </button>
  )
}

function Loading({ label = 'Loading...' }) {
  return <div className="state loading-state">{label}</div>
}

function ErrorMessage({ error }) {
  if (!error) return null
  return <div className="error">{getMessage(error)}</div>
}

function StatusBadge({ value, tone }) {
  const normalized = String(value || 'UNKNOWN').toLowerCase().replaceAll('_', '-')
  return <span className={`badge ${tone || normalized}`}>{value || 'Unknown'}</span>
}

const getId = (value) => value?._id || value

const formatDateTime = (value) => {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

const formatTokenDisplay = (entry) => entry?.tokenLabel || (entry?.tokenNumber ? `A-${String(entry.tokenNumber).padStart(3, '0')}` : '-')

const formatWaitingDuration = (value) => {
  if (!value) return '-'
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
  if (minutes < 1) return 'Waiting <1 min'
  return `Waiting ${minutes} min`
}

function Modal({ title, children, onCancel, onConfirm, confirmLabel, isPending }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title">{title}</h2>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">
          <Button variant="secondary" onClick={onCancel} disabled={isPending}>Cancel</Button>
          <Button onClick={onConfirm} disabled={isPending}>{isPending ? 'Working...' : confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}

function LoginPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const mutation = useMutation({
    mutationFn: () => auth.login(email, password),
    onSuccess: (user) => {
      const target = location.state?.from?.pathname || (user.role === 'STAFF' || user.role === 'ADMIN' ? '/staff' : '/')
      navigate(target, { replace: true })
    },
  })

  return (
    <main className="auth-page">
      <section className="login-panel">
        <h1>QueueLess</h1>
        <p>Sign in to manage your queue without the crowd.</p>
        <form onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>
          <label>
            Password
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
          </label>
          <ErrorMessage error={mutation.error} />
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Signing in...' : 'Sign in'}</Button>
        </form>
      </section>
    </main>
  )
}

function ProtectedRoute({ children, roles }) {
  const { token, user } = useAuth()
  const location = useLocation()

  if (!token) return <Navigate to="/login" state={{ from: location }} replace />
  if (roles && !roles.includes(user?.role)) return <Navigate to="/" replace />
  return children
}

function AppShell({ children }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const showAdminSidebar = user?.role === 'ADMIN' && (location.pathname === '/staff' || location.pathname.startsWith('/admin'))
  return (
    <div className={`app-shell ${showAdminSidebar ? 'admin-shell' : ''}`}>
      <header className="topbar">
        <Link className="brand" to="/">
          <span className="brand-mark">QL</span>
          <span>QueueLess</span>
        </Link>
        <nav>
          <Link to="/">Customer</Link>
          {(user?.role === 'STAFF' || user?.role === 'ADMIN') && <Link to="/staff">Staff</Link>}
          {user?.role === 'ADMIN' && <Link to="/admin/queues">Admin</Link>}
          <span className="user-chip">{user?.name}</span>
          <Button variant="ghost" onClick={logout}>Logout</Button>
        </nav>
      </header>
      <div className="shell-body">
        {showAdminSidebar && (
          <aside className="sidebar" aria-label="Admin navigation">
            <div className="sidebar-section">
              <Link className={`sidebar-link ${location.pathname === '/staff' ? 'active' : ''}`} to="/staff">Dashboard</Link>
              <span className="sidebar-link">Organizations</span>
              <span className="sidebar-link">Branches</span>
              <span className="sidebar-link">Services</span>
              <span className="sidebar-link">Counters</span>
              <Link className={`sidebar-link ${location.pathname === '/admin/queues' ? 'active' : ''}`} to="/admin/queues">Queues</Link>
              <span className="sidebar-link">Analytics</span>
            </div>
          </aside>
        )}
        <div className="shell-main">{children}</div>
      </div>
    </div>
  )
}

function BranchCard({ branch, selected, onSelect }) {
  return (
    <button className={`select-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <span className="card-kicker">Branch</span>
      <strong>{branch.name}</strong>
      <span>{branch.city}, {branch.state}</span>
      <small>{branch.address}</small>
    </button>
  )
}

function ServiceCard({ service, queue, selected, onSelect }) {
  const isOpen = queue?.status === 'OPEN'
  return (
    <button className={`select-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <span className="card-kicker">Service</span>
      <strong>{service.name}</strong>
      <span>{service.estimatedServiceTime} min average</span>
      <StatusBadge value={queue ? queue.status : 'Unavailable'} tone={isOpen ? 'open' : 'muted'} />
    </button>
  )
}

function QueueCard({ queue, status, active, onSelect }) {
  return (
    <button className={`queue-card ${active ? 'selected' : ''}`} onClick={onSelect}>
      <strong>{queue.service?.name || 'Service queue'}</strong>
      <span>{queue.branch?.name}</span>
      <div className="metric-row">
        <StatusBadge value={queue.status} />
        <small>{status?.waitingCount ?? '-'} waiting</small>
      </div>
    </button>
  )
}

function QueueStatus({ status, position }) {
  if (!status) return <div className="state empty-state">Select an open queue to see live status.</div>

  const entry = position?.entry

  return (
    <section className={`queue-status-card ${entry ? 'personal' : ''}`}>
      <div className="queue-status-main">
        <span>{entry ? 'Your Token' : 'Current Token'}</span>
        <strong>{entry ? formatTokenDisplay(entry) : status.currentToken || '-'}</strong>
        <StatusBadge value={entry?.status || status.queue.status} />
      </div>
      <div className="status-grid">
        <div><span>People Ahead</span><strong>{position?.peopleAhead ?? status.waitingCount}</strong></div>
        <div><span>Estimated Wait</span><strong>{position?.estimatedWaitTime != null ? `${position.estimatedWaitTime} min` : '-'}</strong></div>
        <div><span>Current Token</span><strong>{status.currentToken || '-'}</strong></div>
        <div><span>Total Served</span><strong>{status.totalServed}</strong></div>
        {entry && <div className="wide"><span>Joined</span><strong>{new Date(entry.joinedAt).toLocaleString()}</strong></div>}
      </div>
    </section>
  )
}

function CustomerDashboard() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [organizationId, setOrganizationId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [modal, setModal] = useState(null)
  const [socketError, setSocketError] = useState('')

  const organizations = useQuery({ queryKey: ['organizations'], queryFn: () => api.get('/organizations') })
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api.get('/branches') })
  const services = useQuery({ queryKey: ['services'], queryFn: () => api.get('/services') })
  const activeEntry = useQuery({ queryKey: ['queues', 'my-active'], queryFn: () => api.get('/queues/my-active'), retry: false })
  const queues = useQuery({
    queryKey: ['queues', branchId, serviceId],
    queryFn: () => api.get(`/queues?${new URLSearchParams({ ...(branchId ? { branch: branchId } : {}), ...(serviceId ? { service: serviceId } : {}) })}`),
    enabled: Boolean(branchId),
  })

  const filteredBranches = (branches.data?.branches || []).filter((branch) => !organizationId || getId(branch.organization) === organizationId)
  const branchServices = (services.data?.services || []).filter((service) => service.branch?._id === branchId || service.branch === branchId)
  const selectedQueue = (queues.data?.queues || []).find((queue) => queue.service?._id === serviceId || queue.service === serviceId)
  const queueId = selectedQueue?._id
  const clearSocketError = useCallback(() => setSocketError(''), [])
  const showSocketError = useCallback((payload) => {
    setSocketError(payload?.message || 'Live updates are temporarily unavailable.')
  }, [])

  const queueStatus = useQuery({
    queryKey: ['queue-status', queueId],
    queryFn: () => api.get(`/queues/${queueId}/status`),
    enabled: Boolean(queueId),
  })
  const myPosition = useQuery({
    queryKey: ['my-position', queueId],
    queryFn: () => api.get(`/queues/${queueId}/my-position`),
    enabled: Boolean(queueId),
    retry: false,
  })

  useQueueRealtime(queueId, {
    onEvent: clearSocketError,
    onError: showSocketError,
  })

  const invalidateQueue = () => {
    queryClient.invalidateQueries({ queryKey: ['queues'] })
    queryClient.invalidateQueries({ queryKey: ['queue-status', queueId] })
    queryClient.invalidateQueries({ queryKey: ['my-position', queueId] })
  }
  const joinMutation = useMutation({
    mutationFn: () => api.post(`/queues/${queueId}/join`),
    onSuccess: () => {
      invalidateQueue()
      queryClient.invalidateQueries({ queryKey: ['queues', 'my-active'] })
      setModal(null)
      navigate(`/queues/${queueId}/status`)
    },
  })
  const leaveMutation = useMutation({ mutationFn: () => api.delete(`/queues/${queueId}/leave`), onSuccess: invalidateQueue })

  return (
    <AppShell>
      <main className="page">
        <section className="page-heading">
          <div>
            <span className="eyebrow">Welcome back</span>
            <h1>Find the shortest path to your turn.</h1>
            <p>Pick a nearby branch and service, then join the live queue without waiting in the room.</p>
          </div>
        </section>

        <section className="layout two customer-intro">
          <div className="panel">
            <h2>Choose organization</h2>
            {organizations.isLoading && <Loading />}
            <ErrorMessage error={organizations.error} />
            <div className="list">
              {(organizations.data?.organizations || []).map((org) => (
                <button
                  className={`info-row selectable-row ${organizationId === org._id ? 'selected' : ''}`}
                  key={org._id}
                  onClick={() => {
                    setOrganizationId(org._id)
                    setBranchId('')
                    setServiceId('')
                  }}
                >
                  <strong>{org.name}</strong>
                  <span>{org.description}</span>
                </button>
              ))}
              {organizations.data?.organizations?.length === 0 && <div className="state">No organizations yet.</div>}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>Choose branch</h2>
              {activeEntry.data?.entry && (
                <Button variant="secondary" onClick={() => navigate(`/queues/${activeEntry.data.queue._id}/status`)}>
                  View active queue
                </Button>
              )}
            </div>
            {!organizationId && <div className="state">Select an organization first.</div>}
            {branches.isLoading && <Loading />}
            <ErrorMessage error={branches.error} />
            <div className="card-grid">
              {organizationId && filteredBranches.map((branch) => (
                <BranchCard
                  key={branch._id}
                  branch={branch}
                  selected={branchId === branch._id}
                  onSelect={() => { setBranchId(branch._id); setServiceId('') }}
                />
              ))}
            </div>
            {organizationId && filteredBranches.length === 0 && <div className="state empty-state">No branches found for this organization.</div>}
          </div>
        </section>

        <section className="layout two">
          <div className="panel">
            <h2>Services</h2>
            {!branchId && <div className="state">Select a branch first.</div>}
            {branchId && branchServices.length === 0 && <div className="state">No services for this branch.</div>}
            <div className="card-grid">
              {branchServices.map((service) => {
                const serviceQueue = (queues.data?.queues || []).find((queue) => queue.service?._id === service._id || queue.service === service._id)
                return (
                  <ServiceCard
                    key={service._id}
                    service={service}
                    queue={serviceQueue}
                    selected={serviceId === service._id}
                    onSelect={() => setServiceId(service._id)}
                  />
                )
              })}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>Current queue status</h2>
              <div className="actions">
                <Button disabled={!queueId || selectedQueue?.status !== 'OPEN'} onClick={() => setModal('join')}>Join</Button>
                <Button variant="secondary" disabled={myPosition.data?.entry?.status !== 'WAITING'} onClick={() => setModal('leave')}>Leave</Button>
              </div>
            </div>
            <ErrorMessage error={queues.error || queueStatus.error} />
            {socketError && <div className="notice">{socketError}</div>}
            {myPosition.error && queueId && <div className="notice">You are not currently active in this queue.</div>}
            <QueueStatus status={queueStatus.data} position={myPosition.data} />
          </div>
        </section>
      </main>

      {modal === 'join' && (
        <Modal
          title="Join this queue?"
          confirmLabel="Join queue"
          isPending={joinMutation.isPending}
          onCancel={() => setModal(null)}
          onConfirm={() => joinMutation.mutate()}
        >
          <p>You will receive the next token for {selectedQueue?.service?.name}.</p>
          <ErrorMessage error={joinMutation.error} />
        </Modal>
      )}
      {modal === 'leave' && (
        <Modal
          title="Leave queue?"
          confirmLabel="Leave queue"
          isPending={leaveMutation.isPending}
          onCancel={() => setModal(null)}
          onConfirm={() => leaveMutation.mutate(undefined, { onSuccess: () => setModal(null) })}
        >
          <p>Your token will be cancelled. You can only leave while waiting.</p>
          <ErrorMessage error={leaveMutation.error} />
        </Modal>
      )}
    </AppShell>
  )
}

function CustomerQueueStatusPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { queueId } = useParams()
  const [socketError, setSocketError] = useState('')
  const clearSocketError = useCallback(() => setSocketError(''), [])
  const showSocketError = useCallback((payload) => {
    setSocketError(payload?.message || 'Live updates are temporarily unavailable.')
  }, [])

  const queueStatus = useQuery({
    queryKey: ['queue-status', queueId],
    queryFn: () => api.get(`/queues/${queueId}/status`),
    enabled: Boolean(queueId),
  })
  const myPosition = useQuery({
    queryKey: ['my-position', queueId],
    queryFn: () => api.get(`/queues/${queueId}/my-position`),
    enabled: Boolean(queueId),
    retry: false,
  })

  useQueueRealtime(queueId, {
    events: CUSTOMER_STATUS_REALTIME_EVENTS,
    onEvent: clearSocketError,
    onError: showSocketError,
  })

  const leaveQueue = useMutation({
    mutationFn: () => api.delete(`/queues/${queueId}/leave`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queues'] })
      queryClient.invalidateQueries({ queryKey: ['queue-status', queueId] })
      queryClient.invalidateQueries({ queryKey: ['my-position', queueId] })
      queryClient.invalidateQueries({ queryKey: ['queues', 'my-active'] })
      navigate('/')
    },
  })

  const entry = myPosition.data?.entry

  return (
    <AppShell>
      <main className="page queue-status-page">
        <section className="page-heading">
          <div>
            <span className="eyebrow">Queue Status</span>
            <h1>{queueStatus.data?.queue?.service?.name || 'Your Queue'}</h1>
            <p>{queueStatus.data?.queue?.branch?.name || 'Track your live queue position and estimated wait.'}</p>
          </div>
          <div className="actions">
            <Button variant="secondary" onClick={() => navigate('/')}>Browse queues</Button>
            <Button variant="danger" disabled={!entry || entry.status !== 'WAITING' || leaveQueue.isPending} onClick={() => leaveQueue.mutate()}>
              {leaveQueue.isPending ? 'Leaving...' : 'Leave queue'}
            </Button>
          </div>
        </section>

        {(queueStatus.isLoading || myPosition.isLoading) && <Loading />}
        <ErrorMessage error={queueStatus.error || myPosition.error || leaveQueue.error} />
        {socketError && <div className="notice">{socketError}</div>}
        {!myPosition.isLoading && !entry && !myPosition.error && <div className="state empty-state">You do not have an active entry in this queue.</div>}

        {entry && queueStatus.data && (
          <section className="customer-token-card">
            <span>Your Token</span>
            <strong>{formatTokenDisplay(entry)}</strong>
            <div className="customer-token-metrics">
              <div><span>People Ahead</span><strong>{myPosition.data.peopleAhead}</strong></div>
              <div><span>Estimated Wait</span><strong>{myPosition.data.estimatedWaitTime} min</strong></div>
              <div><span>Status</span><StatusBadge value={entry.status} /></div>
              <div><span>Joined</span><strong>{formatDateTime(entry.joinedAt)}</strong></div>
            </div>
          </section>
        )}
      </main>
    </AppShell>
  )
}

function StaffQueuePanel({ queue, selected, onSelect }) {
  useQueueRealtime(queue._id)
  const status = useQuery({
    queryKey: ['queue-status', queue._id],
    queryFn: () => api.get(`/queues/${queue._id}/status`),
  })
  return <QueueCard queue={queue} status={status.data} active={selected} onSelect={onSelect} />
}

function StaffDashboard() {
  const queryClient = useQueryClient()
  const [queueId, setQueueId] = useState('')
  const [socketError, setSocketError] = useState('')
  const clearSocketError = useCallback(() => setSocketError(''), [])
  const showSocketError = useCallback((payload) => {
    setSocketError(payload?.message || 'Live updates are temporarily unavailable.')
  }, [])
  const queues = useQuery({ queryKey: ['staff-queues'], queryFn: () => api.get('/staff/queues') })
  const selectedQueue = (queues.data?.queues || []).find((queue) => queue._id === queueId)
  const staffQueue = useQuery({
    queryKey: ['staff-queue', queueId],
    queryFn: () => api.get(`/staff/queues/${queueId}`),
    enabled: Boolean(queueId),
  })

  useQueueRealtime(queueId, {
    onEvent: clearSocketError,
    onError: showSocketError,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['staff-queues'] })
    queryClient.invalidateQueries({ queryKey: ['staff-queue', queueId] })
    queryClient.invalidateQueries({ queryKey: ['queue-status'] })
  }
  const staffMutation = useMutation({
    mutationFn: ({ path }) => api.patch(path),
    onSuccess: invalidate,
  })
  const callNext = useMutation({
    mutationFn: () => api.post(`/staff/queues/${queueId}/call-next`),
    onSuccess: invalidate,
  })

  const currentCustomer = staffQueue.data?.currentCustomer
  const waitingCustomers = staffQueue.data?.waitingCustomers || []
  const entryId = currentCustomer?._id
  const action = (path) => staffMutation.mutate({ path })

  return (
    <AppShell>
      <main className="page">
        <section className="page-heading">
          <div>
            <span className="eyebrow">Operations</span>
            <h1>Staff Dashboard</h1>
            <p>Work through active queues one customer at a time.</p>
          </div>
        </section>

        <section className="layout staff">
          <div className="panel">
            <h2>Active Queues</h2>
            {queues.isLoading && <Loading />}
            <ErrorMessage error={queues.error} />
            <div className="queue-list">
              {(queues.data?.queues || []).map((queue) => (
                <StaffQueuePanel key={queue._id} queue={queue} selected={queueId === queue._id} onSelect={() => setQueueId(queue._id)} />
              ))}
              {queues.data?.queues?.length === 0 && <div className="state">No open queues.</div>}
            </div>
          </div>

          <div className="panel work-panel">
            <div className="panel-header">
              <h2>{selectedQueue?.service?.name || 'Select a queue'}</h2>
              <Button className="primary-action" disabled={!queueId || callNext.isPending} onClick={() => callNext.mutate()}>
                {callNext.isPending ? 'Calling...' : 'Call Next'}
              </Button>
            </div>
            <ErrorMessage error={staffQueue.error || callNext.error || staffMutation.error} />
            {socketError && <div className="notice">{socketError}</div>}
            {staffQueue.isLoading && queueId && <Loading />}
            {staffQueue.data && (
              <div className="staff-summary-grid">
                <div><span>Waiting Customers</span><strong>{staffQueue.data.waitingCount}</strong></div>
                <div><span>Current Token</span><strong>{staffQueue.data.currentToken || '-'}</strong></div>
                <div><span>Total Served</span><strong>{staffQueue.data.totalServed}</strong></div>
              </div>
            )}

            <section className="current-entry">
              <div className="section-title">
                <h2>Current Customer</h2>
                {currentCustomer && <StatusBadge value={currentCustomer.status} />}
              </div>
              {!currentCustomer && <div className="state">Call the next waiting customer to begin.</div>}
              {currentCustomer && (
                <>
                  <div className="ticket">
                    <span>Token</span>
                    <strong>{formatTokenDisplay(currentCustomer)}</strong>
                    <small>{currentCustomer.customer?.name || 'Customer'} - {currentCustomer.customer?.email || 'No email'}</small>
                    <small>Called {formatDateTime(currentCustomer.calledAt)}</small>
                  </div>
                  <div className="actions wrap">
                    <Button disabled={!entryId || currentCustomer.status !== 'CALLED'} onClick={() => action(`/staff/entries/${entryId}/in-service`)}>Start Service</Button>
                    <Button disabled={!entryId || currentCustomer.status !== 'IN_SERVICE'} onClick={() => action(`/staff/entries/${entryId}/complete`)}>Complete</Button>
                    <Button variant="secondary" disabled={!entryId || currentCustomer.status !== 'CALLED'} onClick={() => action(`/staff/entries/${entryId}/skip`)}>Skip</Button>
                    <Button variant="danger" disabled={!entryId || currentCustomer.status !== 'CALLED'} onClick={() => action(`/staff/entries/${entryId}/no-show`)}>No-show</Button>
                  </div>
                </>
              )}
            </section>

            <section className="waiting-section">
              <div className="section-title">
                <h2>Waiting Queue</h2>
                {staffQueue.data?.nextWaitingCustomer && <span className="muted-text">Next: {formatTokenDisplay(staffQueue.data.nextWaitingCustomer)}</span>}
              </div>
              {queueId && waitingCustomers.length === 0 && <div className="state empty-state">No customers are waiting.</div>}
              <div className="waiting-list">
                {waitingCustomers.map((entry) => (
                  <div className="waiting-row" key={entry._id}>
                    <strong>{formatTokenDisplay(entry)}</strong>
                    <span>{entry.customer?.name || 'Customer'}</span>
                    <span>{formatWaitingDuration(entry.joinedAt)}</span>
                    <StatusBadge value={entry.priority} tone="muted" />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </main>
    </AppShell>
  )
}

function AdminQueuePage() {
  const queryClient = useQueryClient()
  const [branchId, setBranchId] = useState('')
  const [serviceId, setServiceId] = useState('')

  const queues = useQuery({ queryKey: ['queues', 'admin'], queryFn: () => api.get('/queues') })
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api.get('/branches') })
  const services = useQuery({ queryKey: ['services'], queryFn: () => api.get('/services') })

  const allQueues = queues.data?.queues || []
  const allBranches = branches.data?.branches || []
  const branchServices = (services.data?.services || []).filter((service) => getId(service.branch) === branchId)

  const invalidateQueues = () => {
    queryClient.invalidateQueries({ queryKey: ['queues'] })
    queryClient.invalidateQueries({ queryKey: ['queue-status'] })
  }

  const createQueue = useMutation({
    mutationFn: () => api.post('/queues', { branch: branchId, service: serviceId }),
    onSuccess: () => {
      setServiceId('')
      invalidateQueues()
    },
  })
  const openQueue = useMutation({ mutationFn: (id) => api.patch(`/queues/${id}/open`), onSuccess: invalidateQueues })
  const closeQueue = useMutation({ mutationFn: (id) => api.patch(`/queues/${id}/close`), onSuccess: invalidateQueues })
  const deleteQueue = useMutation({ mutationFn: (id) => api.delete(`/queues/${id}`), onSuccess: invalidateQueues })

  const pendingError = createQueue.error || openQueue.error || closeQueue.error || deleteQueue.error

  return (
    <AppShell>
      <main className="page">
        <section className="page-heading">
          <div>
            <span className="eyebrow">Admin</span>
            <h1>Queue Management</h1>
            <p>Create queues for branch services, then open, close, and retire them as daily operations change.</p>
          </div>
        </section>

        <section className="layout admin-queues">
          <div className="panel">
            <h2>Create queue</h2>
            <form
              className="queue-form"
              onSubmit={(event) => {
                event.preventDefault()
                createQueue.mutate()
              }}
            >
              <label>
                Branch
                <select
                  value={branchId}
                  onChange={(event) => {
                    setBranchId(event.target.value)
                    setServiceId('')
                  }}
                  required
                >
                  <option value="">Select branch</option>
                  {allBranches.map((branch) => (
                    <option key={branch._id} value={branch._id}>
                      {branch.name} - {branch.city}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Service
                <select value={serviceId} onChange={(event) => setServiceId(event.target.value)} disabled={!branchId} required>
                  <option value="">Select service</option>
                  {branchServices.map((service) => (
                    <option key={service._id} value={service._id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </label>
              {branchId && branchServices.length === 0 && <div className="notice">No services belong to this branch.</div>}
              <Button type="submit" disabled={!branchId || !serviceId || createQueue.isPending}>
                {createQueue.isPending ? 'Creating...' : 'Create queue'}
              </Button>
            </form>
          </div>

          <div className="panel queue-summary-panel">
            <h2>Queue overview</h2>
            <div className="summary-grid">
              <div><span>Total</span><strong>{allQueues.length}</strong></div>
              <div><span>Open</span><strong>{allQueues.filter((queue) => queue.status === 'OPEN').length}</strong></div>
              <div><span>Closed</span><strong>{allQueues.filter((queue) => queue.status === 'CLOSED').length}</strong></div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>All queues</h2>
            {queues.isFetching && <span className="muted-text">Refreshing...</span>}
          </div>
          {(queues.isLoading || branches.isLoading || services.isLoading) && <Loading />}
          <ErrorMessage error={queues.error || branches.error || services.error || pendingError} />
          {!queues.isLoading && allQueues.length === 0 && <div className="state empty-state">No queues have been created yet.</div>}
          {allQueues.length > 0 && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th>Branch</th>
                    <th>Service</th>
                    <th>Status</th>
                    <th>Current token</th>
                    <th>Total served</th>
                    <th>Opened</th>
                    <th>Closed</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allQueues.map((queue) => (
                    <tr key={queue._id}>
                      <td data-label="Organization">{queue.branch?.organization?.name || '-'}</td>
                      <td data-label="Branch">{queue.branch?.name || '-'}</td>
                      <td data-label="Service">{queue.service?.name || '-'}</td>
                      <td data-label="Status"><StatusBadge value={queue.status} /></td>
                      <td data-label="Current token">{queue.currentToken}</td>
                      <td data-label="Total served">{queue.totalServed}</td>
                      <td data-label="Opened">{formatDateTime(queue.openedAt)}</td>
                      <td data-label="Closed">{formatDateTime(queue.closedAt)}</td>
                      <td data-label="Actions">
                        <div className="table-actions">
                          <Button
                            variant="secondary"
                            disabled={queue.status === 'OPEN' || openQueue.isPending}
                            onClick={() => openQueue.mutate(queue._id)}
                          >
                            Open
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={queue.status === 'CLOSED' || closeQueue.isPending}
                            onClick={() => closeQueue.mutate(queue._id)}
                          >
                            Close
                          </Button>
                          <Button
                            variant="danger"
                            disabled={queue.status === 'OPEN' || deleteQueue.isPending}
                            onClick={() => deleteQueue.mutate(queue._id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </AppShell>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><CustomerDashboard /></ProtectedRoute>} />
      <Route path="/queues/:queueId/status" element={<ProtectedRoute roles={['CUSTOMER']}><CustomerQueueStatusPage /></ProtectedRoute>} />
      <Route path="/staff" element={<ProtectedRoute roles={['STAFF', 'ADMIN']}><StaffDashboard /></ProtectedRoute>} />
      <Route path="/admin/queues" element={<ProtectedRoute roles={['ADMIN']}><AdminQueuePage /></ProtectedRoute>} />
    </Routes>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
