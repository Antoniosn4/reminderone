// =============================================================
//  PasswordField.jsx
//  Input de senha com toggle de visibilidade. Compartilha o
//  estilo de AuthInput e adiciona o ícone Eye/EyeOff sobreposto.
//
//  Zero-trust: o componente NÃO armazena a senha em estado próprio
//  além do toggle visual — a string em claro vive apenas no estado
//  do consumidor, que tem a responsabilidade de zerá-la após uso.
// =============================================================

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * @param {{
 *   label: string,
 *   name: string,
 *   value: string,
 *   onChange: (event: React.ChangeEvent<HTMLInputElement>) => void,
 *   placeholder?: string,
 *   autoFocus?: boolean,
 *   disabled?: boolean,
 *   autoComplete?: "new-password" | "current-password",
 *   rightAccessory?: React.ReactNode,
 * }} props
 */
export function PasswordField({
    label,
    name,
    value,
    onChange,
    placeholder = "••••••••",
    autoFocus = false,
    disabled = false,
    autoComplete = "current-password",
    rightAccessory = null,
}) {
    const [show, setShow] = useState(false);

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

            <div className="relative">
                <input
                    id={name}
                    name={name}
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    autoFocus={autoFocus}
                    disabled={disabled}
                    autoComplete={autoComplete}
                    required
                    className="w-full bg-gray-900/80 border border-gray-700 text-gray-100 rounded-xl px-4 pr-12 py-3.5 text-sm focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all placeholder-gray-600 shadow-inner disabled:opacity-50"
                />
                <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    tabIndex={-1}
                >
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );
}
