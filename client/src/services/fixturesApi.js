export async function getFixtures() {
  const response = await fetch('/api/fixtures')
  if (!response.ok) throw new Error('Não foi possível carregar os jogos.')
  return response.json()
}
