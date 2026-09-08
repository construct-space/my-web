import { ref, reactive, computed } from 'vue'

type ValidationRule = (value: any) => string | true
type FieldRules = Record<string, ValidationRule[]>

export function useFormValidation<T extends Record<string, any>>(initial: T, rules: FieldRules = {}) {
  const values = reactive({ ...initial }) as T
  const errors = reactive<Record<string, string>>({})
  const touched = reactive<Record<string, boolean>>({})
  const submitting = ref(false)

  const isValid = computed(() => Object.keys(errors).every(k => !errors[k]))
  const isDirty = computed(() => {
    for (const key of Object.keys(initial)) {
      if ((values as any)[key] !== (initial as any)[key]) return true
    }
    return false
  })

  function validate(field?: string): boolean {
    const fieldsToValidate = field ? [field] : Object.keys(rules)
    let valid = true

    for (const name of fieldsToValidate) {
      const fieldRules = rules[name]
      if (!fieldRules) continue

      const value = (values as any)[name]
      errors[name] = ''

      for (const rule of fieldRules) {
        const result = rule(value)
        if (result !== true) {
          errors[name] = result
          valid = false
          break
        }
      }
    }

    return valid
  }

  function touch(field: string) {
    touched[field] = true
    validate(field)
  }

  function reset() {
    Object.assign(values, initial)
    Object.keys(errors).forEach(k => { errors[k] = '' })
    Object.keys(touched).forEach(k => { touched[k] = false })
  }

  async function handleSubmit(fn: (values: T) => Promise<void> | void) {
    if (!validate()) return
    submitting.value = true
    try {
      await fn(values)
    } finally {
      submitting.value = false
    }
  }

  return { values, errors, touched, isValid, isDirty, submitting, validate, touch, reset, handleSubmit }
}

// Common validation rules
export const required = (msg = 'Required'): ValidationRule => (v) => (v != null && v !== '') || msg
export const minLength = (n: number, msg?: string): ValidationRule => (v) => (!v || v.length >= n) || (msg ?? `At least ${n} characters`)
export const maxLength = (n: number, msg?: string): ValidationRule => (v) => (!v || v.length <= n) || (msg ?? `At most ${n} characters`)
export const email = (msg = 'Invalid email'): ValidationRule => (v) => (!v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) || msg
export const pattern = (re: RegExp, msg = 'Invalid format'): ValidationRule => (v) => (!v || re.test(v)) || msg
