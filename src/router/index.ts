import { createRouter, createWebHistory } from 'vue-router'

function getCurrentWeekDate(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Monday
  const monday = new Date(now)
  monday.setDate(diff)
  return monday.toISOString().split('T')[0]
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: () => `/week/${getCurrentWeekDate()}`,
    },
    {
      path: '/week/:date',
      name: 'week',
      component: () => import('../views/WeekView.vue'),
    },
    {
      path: '/day/:date',
      name: 'day',
      component: () => import('../views/DayView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
    },
  ],
})

export default router
