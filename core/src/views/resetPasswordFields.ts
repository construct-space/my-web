interface ResolveResetPasswordFieldsInput {
  modelPassword: string
  modelPasswordConfirm: string
  formData?: FormData | null
}

interface ResolvedResetPasswordFields {
  password: string
  passwordConfirm: string
  passwordsMatch: boolean
}

function formString(formData: FormData | null | undefined, key: string): string | null {
  const value = formData?.get(key)
  return typeof value === 'string' ? value : null
}

export function resolveResetPasswordFields(input: ResolveResetPasswordFieldsInput): ResolvedResetPasswordFields {
  const password = formString(input.formData, 'password') ?? input.modelPassword
  const passwordConfirm = formString(input.formData, 'password_confirm') ?? input.modelPasswordConfirm

  return {
    password,
    passwordConfirm,
    passwordsMatch: password === passwordConfirm,
  }
}
