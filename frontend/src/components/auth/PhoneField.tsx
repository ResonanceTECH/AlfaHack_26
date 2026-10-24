import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import { InputAdornment, TextField, type TextFieldProps } from '@mui/material'
import { formatRuPhoneMask } from '@/utils/phone'

type Props = Omit<TextFieldProps, 'onChange' | 'value' | 'type'> & {
  value: string
  onChange: (masked: string) => void
  showIcon?: boolean
}

export function PhoneField({
  value,
  onChange,
  showIcon = true,
  label = 'Телефон',
  placeholder = '+7 (900) 123-45-67',
  ...rest
}: Props) {
  return (
    <TextField
      {...rest}
      label={label}
      value={value}
      placeholder={placeholder}
      type="tel"
      autoComplete="tel"
      onChange={(e) => onChange(formatRuPhoneMask(e.target.value))}
      onPaste={(e) => {
        const text = e.clipboardData.getData('text')
        if (!text) return
        e.preventDefault()
        onChange(formatRuPhoneMask(text))
      }}
      inputProps={{
        inputMode: 'tel',
        autoComplete: 'tel',
        ...rest.inputProps,
      }}
      InputProps={{
        ...rest.InputProps,
        ...(showIcon
          ? {
              startAdornment: (
                <InputAdornment position="start">
                  <PhoneOutlinedIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }
          : {}),
      }}
    />
  )
}
