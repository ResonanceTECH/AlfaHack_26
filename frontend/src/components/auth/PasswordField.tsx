import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import { IconButton, InputAdornment, TextField, type TextFieldProps } from '@mui/material'
import { useState } from 'react'
import { PASSWORD_MAX, PASSWORD_MIN } from '@/utils/password'

type Props = Omit<TextFieldProps, 'type' | 'onChange' | 'value'> & {
  value: string
  onChange: (value: string) => void
  showStrengthHint?: boolean
}

export function PasswordField({
  value,
  onChange,
  showStrengthHint = false,
  helperText,
  ...rest
}: Props) {
  const [visible, setVisible] = useState(false)
  const hint =
    helperText ??
    (showStrengthHint
      ? `${value.length}/${PASSWORD_MIN}+ символов (макс. ${PASSWORD_MAX})`
      : undefined)

  return (
    <TextField
      {...rest}
      type={visible ? 'text' : 'password'}
      value={value}
      helperText={hint}
      autoComplete={rest.autoComplete ?? 'new-password'}
      onChange={(e) => onChange(e.target.value.slice(0, PASSWORD_MAX))}
      inputProps={{
        maxLength: PASSWORD_MAX,
        spellCheck: false,
        autoCapitalize: 'off',
        autoCorrect: 'off',
        ...rest.inputProps,
      }}
      InputProps={{
        ...rest.InputProps,
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              type="button"
              aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
              onClick={() => setVisible((v) => !v)}
              edge="end"
              size="small"
            >
              {visible ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  )
}
