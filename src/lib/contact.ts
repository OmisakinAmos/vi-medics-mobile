/** Public contact details used on the Services and About pages. */
export const PHONE_DISPLAY = '+234 811 386 7495';
export const PHONE_TEL = 'tel:+2348113867495';

const WHATSAPP_NUMBER = '2348113867495';

/** Link that opens WhatsApp with a ready-typed message. */
export const whatsappLink = (message: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
