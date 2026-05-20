import { StudentAppShell } from './_components/student-app-shell'

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <StudentAppShell>{children}</StudentAppShell>
}
