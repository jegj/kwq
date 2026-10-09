// One entry per bank: which senders to watch and which of their messages to
// track. shouldTrack receives the GmailMessage.
const BANKS = [
  {
    name: 'bcp',
    senders: ['notificaciones@notificacionesbcp.com.pe'],
    // BCP sends transfers/payments from the same sender; only card consumptions.
    // Keep in sync with BcpParser.canParse on the server.
    shouldTrack: m =>
      /Realizaste un consumo con tu Tarjeta de (Débito|Crédito) BCP/i.test(m.getSubject()) ||
      /Consumo Tarjeta de (Débito|Crédito)/i.test(m.getPlainBody()),
  },
  {
    name: 'interbank',
    senders: ['servicioalcliente@netinterbank.com.pe'],
    shouldTrack: () => true,
  },
  {
    name: 'falabella',
    senders: ['notificaciones@pe.notificaciones.bancofalabella.com'],
    shouldTrack: () => true,
  },
  {
    // Forwarding inbox for any bank: find the original bank by its sender
    // address in the forwarded body and apply that bank's rule.
    // ponytail: if no bank address shows up in the body, track it anyway.
    name: 'forwarder',
    senders: ['javiergalarza4@gmail.com'],
    shouldTrack: m => {
      const body = m.getPlainBody().toLowerCase();
      const original = BANKS.find(b =>
        b.name !== 'forwarder' && b.senders.some(s => body.includes(s.toLowerCase())));
      return original ? original.shouldTrack(m) : true;
    },
  },
];
