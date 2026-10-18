export const buildWhatsAppOrderUrl = (checkout, transportName, t) => {
  const message = [
    t.whatsappOrderIntro,
    `${t.whatsappOrderOwner}: ${checkout.ownerName}`,
    `${t.whatsappOrderBrick}: ${checkout.listingName}`,
    `${t.whatsappOrderQuantity}: ${Number(checkout.quantity).toLocaleString('en-IN')}`,
    `${t.whatsappOrderUnitPrice}: ₹${Number(checkout.unitPrice).toLocaleString('en-IN')}`,
    `${t.whatsappOrderTotal}: ₹${Number(checkout.totalAmount).toLocaleString('en-IN')}`,
    `${t.whatsappOrderTransport}: ${transportName}`,
    t.whatsappOrderConfirm
  ].join('\n');

  return `https://wa.me/?text=${encodeURIComponent(message)}`;
};

export const openWhatsAppOrder = (checkout, transportName, t) => {
  window.location.assign(buildWhatsAppOrderUrl(checkout, transportName, t));
};
