import { describe, expect, test } from 'bun:test'
import { resolveResetPasswordFields } from './resetPasswordFields'

describe('resolveResetPasswordFields', () => {
  test('uses current form values when password manager autofill leaves Vue refs stale', () => {
    const form = new FormData()
    form.set('password', 'Correct horse battery staple')
    form.set('password_confirm', 'Correct horse battery staple')

    const fields = resolveResetPasswordFields({
      modelPassword: 'old-model-password',
      modelPasswordConfirm: 'different-old-model-password',
      formData: form,
    })

    expect(fields.password).toBe('Correct horse battery staple')
    expect(fields.passwordConfirm).toBe('Correct horse battery staple')
    expect(fields.passwordsMatch).toBe(true)
  })

  test('preserves whitespace because spaces can be intentional password characters', () => {
    const form = new FormData()
    form.set('password', '  pass phrase  ')
    form.set('password_confirm', 'pass phrase')

    const fields = resolveResetPasswordFields({
      modelPassword: '',
      modelPasswordConfirm: '',
      formData: form,
    })

    expect(fields.password).toBe('  pass phrase  ')
    expect(fields.passwordConfirm).toBe('pass phrase')
    expect(fields.passwordsMatch).toBe(false)
  })
})
