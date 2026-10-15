/** Identificador do carrinho do visitante (persistido para sobreviver a refresh). */
const KEY = 'kurio:guest-cart-id'

export function guestCartId() {
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = `gc_${crypto.randomUUID()}`
    localStorage.setItem(KEY, id)
  }
  return id
}

/** Após mesclar no carrinho do usuário, o visitante recebe um carrinho novo e vazio. */
export function rotateGuestCartId() {
  localStorage.removeItem(KEY)
  return guestCartId()
}
