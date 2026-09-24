import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useMemo, useState } from 'react'
import { Link, Navigate, Route, BrowserRouter as Router, Routes, useLocation, useNavigate } from 'react-router-dom'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api'
const queryClient = new QueryClient()
const AuthContext = createContext(null)

const getMessage = (error) => error?.message || 'Something went wrong'

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
    setToken(null)
    setUser(null)
    queryClient.clear()
  }

  const value = useMemo(() => ({ token, user, login, logout }), [token, user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

const useAuth = () => useContext(AuthContext)

function Button({ children, variant = 'primary', type = 'button', ...props }) {
  return (
    <button type={type} className={`button ${variant}`} {...props}>
      {children}
    </button>
  )
}

function Loading({ label = 'Loading...' }) {
  return <div className="state">{label}</div>
}

function ErrorMessage({ error }) {
  if (!error) return null
  return <div className="error">{getMessage(error)}</div>
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
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/">QueueLess</Link>
        <nav>
          <Link to="/">Customer</Link>
          {(user?.role === 'STAFF' || user?.role === 'ADMIN') && <Link to="/staff">Staff</Link>}
          <span>{user?.name}</span>
          <Button variant="ghost" onClick={logout}>Logout</Button>
        </nav>
      </header>
      {children}
    </div>
  )
}

function BranchCard({ branch, selected, onSelect }) {
  return (
    <button className={`select-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
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
      <strong>{service.name}</strong>
      <span>{service.estimatedServiceTime} min average</span>
      <small className={isOpen ? 'good' : 'muted'}>{queue ? `Queue ${queue.status}` : 'No queue available'}</small>
    </button>
  )
}

function QueueCard({ queue, status, active, onSelect }) {
  return (
    <button className={`queue-card ${active ? 'selected' : ''}`} onClick={onSelect}>
      <strong>{queue.service?.name || 'Service queue'}</strong>
      <span>{queue.branch?.name}</span>
      <div className="metric-row">
        <small>{queue.status}</small>
        <small>{status?.waitingCount ?? '-'} waiting</small>
      </div>
    </button>
  )
}

function QueueStatus({ status, position }) {
  if (!status) return <div className="state">Select an open queue to see live status.</div>
  return (
    <div className="status-grid">
      <div><span>Queue</span><strong>{status.queue.status}</strong></div>
      <div><span>Waiting</span><strong>{status.waitingCount}</strong></div>
      <div><span>Current token</span><strong>{status.currentToken || '-'}</strong></div>
      <div><span>Total served</span><strong>{status.totalServed}</strong></div>
      {position?.entry && (
        <>
          <div><span>Your token</span><strong>{position.entry.tokenNumber}</strong></div>
          <div><span>Your status</span><strong>{position.entry.status}</strong></div>
          <div><span>People ahead</span><strong>{position.peopleAhead}</strong></div>
          <div><span>ETA</span><strong>{position.estimatedWaitTime} min</strong></div>
          <div className="wide"><span>Joined</span><strong>{new Date(position.entry.joinedAt).toLocaleString()}</strong></div>
        </>
      )}
    </div>
  )
}

function CustomerDashboard() {
  const queryClient = useQueryClient()
  const [branchId, setBranchId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [modal, setModal] = useState(null)

  const organizations = useQuery({ queryKey: ['organizations'], queryFn: () => api.get('/organizations') })
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api.get('/branches') })
  const services = useQuery({ queryKey: ['services'], queryFn: () => api.get('/services') })
  const queues = useQuery({
    queryKey: ['queues', branchId, serviceId],
    queryFn: () => api.get(`/queues?${new URLSearchParams({ ...(branchId ? { branch: branchId } : {}), ...(serviceId ? { service: serviceId } : {}) })}`),
    enabled: Boolean(branchId),
  })

  const branchServices = (services.data?.services || []).filter((service) => service.branch?._id === branchId || service.branch === branchId)
  const selectedQueue = (queues.data?.queues || []).find((queue) => queue.service?._id === serviceId || queue.service === serviceId)
  const queueId = selectedQueue?._id

  const queueStatus = useQuery({
    queryKey: ['queue-status', queueId],
    queryFn: () => api.get(`/queues/${queueId}/status`),
    enabled: Boolean(queueId),
    refetchInterval: 5000,
  })
  const myPosition = useQuery({
    queryKey: ['my-position', queueId],
    queryFn: () => api.get(`/queues/${queueId}/my-position`),
    enabled: Boolean(queueId),
    refetchInterval: 5000,
    retry: false,
  })

  const invalidateQueue = () => {
    queryClient.invalidateQueries({ queryKey: ['queues'] })
    queryClient.invalidateQueries({ queryKey: ['queue-status', queueId] })
    queryClient.invalidateQueries({ queryKey: ['my-position', queueId] })
  }
  const joinMutation = useMutation({ mutationFn: () => api.post(`/queues/${queueId}/join`), onSuccess: invalidateQueue })
  const leaveMutation = useMutation({ mutationFn: () => api.delete(`/queues/${queueId}/leave`), onSuccess: invalidateQueue })

  return (
    <AppShell>
      <main className="page">
        <section className="page-heading">
          <div>
            <h1>Customer Dashboard</h1>
            <p>Pick a branch and service, then join the live queue.</p>
          </div>
        </section>

        <section className="layout two">
          <div className="panel">
            <h2>Organizations</h2>
            {organizations.isLoading && <Loading />}
            <ErrorMessage error={organizations.error} />
            <div className="list">
              {(organizations.data?.organizations || []).map((org) => (
                <div className="info-row" key={org._id}>
                  <strong>{org.name}</strong>
                  <span>{org.description}</span>
                </div>
              ))}
              {organizations.data?.organizations?.length === 0 && <div className="state">No organizations yet.</div>}
            </div>
          </div>

          <div className="panel">
            <h2>Branches</h2>
            {branches.isLoading && <Loading />}
            <ErrorMessage error={branches.error} />
            <div className="card-grid">
              {(branches.data?.branches || []).map((branch) => (
                <BranchCard
                  key={branch._id}
                  branch={branch}
                  selected={branchId === branch._id}
                  onSelect={() => { setBranchId(branch._id); setServiceId('') }}
                />
              ))}
            </div>
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
              <h2>My Queue</h2>
              <div className="actions">
                <Button disabled={!queueId || selectedQueue?.status !== 'OPEN'} onClick={() => setModal('join')}>Join</Button>
                <Button variant="secondary" disabled={myPosition.data?.entry?.status !== 'WAITING'} onClick={() => setModal('leave')}>Leave</Button>
              </div>
            </div>
            <ErrorMessage error={queues.error || queueStatus.error} />
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
          onConfirm={() => joinMutation.mutate(undefined, { onSuccess: () => setModal(null) })}
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

function StaffQueuePanel({ queue, selected, onSelect }) {
  const status = useQuery({
    queryKey: ['queue-status', queue._id],
    queryFn: () => api.get(`/queues/${queue._id}/status`),
    refetchInterval: 5000,
  })
  return <QueueCard queue={queue} status={status.data} active={selected} onSelect={onSelect} />
}

function StaffDashboard() {
  const queryClient = useQueryClient()
  const [queueId, setQueueId] = useState('')
  const [activeEntry, setActiveEntry] = useState(null)
  const queues = useQuery({ queryKey: ['queues', 'staff'], queryFn: () => api.get('/queues?status=OPEN'), refetchInterval: 5000 })
  const selectedQueue = (queues.data?.queues || []).find((queue) => queue._id === queueId)
  const queueStatus = useQuery({
    queryKey: ['queue-status', queueId],
    queryFn: () => api.get(`/queues/${queueId}/status`),
    enabled: Boolean(queueId),
    refetchInterval: 5000,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['queue-status'] })
    queryClient.invalidateQueries({ queryKey: ['queues'] })
  }
  const staffMutation = useMutation({
    mutationFn: ({ path }) => api.patch(path),
    onSuccess: (data) => {
      setActiveEntry(data.entry)
      invalidate()
    },
  })
  const callNext = useMutation({
    mutationFn: () => api.post(`/staff/queues/${queueId}/call-next`),
    onSuccess: (data) => {
      setActiveEntry(data.entry)
      invalidate()
    },
  })

  const entryId = activeEntry?._id
  const action = (path) => staffMutation.mutate({ path })

  return (
    <AppShell>
      <main className="page">
        <section className="page-heading">
          <div>
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
                <StaffQueuePanel key={queue._id} queue={queue} selected={queueId === queue._id} onSelect={() => { setQueueId(queue._id); setActiveEntry(null) }} />
              ))}
              {queues.data?.queues?.length === 0 && <div className="state">No open queues.</div>}
            </div>
          </div>

          <div className="panel work-panel">
            <div className="panel-header">
              <h2>{selectedQueue?.service?.name || 'Select a queue'}</h2>
              <Button disabled={!queueId || callNext.isPending} onClick={() => callNext.mutate()}>
                {callNext.isPending ? 'Calling...' : 'Call next'}
              </Button>
            </div>
            <ErrorMessage error={queueStatus.error || callNext.error || staffMutation.error} />
            <QueueStatus status={queueStatus.data} />
            <div className="current-entry">
              <h2>Currently serving</h2>
              {!activeEntry && <div className="state">Call the next customer to begin.</div>}
              {activeEntry && (
                <>
                  <div className="ticket">
                    <span>Token</span>
                    <strong>{activeEntry.tokenNumber}</strong>
                    <small>{activeEntry.status}</small>
                    {activeEntry.customer && <small>{activeEntry.customer.name} - {activeEntry.customer.email}</small>}
                  </div>
                  <div className="actions wrap">
                    <Button disabled={!entryId || activeEntry.status !== 'CALLED'} onClick={() => action(`/staff/entries/${entryId}/in-service`)}>In service</Button>
                    <Button disabled={!entryId || activeEntry.status !== 'IN_SERVICE'} onClick={() => action(`/staff/entries/${entryId}/complete`)}>Complete</Button>
                    <Button variant="secondary" disabled={!entryId || activeEntry.status !== 'CALLED'} onClick={() => action(`/staff/entries/${entryId}/skip`)}>Skip</Button>
                    <Button variant="danger" disabled={!entryId || activeEntry.status !== 'CALLED'} onClick={() => action(`/staff/entries/${entryId}/no-show`)}>No-show</Button>
                  </div>
                </>
              )}
            </div>
          </div>
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
      <Route path="/staff" element={<ProtectedRoute roles={['STAFF', 'ADMIN']}><StaffDashboard /></ProtectedRoute>} />
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
