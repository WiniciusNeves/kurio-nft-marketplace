/**
 * Leva o foco ao primeiro campo inválido (ordem visual do DOM) assim que os erros são renderizados.
 * Complementa o shouldFocusError do react-hook-form, que não alcança campos controlados (Select)
 * e nem sempre dispara antes do commit do React.
 */
export function focusFirstInvalid(root?: HTMLElement | null, attempts = 10) {
  const scope = root ?? document
  const el = scope.querySelector<HTMLElement>('[aria-invalid="true"]')
  if (el) {
    el.focus()
    el.scrollIntoView({ block: 'center' })
    return
  }
  if (attempts > 0) setTimeout(() => focusFirstInvalid(root, attempts - 1), 16)
}
