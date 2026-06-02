// src/utils/whatsapp.ts
// İş De Yeter - WhatsApp İletişim ve Onay Köprüsü Yardımcı Metotları

import configData from '../pages/data/config.json';

const WHATSAPP_NUMBER = configData.whatsapp || '905412465429';

/**
 * Müşterinin bir teklifi onayladığında WhatsApp hattına göndereceği onay mesajı linkini oluşturur.
 * 
 * @param clientId Müşteri Kullanıcı ID'si
 * @param requestId Hizmet İlanı/Talep ID'si
 * @param partnerName Fiyat teklifini veren İş Ortağı adı
 * @param price Teklif edilen tutar (TL)
 * @returns Yönlendirme için güvenli WhatsApp URL adresi
 */
export function getMemberApprovalLink(
  clientId: string,
  requestId: string | number,
  partnerName: string,
  price: string | number
): string {
  const text = `Merhaba, #${clientId} ID'li kullanıcıyım. #${requestId} ID'li talebime ${partnerName} tarafından verilen ${price} TL tutarındaki teklifi onayladım. Detayları görüşmek isterim.`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

/**
 * İş ortağının, teklifi onaylanan müşteriyle iletişime geçmek için kullanacağı WhatsApp mesaj linkini oluşturur.
 * 
 * @param clientName Müşterinin adı
 * @param clientId Müşteri Kullanıcı ID'si
 * @param requestId Hizmet İlanı/Talep ID'si
 * @returns Yönlendirme için güvenli WhatsApp URL adresi
 */
export function getPartnerContactLink(
  clientName: string,
  clientId: string,
  requestId: string | number
): string {
  const text = `Merhaba ${clientName}, #${clientId} ID'li müşterimizsiniz. #${requestId} ID'li talebiniz için onay verdiğiniz teklif üzerine sizinle iletişime geçiyorum.`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
