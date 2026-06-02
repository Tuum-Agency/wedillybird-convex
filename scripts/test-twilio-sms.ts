/**
 * Test manuel d'envoi SMS Twilio — vérifie l'intégration
 * `convex/lib/twilioSms.ts` de bout en bout contre la vraie API Twilio, SANS
 * attendre la Toll-Free Verification. Un compte trial suffit : il envoie
 * immédiatement vers un numéro vérifié (le tien, validé au signup Twilio).
 *
 * Usage (exporte tes creds dans le terminal — JAMAIS dans un fichier commité) :
 *   export TWILIO_ACCOUNT_SID=ACxxxxxxxx
 *   export TWILIO_AUTH_TOKEN=xxxxxxxx
 *   export TWILIO_FROM_NUMBER=+1XXXXXXXXXX        # ton numéro trial Twilio
 *   pnpx tsx scripts/test-twilio-sms.ts +1XXXXXXXXXX   # ton numéro vérifié
 *
 * Le script lit UNIQUEMENT process.env — aucun secret en dur, rien d'écrit sur
 * disque. Il réutilise le même code que la prod : un succès ici prouve que
 * l'intégration fonctionne.
 */
import { isTwilioConfigured, sendTwilioSms } from '../convex/lib/twilioSms';

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error('Usage: pnpx tsx scripts/test-twilio-sms.ts +1XXXXXXXXXX');
    process.exit(1);
  }

  if (!isTwilioConfigured()) {
    console.error(
      'Twilio non configuré. Exporte TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN +\n' +
        'TWILIO_FROM_NUMBER (ou TWILIO_MESSAGING_SERVICE_SID) avant de lancer.',
    );
    process.exit(1);
  }

  console.log(`Envoi d'un SMS de test vers ${to}…`);
  const res = await sendTwilioSms({
    to,
    body: 'Wedillybird: your verification code is 424242. It expires in 5 minutes.',
  });

  if (res.ok) {
    console.log(`✅ Accepté par Twilio. sid=${res.messageId}`);
    console.log('Vérifie ton téléphone — le SMS devrait arriver en quelques secondes.');
    console.log(
      '(Sur compte trial, le message est préfixé "Sent from your Twilio trial account".)',
    );
  } else {
    console.error(`❌ Échec: ${res.error}${res.httpStatus ? ` (HTTP ${res.httpStatus})` : ''}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
