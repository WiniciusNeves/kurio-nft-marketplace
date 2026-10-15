import { HttpResponse, http } from 'msw'
import {
  loginInputSchema,
  networkSchema,
  passwordChangeInputSchema,
  profileInputSchema,
  registerInputSchema,
  walletInputSchema,
  walletProviderSchema,
  type Session,
  type Wallet,
} from '@/api/contracts'
import type { ZodError } from 'zod'
import { getConfig } from '../config'
import { hashPassword, randomToken } from '../crypto'
import { db, findNft, nowIso, publicUser, save, toSummary, uid, type DbUser } from '../db'
import { api, applyNetwork, errorResponse, readJson, requireUser, sessionFrom } from '../http'
import { revokeRealtimeToken } from '../realtime'

function fieldErrors(err: ZodError) {
  const out: Record<string, string> = {}
  for (const issue of err.issues) {
    const k = issue.path.join('.') || '_'
    if (!out[k]) out[k] = issue.message
  }
  return out
}

function validationError(err: ZodError) {
  return errorResponse(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', { fieldErrors: fieldErrors(err) })
}

function createSession(user: DbUser): Session {
  const ttl = getConfig().scenario === 'short-session' ? 20_000 : 2 * 60 * 60_000
  const token = randomToken()
  const expiresAt = new Date(Date.now() + ttl).toISOString()
  db().sessions.push({ token, userId: user.id, expiresAt, revoked: false })
  save()
  return { token, expiresAt, user: publicUser(user) }
}

function stripWallet(w: Wallet & { userId: string }): Wallet {
  const { userId: _u, ...rest } = w
  return rest
}

export const accountHandlers = [
  /* -------------------------- Sessão -------------------------- */
  http.post(api('/auth/register'), async ({ request }) => {
    const fail = await applyNetwork(request, 'public')
    if (fail) return fail
    const parsed = registerInputSchema.safeParse(await readJson(request))
    if (!parsed.success) return validationError(parsed.error)
    const { username, email, password } = parsed.data
    const emailTaken = db().users.some((u) => u.email.toLowerCase() === email.toLowerCase())
    const userTaken = db().users.some((u) => u.username.toLowerCase() === username.toLowerCase())
    if (emailTaken || userTaken) {
      return errorResponse(409, emailTaken ? 'EMAIL_TAKEN' : 'USERNAME_TAKEN', 'Já existe uma conta com estes dados.', {
        fieldErrors: {
          ...(emailTaken ? { email: 'Este e-mail já está cadastrado' } : {}),
          ...(userTaken ? { username: 'Este nome de usuário já está em uso' } : {}),
        },
      })
    }
    const id = uid('usr')
    const salt = randomToken()
    const user: DbUser = {
      id,
      username,
      email,
      displayName: username,
      avatarUrl: null,
      ensName: null,
      walletNickname: null,
      passwordSalt: salt,
      passwordHash: await hashPassword(password, salt),
    }
    db().users.push(user)
    db().favorites[id] = []
    save()
    return HttpResponse.json(createSession(user), { status: 201 })
  }),

  http.post(api('/auth/login'), async ({ request }) => {
    const fail = await applyNetwork(request, 'public')
    if (fail) return fail
    const parsed = loginInputSchema.safeParse(await readJson(request))
    if (!parsed.success) return validationError(parsed.error)
    const user = db().users.find((u) => u.email.toLowerCase() === parsed.data.email.toLowerCase())
    const ok = user && (await hashPassword(parsed.data.password, user.passwordSalt)) === user.passwordHash
    if (!user || !ok) return errorResponse(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
    return HttpResponse.json(createSession(user))
  }),

  http.get(api('/auth/session'), async ({ request }) => {
    const fail = await applyNetwork(request, 'public')
    if (fail) return fail
    const r = requireUser(request)
    if ('response' in r) return r.response
    const body: Session = { token: r.session.token, expiresAt: r.session.expiresAt, user: publicUser(r.user) }
    return HttpResponse.json(body)
  }),

  http.post(api('/auth/logout'), async ({ request }) => {
    const s = sessionFrom(request)
    if (s.status === 'ok' || s.status === 'expired') {
      const header = request.headers.get('authorization')!.slice(7)
      const rec = db().sessions.find((x) => x.token === header)
      if (rec) rec.revoked = true
      db().walletSessions = db().walletSessions.filter((w) => s.status !== 'ok' || w.userId !== s.user.id)
      save()
      revokeRealtimeToken(header)
    }
    return new HttpResponse(null, { status: 204 })
  }),

  /* -------------------------- Perfil -------------------------- */
  http.get(api('/me/profile'), async ({ request }) => {
    const fail = await applyNetwork(request, 'private')
    if (fail) return fail
    const r = requireUser(request)
    if ('response' in r) return r.response
    return HttpResponse.json(publicUser(r.user))
  }),

  http.put(api('/me/profile'), async ({ request }) => {
    const fail = await applyNetwork(request, 'private')
    if (fail) return fail
    const r = requireUser(request)
    if ('response' in r) return r.response
    const parsed = profileInputSchema.safeParse(await readJson(request))
    if (!parsed.success) return validationError(parsed.error)
    const d = parsed.data
    const others = db().users.filter((u) => u.id !== r.user.id)
    const fe: Record<string, string> = {}
    if (others.some((u) => u.username.toLowerCase() === d.username.toLowerCase()))
      fe.username = 'Este nome de usuário já está em uso'
    if (others.some((u) => u.email.toLowerCase() === d.email.toLowerCase())) fe.email = 'Este e-mail já está cadastrado'
    if (Object.keys(fe).length)
      return errorResponse(409, fe.email ? 'EMAIL_TAKEN' : 'USERNAME_TAKEN', 'Dados já utilizados por outra conta.', {
        fieldErrors: fe,
      })
    Object.assign(r.user, {
      displayName: d.displayName,
      username: d.username,
      email: d.email,
      ensName: d.ensName,
      walletNickname: d.walletNickname,
    })
    save()
    return HttpResponse.json(publicUser(r.user))
  }),

  http.post(api('/me/avatar'), async ({ request }) => {
    const fail = await applyNetwork(request, 'private')
    if (fail) return fail
    const r = requireUser(request)
    if ('response' in r) return r.response
    const form = await request.formData().catch(() => null)
    const file = form?.get('avatar')
    if (!(file instanceof File)) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Envie uma imagem.', {
        fieldErrors: { avatar: 'Selecione uma imagem' },
      })
    }
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Formato não suportado.', {
        fieldErrors: { avatar: 'Use PNG, JPG, WEBP ou GIF' },
      })
    }
    if (file.size > 1_000_000) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Imagem muito grande.', {
        fieldErrors: { avatar: 'A imagem deve ter no máximo 1 MB' },
      })
    }
    const buf = new Uint8Array(await file.arrayBuffer())
    let bin = ''
    buf.forEach((b) => (bin += String.fromCharCode(b)))
    r.user.avatarUrl = `data:${file.type};base64,${btoa(bin)}`
    save()
    return HttpResponse.json(publicUser(r.user))
  }),

  http.delete(api('/me/avatar'), async ({ request }) => {
    const fail = await applyNetwork(request, 'private')
    if (fail) return fail
    const r = requireUser(request)
    if ('response' in r) return r.response
    r.user.avatarUrl = null
    save()
    return HttpResponse.json(publicUser(r.user))
  }),

  http.put(api('/me/password'), async ({ request }) => {
    const fail = await applyNetwork(request, 'private')
    if (fail) return fail
    const r = requireUser(request)
    if ('response' in r) return r.response
    const parsed = passwordChangeInputSchema.safeParse(await readJson(request))
    if (!parsed.success) return validationError(parsed.error)
    const ok = (await hashPassword(parsed.data.currentPassword, r.user.passwordSalt)) === r.user.passwordHash
    if (!ok)
      return errorResponse(422, 'VALIDATION_ERROR', 'Senha atual incorreta.', {
        fieldErrors: { currentPassword: 'Senha atual incorreta' },
      })
    r.user.passwordSalt = randomToken()
    r.user.passwordHash = await hashPassword(parsed.data.newPassword, r.user.passwordSalt)
    save()
    return new HttpResponse(null, { status: 204 })
  }),

  /* -------------------------- Carteiras -------------------------- */
  http.get(api('/me/wallets'), async ({ request }) => {
    const fail = await applyNetwork(request, 'private')
    if (fail) return fail
    const r = requireUser(request)
    if ('response' in r) return r.response
    return HttpResponse.json({
      items: db()
        .wallets.filter((w) => w.userId === r.user.id)
        .map(stripWallet),
    })
  }),

  http.post(api('/me/wallets'), async ({ request }) => {
    const fail = await applyNetwork(request, 'private')
    if (fail) return fail
    const r = requireUser(request)
    if ('response' in r) return r.response
    const parsed = walletInputSchema.safeParse(await readJson(request))
    if (!parsed.success) return validationError(parsed.error)
    const d = parsed.data
    if (db().wallets.some((w) => w.userId === r.user.id && w.role === d.role)) {
      return errorResponse(409, 'VALIDATION_ERROR', 'Você já possui uma carteira com este papel.', {
        fieldErrors: { role: 'Edite a carteira existente' },
      })
    }
    const wallet = {
      ...d,
      secondaryAddress: d.secondaryAddress || null,
      id: uid('wal'),
      userId: r.user.id,
      updatedAt: nowIso(),
    }
    db().wallets.push(wallet)
    save()
    return HttpResponse.json(stripWallet(wallet), { status: 201 })
  }),

  http.put(api('/me/wallets/:id'), async ({ request, params }) => {
    const fail = await applyNetwork(request, 'private')
    if (fail) return fail
    const r = requireUser(request)
    if ('response' in r) return r.response
    const wallet = db().wallets.find((w) => w.id === params.id)
    if (!wallet) return errorResponse(404, 'NOT_FOUND', 'Carteira não encontrada.')
    if (wallet.userId !== r.user.id) return errorResponse(403, 'FORBIDDEN', 'Esta carteira pertence a outra conta.')
    const parsed = walletInputSchema.safeParse(await readJson(request))
    if (!parsed.success) return validationError(parsed.error)
    Object.assign(wallet, parsed.data, { secondaryAddress: parsed.data.secondaryAddress || null, updatedAt: nowIso() })
    save()
    return HttpResponse.json(stripWallet(wallet))
  }),

  http.post(api('/me/wallets/:id/connect'), async ({ request, params }) => {
    const fail = await applyNetwork(request, 'private')
    if (fail) return fail
    const r = requireUser(request)
    if ('response' in r) return r.response
    const wallet = db().wallets.find((w) => w.id === params.id && w.userId === r.user.id)
    if (!wallet) return errorResponse(404, 'NOT_FOUND', 'Carteira não encontrada.')
    const body = await readJson<{ network?: string; provider?: string }>(request)
    const network = networkSchema.safeParse(body?.network)
    const provider = walletProviderSchema.safeParse(body?.provider ?? wallet.provider)
    if (!network.success)
      return errorResponse(422, 'VALIDATION_ERROR', 'Selecione uma rede.', {
        fieldErrors: { network: 'Selecione uma rede' },
      })
    if (getConfig().scenario === 'wallet-rejected') {
      return errorResponse(
        403,
        'WALLET_REJECTED',
        'A conexão foi recusada na carteira. Aprove a solicitação para continuar.',
      )
    }
    const ws = {
      id: uid('wss'),
      walletId: wallet.id,
      provider: provider.success ? provider.data : wallet.provider,
      network: network.data,
      connectedAt: nowIso(),
      userId: r.user.id,
    }
    db().walletSessions = [...db().walletSessions.filter((x) => x.userId !== r.user.id), ws]
    save()
    const { userId: _u, ...pub } = ws
    return HttpResponse.json(pub, { status: 201 })
  }),

  http.delete(api('/me/wallet-sessions/:id'), async ({ request, params }) => {
    const r = requireUser(request)
    if ('response' in r) return r.response
    db().walletSessions = db().walletSessions.filter((x) => !(x.id === params.id && x.userId === r.user.id))
    save()
    return new HttpResponse(null, { status: 204 })
  }),

  /* -------------------------- Favoritos -------------------------- */
  http.get(api('/me/favorites'), async ({ request }) => {
    const fail = await applyNetwork(request, 'private')
    if (fail) return fail
    const r = requireUser(request)
    if ('response' in r) return r.response
    return HttpResponse.json({ nftIds: db().favorites[r.user.id] ?? [] })
  }),

  /** Lista de interesse: NFTs favoritados (projeção do catálogo atual, na ordem em que foram favoritados). */
  http.get(api('/me/favorites/items'), async ({ request }) => {
    const fail = await applyNetwork(request, 'private')
    if (fail) return fail
    const r = requireUser(request)
    if ('response' in r) return r.response
    const items = (db().favorites[r.user.id] ?? [])
      .map((id) => findNft(id))
      .filter((n): n is NonNullable<typeof n> => Boolean(n))
      .reverse()
      .map(toSummary)
    return HttpResponse.json({ items })
  }),

  http.put(api('/me/favorites/:nftId'), async ({ request, params }) => {
    const fail = await applyNetwork(request, 'favorites-mutation')
    if (fail) return fail
    const r = requireUser(request)
    if ('response' in r) return r.response
    const id = String(params.nftId)
    if (!findNft(id)) return errorResponse(404, 'NOT_FOUND', 'NFT não encontrado.')
    const list = db().favorites[r.user.id] ?? []
    if (!list.includes(id)) db().favorites[r.user.id] = [...list, id]
    save()
    return HttpResponse.json({ nftIds: db().favorites[r.user.id] })
  }),

  http.delete(api('/me/favorites/:nftId'), async ({ request, params }) => {
    const fail = await applyNetwork(request, 'favorites-mutation')
    if (fail) return fail
    const r = requireUser(request)
    if ('response' in r) return r.response
    db().favorites[r.user.id] = (db().favorites[r.user.id] ?? []).filter((x) => x !== params.nftId)
    save()
    return HttpResponse.json({ nftIds: db().favorites[r.user.id] })
  }),
]
