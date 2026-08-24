// =============================================================
//  AuthInput.jsx
//  Input de texto/email da tela de autenticação.
//  Estilo do protótipo: superfície gray-900/80, sombra interna,
//  borda discreta e foco em ring fino.
//
//  Para campos de senha use PasswordField (que adiciona toggle
//  de visibilidade — necessidade de UX/acessibilidade).
// =============================================================

/**
 * @param {{
 *   label: string,
 *   name: string,
 *   value: string,
 *   onChange: (event: React.ChangeEvent<HTMLInputElement>) => void,
 *   type?: "text" | "email",
 *   placeholder?: string,
 *   required?: boolean,
 *   autoFocus?: boolean,
 *   disabled?: boolean,
 *   autoComplete?: string,
 *   isVisible?: boolean,
 *   rightAccessory?: React.ReactNode,
 * }} props
 */
export function AuthInput({
    label,
    name,
    value,
    onChange,
    type = "text",
    placeholder,
    required = true,
    autoFocus = false,
    disabled = false,
    autoComplete,
    isVisible = true,
    rightAccessory = null,
}) {
    if (!isVisible) return null;

    return (
        <div>
            <div className="flex justify-between items-center mb-2 px-1">
                <label
                    htmlFor={name}
                    className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest"
                >
                    {label}
                </label>
                {rightAccessory}
            </div>
            <input
                id={name}
                name={name}
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                required={required}
                autoFocus={autoFocus}
                disabled={disabled}
                autoComplete={autoComplete}
                className="w-full bg-gray-900/80 border border-gray-700 text-gray-100 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all placeholder-gray-600 shadow-inner disabled:opacity-50"
            />
        </div>
    );
}
