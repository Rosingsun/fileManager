import React, { useMemo } from 'react'
import { AutoComplete, Input } from 'antd'
import type { AutoCompleteProps } from 'antd'
import { COMMON_EMAIL_DOMAINS } from '../utils/commonEmailDomains'

const MAX_OPTIONS = 24

function buildEmailOptions(raw: string): NonNullable<AutoCompleteProps['options']> {
  const input = raw.trim()
  if (!input) return []

  const at = input.indexOf('@')
  if (at < 0) {
    const local = input
    if (!local) return []
    return COMMON_EMAIL_DOMAINS.slice(0, MAX_OPTIONS).map((d) => {
      const full = `${local}@${d}`
      return { value: full, label: full }
    })
  }

  const local = input.slice(0, at)
  const domainPart = input.slice(at + 1)
  if (!local) return []

  const q = domainPart.toLowerCase()
  const domains = q
    ? COMMON_EMAIL_DOMAINS.filter(
        (d) => d.toLowerCase().startsWith(q) || d.toLowerCase().includes(q)
      )
    : [...COMMON_EMAIL_DOMAINS]

  return domains.slice(0, MAX_OPTIONS).map((d) => {
    const full = `${local}@${d}`
    return { value: full, label: full }
  })
}

export type EmailAutoCompleteProps = Omit<AutoCompleteProps, 'options' | 'filterOption'> & {
  /** 传给内部 Input 的 autoComplete（如 email） */
  autoComplete?: string
}

const EmailAutoComplete: React.FC<EmailAutoCompleteProps> = ({
  value,
  onChange,
  style,
  size,
  placeholder,
  autoComplete,
  ...rest
}) => {
  const str = value == null ? '' : typeof value === 'string' ? value : String(value)
  const options = useMemo(() => buildEmailOptions(str), [str])

  return (
    <AutoComplete
      value={str}
      onChange={onChange}
      options={options}
      filterOption={false}
      virtual={false}
      style={{ width: '100%', ...style }}
      {...rest}
    >
      <Input size={size} placeholder={placeholder} autoComplete={autoComplete} />
    </AutoComplete>
  )
}

export default EmailAutoComplete
