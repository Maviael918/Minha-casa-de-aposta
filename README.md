# Simulador de Apostas Esportivas

Aplicação local para treinamento com dinheiro fictício. Esta primeira etapa entrega a estrutura React + Vite, backend Express, banco SQLite e tela de jogos alimentada por mock data.

## Requisitos

- Node.js 18+
- npm

## Executar

```bash
npm install
copy .env.example .env
npm run dev
```

Abra `http://localhost:5173`. O backend roda em `http://localhost:3001`.

Sem `SPORTS_API_KEY`, o backend usa automaticamente 10 partidas mockadas e salva o cache em `server/data/simulador.db`. A integração real ficará isolada em `server/services/sportsApi.js`.

## Verificar a API real

O topo da aplicação mostra o estado da API:

- `API conectada`: a chave foi aceita e o endpoint de status respondeu.
- `API indisponível`: a chave existe, mas a API respondeu com erro ou limite excedido; o sistema usa o cache/mock.
- `API em modo mock`: não há chave configurada.

Também é possível consultar diretamente:

```text
http://localhost:3001/api/sports-api/status
```

Essa rota nunca retorna a chave. Ela informa somente o estado e, quando disponível, o consumo da conta.

## Buscar Série A e Série B

Os IDs usados pela API-Football são:

- `71`: Brasileirão Série A
- `72`: Brasileirão Série B

O backend já usa esses IDs por padrão através de `SPORTS_API_LEAGUES=71,72` e a temporada em `SPORTS_API_SEASON=2026`. Para consultar uma data específica manualmente:

```text
http://localhost:3001/api/fixtures?date=2026-09-19&leagues=71,72
```

O React não chama a API-Football diretamente. Ele chama o backend, que busca as duas ligas, agrupa as odds por data e salva o resultado no SQLite.

## Supabase

O arquivo `supabase/schema.sql` cria as tabelas de carteira, apostas, seleções, fixtures, odds e transações. No painel do Supabase, abra **SQL Editor**, cole o conteúdo desse arquivo e execute.

O schema usa `auth.users`, Row Level Security e guarda a odd copiada no momento da aposta. Nesta etapa o sistema continua usando SQLite local; a conexão do backend com Supabase será feita em uma etapa posterior, usando variáveis de ambiente no servidor.

## Etapas atuais

- Estrutura full-stack React + Vite + Express
- SQLite criado automaticamente com tabelas base
- Tela inicial responsiva de jogos, status e mercados de odds
- Dados mockados de jogos futuros, ao vivo e encerrados

Ainda não há realização de apostas nesta etapa.
