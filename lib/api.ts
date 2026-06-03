const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function getToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

export function decodeToken(token: string): { sub: string; role: string; exp: number } | null {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

export function getCurrentUser() {
  const token = getToken()
  if (!token) return null
  const user = decodeToken(token)
  // If token is expired, clear it and treat as logged out
  if (user && user.exp * 1000 < Date.now()) {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('userId')
    return null
  }
  return user
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (res.status === 401 && path !== '/api/auth/login') {
    // Token expired or invalid — clear session and redirect to login
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
      localStorage.removeItem('role')
      localStorage.removeItem('userId')
      window.location.href = '/login'
    }
    throw new Error('Session expired. Please log in again.')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }))
    const detail = err.detail
    // FastAPI validation errors return detail as an array of objects
    const message = Array.isArray(detail)
      ? detail.map((d: { msg?: string; loc?: string[] }) => `${d.loc?.slice(-1)[0] ?? 'field'}: ${d.msg ?? 'invalid'}`).join(', ')
      : typeof detail === 'string'
        ? detail
        : 'Request failed'
    throw new Error(message)
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Server returned an unexpected response. Please try again.`)
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export const auth = {
  // identifier = matric number (student) or staff email (lecturer)
  login: (identifier: string, password: string) =>
    request<{ access_token: string; token_type: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),

  register: (
    name: string,
    email: string,
    password: string,
    role: string,
    department?: string,
    level?: string,
    matric_number?: string,
    staff_number?: string,
  ) =>
    request<{ message: string; email: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role, department, level, matric_number, staff_number }),
    }),

  verifyEmail: (email: string, code: string) =>
    request('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),

  resendCode: (email: string) =>
    request<{ message: string }>('/api/auth/resend-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  forgotLookup: (params: { matric_number?: string; staff_number?: string }) =>
    request<{ name: string; masked_email: string; role: string }>(
      '/api/auth/forgot-password/lookup',
      { method: 'POST', body: JSON.stringify(params) },
    ),

  forgotSendCode: (params: { email: string; matric_number?: string; staff_number?: string }) =>
    request<{ message: string; email: string }>(
      '/api/auth/forgot-password/send-code',
      { method: 'POST', body: JSON.stringify(params) },
    ),

  forgotReset: (email: string, code: string, password: string) =>
    request<{ message: string }>(
      '/api/auth/forgot-password/reset',
      { method: 'POST', body: JSON.stringify({ email, code, password }) },
    ),
}

// ── Analytics ────────────────────────────────────────────────────────────────
export interface StudentAnalytics {
  attendance_rate: number
  classes_attended: number
  total_classes: number
  enrolled_courses: number
  assignments_submitted: number
  assignments_graded: number
  average_score: number | null
  exam_results: { exam_id: number; score: number; grade: string }[]
  class_stats: {
    class_id: number
    class_name: string
    subject: string
    course_code: string | null
    attendance_rate: number
    classes_attended: number
    total_classes: number
  }[]
}

export interface LecturerClassStat {
  class_id: number
  class_name: string
  course_code: string | null
  enrollment_count: number
  attendance_rate: number
  live_session_count: number
  live_attendance_rate: number
  assignments_total: number
  assignments_submitted: number
  submission_rate: number
  avg_assignment_score: number | null
  quiz_count: number
  quiz_attempts: number
  quiz_avg_score: number | null
}

export interface LecturerAnalytics {
  total_students: number
  total_classes: number
  total_live_sessions: number
  overall_attendance_rate: number
  pending_grading: number
  classes: LecturerClassStat[]
}

export const analytics = {
  dashboard: () =>
    request<{
      total_students: number
      classes_this_week: number
      pending_assignments: number
      attendance_rate: number
    }>('/api/analytics/dashboard'),
  student: () => request<StudentAnalytics>('/api/analytics/student'),
  lecturer: () => request<LecturerAnalytics>('/api/analytics/lecturer'),
}

// ── Students ─────────────────────────────────────────────────────────────────
export interface Student {
  id: number
  name: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}

export interface StudentInClass {
  id: number
  name: string
  email: string
  matric_number: string | null
  department: string | null
  level: string | null
  roll_number: number
  grade: string | null
  attendance_rate: number | null
}

export interface PagedStudents {
  total: number
  items: Student[]
}

export interface PagedStudentsInClass {
  total: number
  items: StudentInClass[]
}

export interface StudentCourseDetail {
  class_id: number
  class_name: string
  course_code: string | null
  level: string | null
  academic_year: string
  roll_number: number
  grade: string | null
  enrolled_at: string
  att_total: number
  att_present: number
  att_late: number
  att_absent: number
  attendance_rate: number | null
  assignments_total: number
  assignments_submitted: number
  assignments_graded: number
  assignment_avg_score: number | null
  quizzes_total: number
  quizzes_attempted: number
  quiz_avg_score: number | null
}

export interface StudentDetail {
  id: number
  name: string
  email: string
  matric_number: string | null
  department: string | null
  level: string | null
  is_active: boolean
  created_at: string
  courses: StudentCourseDetail[]
}

export const students = {
  list: (params?: { class_id?: number; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams()
    if (params?.class_id) qs.set('class_id', String(params.class_id))
    if (params?.limit !== undefined) qs.set('limit', String(params.limit))
    if (params?.offset !== undefined) qs.set('offset', String(params.offset))
    const q = qs.toString()
    return request<PagedStudents>(`/api/students${q ? `?${q}` : ''}`)
  },
  get: (id: number) => request<Student>(`/api/students/${id}`),
  detail: (id: number) => request<StudentDetail>(`/api/students/${id}/courses`),
  listByClass: (class_id: number, params?: { limit?: number; offset?: number }) => {
    const qs = new URLSearchParams()
    if (params?.limit !== undefined) qs.set('limit', String(params.limit))
    if (params?.offset !== undefined) qs.set('offset', String(params.offset))
    const q = qs.toString()
    return request<PagedStudentsInClass>(`/api/students/class/${class_id}${q ? `?${q}` : ''}`)
  },
}

// ── Classes ───────────────────────────────────────────────────────────────────
export interface Class {
  id: number
  name: string
  subject: string
  course_code: string | null
  department: string | null
  level: string | null
  academic_year: string
  lecturer_id: number
}

export interface ClassAvailable extends Class {
  lecturer_name: string
  is_enrolled: boolean
}

export const classes = {
  list: () => request<Class[]>('/api/classes'),
  get: (id: number) => request<Class>(`/api/classes/${id}`),
  available: () => request<ClassAvailable[]>('/api/classes/available'),
  create: (data: { name: string; subject: string; course_code?: string; department?: string; level: string; academic_year: string }) =>
    request<Class>('/api/classes', { method: 'POST', body: JSON.stringify(data) }),
  enroll: (class_id: number, matric_number: string) =>
    request<{ message: string; class: string; roll_number: number }>(`/api/classes/${class_id}/enroll`, {
      method: 'POST',
      body: JSON.stringify({ matric_number }),
    }),
  unenroll: (class_id: number, matric_number: string) =>
    request(`/api/classes/${class_id}/unenroll?matric_number=${encodeURIComponent(matric_number)}`, { method: 'DELETE' }),
}

// ── Assignments ───────────────────────────────────────────────────────────────
export interface Assignment {
  id: number
  title: string
  description: string | null
  class_id: number
  class_name: string | null
  due_date: string
  created_at: string
  submission_type: string
  total_submissions: number
  pending_count: number
  overdue_count: number
  submitted: boolean | null  // null = lecturer view, true/false = student view
}

export interface RosterEntry {
  student_id: number
  student_name: string
  matric_number: string | null
  submitted: boolean
  submitted_at: string | null
  file_url: string | null
  score: number | null
  feedback: string | null
}

export const SUBMISSION_TYPES = [
  { value: 'google_drive', label: 'Google Drive Link' },
  { value: 'pdf',          label: 'PDF Document' },
  { value: 'word_doc',     label: 'Word Document' },
  { value: 'image',        label: 'Image' },
  { value: 'any',          label: 'Any Format (link)' },
] as const

export const assignments = {
  list: (class_id?: number) =>
    request<Assignment[]>(`/api/assignments${class_id ? `?class_id=${class_id}` : ''}`),
  get: (id: number) => request<Assignment>(`/api/assignments/${id}`),
  create: (data: { title: string; description: string; class_id: number; due_date: string; submission_type: string }) =>
    request<Assignment>('/api/assignments', { method: 'POST', body: JSON.stringify(data) }),
  submit: (assignment_id: number, file_url: string) =>
    request(`/api/assignments/${assignment_id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ assignment_id, file_url }),
    }),
  roster: (assignment_id: number) =>
    request<RosterEntry[]>(`/api/assignments/${assignment_id}/roster`),
  extend: (assignment_id: number, new_due_date: string) =>
    request<Assignment>(`/api/assignments/${assignment_id}/extend`, {
      method: 'PATCH',
      body: JSON.stringify({ new_due_date }),
    }),
}

// ── Attendance ────────────────────────────────────────────────────────────────
export interface AttendanceRecord {
  id: number
  class_id: number
  student_id: number
  date: string
  status: string
}

export interface ManualAttendanceDay {
  date: string
  records: { student_id: number; name: string; status: string }[]
  present_count: number
  late_count: number
  absent_count: number
  total: number
}

export const attendance = {
  forClass: (class_id: number) =>
    request<AttendanceRecord[]>(`/api/attendance/class/${class_id}`),
  studentRate: (student_id: number) =>
    request<{ student_id: number; total_days: number; present: number; rate: number }>(
      `/api/attendance/student/${student_id}/rate`
    ),
  manualHistory: (class_id: number) =>
    request<ManualAttendanceDay[]>(`/api/attendance/class/${class_id}/manual-history`),
}

// ── Schedule ──────────────────────────────────────────────────────────────────
export interface ScheduleItem {
  id: number
  class_id: number
  day_of_week: string
  start_time: string  // "HH:MM:SS"
  end_time: string
  room: string | null
  is_locked: boolean
}

export interface ScheduleEntry {
  id: number
  class_id: number
  class_name: string
  course_code: string | null
  day_of_week: string
  start_time: string  // "HH:MM:SS"
  end_time: string
  room: string | null
  lecturer_name: string | null
  has_conflict: boolean
  is_locked: boolean
}

export interface ScheduleSlotInput {
  day_of_week: string
  start_time: string  // "HH:MM"
  end_time: string
  room?: string
}

export const schedule = {
  list: () => request<ScheduleItem[]>('/api/schedule'),
  today: () => request<ScheduleItem[]>('/api/schedule/today'),
  weekly: () => request<ScheduleEntry[]>('/api/schedule/weekly'),
  bulkCreate: (class_id: number, slots: ScheduleSlotInput[]) =>
    request<ScheduleItem[]>('/api/schedule/bulk', {
      method: 'POST',
      body: JSON.stringify({ class_id, slots }),
    }),
  toggleLock: (id: number) =>
    request<ScheduleItem>(`/api/schedule/${id}/lock`, { method: 'PATCH' }),
  delete: (id: number) => request<void>(`/api/schedule/${id}`, { method: 'DELETE' }),
  sendWeeklyDigest: () =>
    request<{ week_label: string; notifications_sent: number; lectures_created: number }>(
      '/api/schedule/weekly-digest',
      { method: 'POST' },
    ),
}

// ── Lectures ──────────────────────────────────────────────────────────────────
export interface Lecture {
  id: number
  class_id: number
  title: string
  description: string | null
  scheduled_at: string | null
  started_at: string | null
  ended_at: string | null
  status: 'scheduled' | 'live' | 'ended'
  room_link: string | null
  jitsi_room: string | null
  created_at: string
}

export interface ClassStats {
  enrolled_count: number
  assignment_count: number
  live_lecture: Lecture | null
  next_lecture: Lecture | null
}

export interface LectureHistory {
  id: number
  class_id: number
  title: string
  description: string | null
  started_at: string | null
  ended_at: string | null
  duration_str: string | null
  attended_count: number
  total_enrolled: number
  student_attended: boolean | null
}

export const lectures = {
  list: (class_id?: number) =>
    request<Lecture[]>(`/api/lectures${class_id ? `?class_id=${class_id}` : ''}`),
  schedule: (data: { class_id: number; title: string; description?: string; scheduled_at: string }) =>
    request<Lecture>('/api/lectures', { method: 'POST', body: JSON.stringify(data) }),
  instant: (class_id: number, title: string, description: string) =>
    request<Lecture>('/api/lectures/instant', {
      method: 'POST',
      body: JSON.stringify({ class_id, title, description }),
    }),
  start:  (id: number) => request<Lecture>(`/api/lectures/${id}/start`, { method: 'POST' }),
  end:    (id: number) => request<Lecture>(`/api/lectures/${id}/end`,   { method: 'POST' }),
  cancel: (id: number) => request(`/api/lectures/${id}`, { method: 'DELETE' }),
  attend: (id: number) => request(`/api/lectures/${id}/attend`, { method: 'POST' }),
  history: (class_id: number) => request<LectureHistory[]>(`/api/lectures/class/${class_id}/history`),
  classStats: (class_id: number) => request<ClassStats>(`/api/lectures/class/${class_id}/stats`),
  jitsiToken: (id: number) => request<{ token: string; app_id: string; room_name: string }>(`/api/lectures/${id}/token`),
  session: (id: number) => request<{ session_id: number }>(`/api/lectures/${id}/session`),
}

// ── Cookies (live attendance check-ins) ──────────────────────────────────────
export const cookies = {
  click: (cookieId: number) =>
    request<{ ok: boolean; is_valid: boolean; message: string }>(`/api/cookies/${cookieId}/click`, { method: 'POST' }),
}

// ── Live Sessions ─────────────────────────────────────────────────────────────
export interface SessionSummary {
  id: number
  started_at: string
  ended_at: string | null
  total_cookies: number
  duration_mins: number | null
  present_count: number
  partial_count: number
  absent_count: number
  total_students: number
}

export interface AttendanceResult {
  student_id: number
  name: string
  cookies_clicked: number
  total_cookies: number
  score: number
  status: string
}

export interface StudentSessionHistory {
  session_id: number
  class_id: number
  class_name: string
  course_code: string | null
  date: string | null
  started_at: string | null
  ended_at: string | null
  cookies_clicked: number
  total_cookies: number
  score: number | null
  status: string
}

export const sessions = {
  listForClass: (classId: number) =>
    request<SessionSummary[]>(`/api/classes/${classId}/sessions`),
  attendance: (sessionId: number) =>
    request<AttendanceResult[]>(`/api/sessions/${sessionId}/attendance`),
  myHistory: () =>
    request<StudentSessionHistory[]>('/api/sessions/my-history'),
}

// ── Quizzes ───────────────────────────────────────────────────────────────────
export interface Quiz {
  id: number
  class_id: number
  created_by: number
  title: string
  description: string | null
  duration_minutes: number
  available_from: string | null
  available_until: string | null
  is_published: boolean
  created_at: string
  question_count: number
  attempt_count: number
  my_score: number | null
  my_total: number | null
}

export interface QuizQuestion {
  id: number
  quiz_id: number
  text: string
  option_a: string
  option_b: string
  option_c: string | null
  option_d: string | null
  order_index: number
  correct_option: string | null   // null for students
}

export interface QuizAttempt {
  id: number
  quiz_id: number
  student_id: number
  started_at: string
  submitted_at: string | null
  score: number | null
  total: number | null
  answers: string | null   // JSON string
}

export interface QuizResultDetail {
  student_id: number
  student_name: string
  matric_number: string | null
  score: number | null
  total: number | null
  percentage: number | null
  submitted_at: string | null
}

export const quizzes = {
  list: (class_id?: number) =>
    request<Quiz[]>(`/api/quizzes${class_id ? `?class_id=${class_id}` : ''}`),
  get: (id: number) => request<Quiz>(`/api/quizzes/${id}`),
  create: (data: { class_id: number; title: string; description?: string; duration_minutes: number; available_from?: string; available_until?: string }) =>
    request<Quiz>('/api/quizzes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<{ title: string; description: string; duration_minutes: number; available_from: string; available_until: string; is_published: boolean }>) =>
    request<Quiz>(`/api/quizzes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request(`/api/quizzes/${id}`, { method: 'DELETE' }),
  questions: (id: number) =>
    request<QuizQuestion[]>(`/api/quizzes/${id}/questions`),
  addQuestion: (id: number, data: { text: string; option_a: string; option_b: string; option_c?: string; option_d?: string; correct_option: string; order_index?: number }) =>
    request<QuizQuestion>(`/api/quizzes/${id}/questions`, { method: 'POST', body: JSON.stringify(data) }),
  updateQuestion: (quizId: number, qId: number, data: { text: string; option_a: string; option_b: string; option_c?: string; option_d?: string; correct_option: string }) =>
    request<QuizQuestion>(`/api/quizzes/${quizId}/questions/${qId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteQuestion: (quizId: number, qId: number) =>
    request(`/api/quizzes/${quizId}/questions/${qId}`, { method: 'DELETE' }),
  start: (id: number) =>
    request<QuizAttempt>(`/api/quizzes/${id}/start`, { method: 'POST' }),
  submit: (id: number, answers: Record<string, string>) =>
    request<QuizAttempt>(`/api/quizzes/${id}/submit`, { method: 'POST', body: JSON.stringify({ answers }) }),
  myResult: (id: number) =>
    request<QuizAttempt>(`/api/quizzes/${id}/my-result`),
  results: (id: number) =>
    request<QuizResultDetail[]>(`/api/quizzes/${id}/results`),
}

// ── Exams ─────────────────────────────────────────────────────────────────────
export interface Exam {
  id: number
  title: string
  class_id: number
  exam_date: string
  total_marks: number
  created_at: string
}

export interface ExamResult {
  id: number
  exam_id: number
  student_id: number
  score: number
  grade: string
  published: boolean
}

export const exams = {
  list: () => request<Exam[]>('/api/exams'),
}

// ── Notifications ─────────────────────────────────────────────────────────────
export interface Notification {
  id: number
  type: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

export const notifications = {
  list: () => request<Notification[]>('/api/notifications'),
  unreadCount: () => request<{ count: number }>('/api/notifications/unread-count'),
  markRead: (id: number) => request(`/api/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => request('/api/notifications/read-all', { method: 'PATCH' }),
}

// ── Search ────────────────────────────────────────────────────────────────────
export interface SearchResults {
  query: string
  total: number
  students: { id: number; name: string; email: string; matric_number: string | null; department: string | null; type: string; link: string }[]
  classes:  { id: number; name: string; subject: string; course_code: string | null; type: string; link: string }[]
  assignments: { id: number; title: string; due_date: string; type: string; link: string }[]
  exams: { id: number; title: string; exam_date: string; type: string; link: string }[]
}

export const search = (q: string) =>
  request<SearchResults>(`/api/search?q=${encodeURIComponent(q)}`)

// ── Messages ──────────────────────────────────────────────────────────────────
export interface MessageReaction {
  id: number
  message_id: number
  user_id: number
  emoji: string
  created_at: string
}

export interface Message {
  id: number
  sender_id: number
  recipient_id: number
  subject: string | null
  body: string
  sent_at: string
  read_at: string | null
  is_pinned: boolean
  forwarded_from_id: number | null
  attachment_path: string | null
  attachment_name: string | null
  attachment_type: string | null
  attachment_size: number | null
  reactions: MessageReaction[]
}

export interface MessageThread {
  contact_id: number
  contact_name: string
  contact_email: string
  contact_role: string
  matric_number: string | null
  staff_number: string | null
  department: string | null
  last_message_body: string | null
  last_message_at: string | null
  last_message_sender_id: number | null
  unread_count: number
}

export const messages = {
  threads: () => request<MessageThread[]>('/api/messages/threads'),
  inbox: () => request<Message[]>('/api/messages/inbox'),
  sent: () => request<Message[]>('/api/messages/sent'),
  conversation: (userId: number) => request<Message[]>(`/api/messages/conversation/${userId}`),
  send: (recipient_id: number, body: string, subject?: string) =>
    request<Message>('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ recipient_id, body, subject }),
    }),
  markRead: (id: number) => request(`/api/messages/${id}/read`, { method: 'PATCH' }),
  react: (messageId: number, emoji: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const form = new FormData()
    form.append('emoji', emoji)
    return fetch(`${BASE}/api/messages/${messageId}/react`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async (r) => {
      if (!r.ok) throw new Error('Failed to react')
      return r.json() as Promise<Message>
    })
  },
  unreact: (messageId: number) => request<Message>(`/api/messages/${messageId}/react`, { method: 'DELETE' }),
  pin: (messageId: number) => request<Message>(`/api/messages/${messageId}/pin`, { method: 'PATCH' }),
  forward: (originalMessageId: number, recipientId: number) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const form = new FormData()
    form.append('original_message_id', String(originalMessageId))
    form.append('recipient_id', String(recipientId))
    return fetch(`${BASE}/api/messages/forward`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async (r) => {
      if (!r.ok) throw new Error('Failed to forward')
      return r.json() as Promise<Message>
    })
  },
  sendWithAttachment: (recipientId: number, body: string, file: File, subject?: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const form = new FormData()
    form.append('recipient_id', String(recipientId))
    form.append('body', body)
    if (subject) form.append('subject', subject)
    form.append('file', file)
    return fetch(`${BASE}/api/messages/with-attachment`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async (r) => {
      if (!r.ok) throw new Error('Failed to send attachment')
      return r.json() as Promise<Message>
    })
  },
  delete: (messageId: number) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    return fetch(`${BASE}/api/messages/${messageId}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then((r) => { if (!r.ok) throw new Error('Failed to delete message') })
  },
  attachmentUrl: (messageId: number) => `${BASE}/api/messages/attachment/${messageId}`,
}

// ── Users / Contacts ──────────────────────────────────────────────────────────
export interface Contact {
  id: number
  name: string
  email: string
  role: string
  matric_number: string | null
  staff_number: string | null
  department: string | null
}

export interface UserProfile {
  id: number
  name: string
  email: string
  role: string
  matric_number: string | null
  staff_number: string | null
  department: string | null
  level: string | null
  is_active: boolean
  created_at: string
}

export const users = {
  me: () => request<UserProfile>('/api/users/me'),
  updateMe: (data: { name?: string; department?: string; level?: string }) =>
    request<UserProfile>('/api/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
  changePassword: (current_password: string, new_password: string) =>
    request<{ message: string }>('/api/users/me/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password, new_password }),
    }),
  deleteAccount: (id_number: string) =>
    request<{ message: string }>('/api/users/me', {
      method: 'DELETE',
      body: JSON.stringify({ id_number }),
    }),
  contacts: () => request<Contact[]>('/api/users/contacts'),
  search: (q: string) => request<Contact[]>(`/api/users/search?q=${encodeURIComponent(q)}`),
}

// ── Course Materials ──────────────────────────────────────────────────────────
export interface CourseMaterial {
  id: number
  class_id: number
  uploaded_by: number
  uploader_name: string
  title: string
  description: string | null
  original_filename: string
  file_type: string | null
  file_size: number | null
  uploaded_at: string
}

export const materials = {
  list: (classId: number) =>
    request<CourseMaterial[]>(`/api/materials/${classId}`),

  upload: (classId: number, title: string, description: string, file: File) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const form = new FormData()
    form.append('title', title)
    form.append('description', description)
    form.append('file', file)
    return fetch(`${BASE}/api/materials/${classId}/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
        throw new Error(typeof err.detail === 'string' ? err.detail : 'Upload failed')
      }
      return res.json() as Promise<CourseMaterial>
    })
  },

  downloadUrl: (materialId: number) => `${BASE}/api/materials/download/${materialId}`,

  delete: (materialId: number) =>
    request<void>(`/api/materials/${materialId}`, { method: 'DELETE' }),
}

// ── Study Hub ─────────────────────────────────────────────────────────────────
export interface TutorInfo {
  student_id: number
  name: string
  matric_number: string | null
}

export interface HubBroadcast {
  id: number
  class_id: number
  tutor_id: number
  tutor_name: string
  message: string
  created_at: string
}

export interface HubLiveSession {
  id: number
  class_id: number
  tutor_id: number
  tutor_name: string
  title: string
  jitsi_room: string | null
  status: string
  started_at: string
  ended_at: string | null
}

export interface HubInfo {
  class_id: number
  class_name: string
  course_code: string | null
  member_count: number
  tutors: TutorInfo[]
  my_application_status: 'pending' | 'approved' | 'rejected' | null
  i_am_tutor: boolean
  broadcasts: HubBroadcast[]
  active_live_session: HubLiveSession | null
}

export interface TutorApplication {
  id: number
  class_id: number
  student_id: number
  student_name: string
  matric_number: string | null
  motivation: string
  status: 'pending' | 'approved' | 'rejected'
  applied_at: string
}

export const hub = {
  getInfo: (classId: number) =>
    request<HubInfo>(`/api/hub/${classId}`),

  apply: (classId: number, motivation: string) =>
    request<{ message: string }>(`/api/hub/${classId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ motivation }),
    }),

  getApplications: (classId: number) =>
    request<TutorApplication[]>(`/api/hub/${classId}/applications`),

  selectTutors: (classId: number, studentIds: number[]) =>
    request<{ message: string }>(`/api/hub/${classId}/select`, {
      method: 'POST',
      body: JSON.stringify({ student_ids: studentIds }),
    }),

  broadcast: (classId: number, message: string) =>
    request<HubBroadcast>(`/api/hub/${classId}/broadcast`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  startLive: (classId: number, title: string) =>
    request<HubLiveSession>(`/api/hub/${classId}/start-live`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),

  endLive: (classId: number, sessionId: number) =>
    request<HubLiveSession>(`/api/hub/${classId}/end-live/${sessionId}`, {
      method: 'PATCH',
    }),
}
