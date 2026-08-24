// =============================================================
//  Avatar.jsx
//  Avatar local determinístico — gera inicial + cor a partir do nome.
//  Substitui dependência externa (dicebear) por SVG/CSS inline,
//  removendo origem remota da CSP e cargas de rede desnecessárias.
// =============================================================

const HUE_RANGE = 360;
const HUE_SHIFT = 38;
const SATURATION = 62;
const LIGHTNESS_TOP = 55;
const LIGHTNESS_BOTTOM = 38;
const FONT_SIZE_RATIO = 0.42;
const FALLBACK_HUE = 220;

/**
 * Hash estável djb2-like — mesmo nome devolve sempre a mesma cor.
 * @param {string} value
 * @returns {number}
 */
function hashToHue(value) {
    if (!value) return FALLBACK_HUE;
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % HUE_RANGE;
}

/**
 * @param {string | null | undefined} name
 * @returns {string}
 */
function pickInitial(name) {
    const trimmed = (name ?? "").trim();
    if (!trimmed) return "?";
    return trimmed[0].toUpperCase();
}

/**
 * Avatar com inicial e gradiente derivado do nome (ou seed alternativo).
 *
 * @param {{
 *   name?: string,
 *   seed?: string,
 *   size?: number,
 *   className?: string,
 *   title?: string,
 * }} props
 */
export function Avatar({ name, seed, size = 36, className = "", title }) {
    const colorSource = seed ?? name ?? "";
    const hue = hashToHue(colorSource);
    const initial = pickInitial(name ?? seed);
    const background = `linear-gradient(135deg, hsl(${hue}, ${SATURATION}%, ${LIGHTNESS_TOP}%), hsl(${(hue + HUE_SHIFT) % HUE_RANGE}, ${SATURATION}%, ${LIGHTNESS_BOTTOM}%))`;

    return (
        <div
            role="img"
            aria-label={title ?? (name ? `Avatar de ${name}` : "Avatar")}
            title={title}
            style={{
                width: size,
                height: size,
                background,
                fontSize: Math.round(size * FONT_SIZE_RATIO),
                color: "#ffffff",
            }}
            className={`flex items-center justify-center rounded-full font-bold select-none shadow-sm ${className}`}
        >
            {initial}
        </div>
    );
}
