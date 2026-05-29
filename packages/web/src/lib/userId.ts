export function getDemoUserId(): string {
  let id = sessionStorage.getItem('demo_user_id')
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem('demo_user_id', id)
  }
  return id
}
