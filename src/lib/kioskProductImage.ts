import bubs from '@/assets/kiosk/bubs.webp';
import cheezDoodles from '@/assets/kiosk/cheez-doodles.webp';
import colaZero from '@/assets/kiosk/cola-zero.webp';
import cola from '@/assets/kiosk/cola.webp';
import fanta from '@/assets/kiosk/fanta.webp';
import fizzypop from '@/assets/kiosk/fizzypop.webp';
import gottBlandat from '@/assets/kiosk/gott-blandat.webp';
import gullchips from '@/assets/kiosk/gullchips.webp';
import japp from '@/assets/kiosk/japp.webp';
import kimsPaprika from '@/assets/kiosk/kims-paprika.webp';
import kimsSaltCrunchAsset from '@/assets/kiosk/kims-salt-crunch.webp.asset.json';
import kimsSourcream from '@/assets/kiosk/kims-sourcream.webp';
import kinderBueno from '@/assets/kiosk/kinder-bueno.webp';
import kinderMaxi from '@/assets/kiosk/kinder-maxi.webp';
import knattar from '@/assets/kiosk/knattar.webp';
import krokanrull from '@/assets/kiosk/krokanrull.webp';
import kvikkLunsj from '@/assets/kiosk/kvikk-lunsj.webp';
import lollipop from '@/assets/kiosk/lollipop.webp';
import loveHearts from '@/assets/kiosk/love-hearts.webp';
import maoam from '@/assets/kiosk/maoam.webp';
import melkerull from '@/assets/kiosk/melkerull.webp';
import pepsiMax from '@/assets/kiosk/pepsi-max.webp';
import roulette from '@/assets/kiosk/roulette.webp';
import smil from '@/assets/kiosk/smil.webp';
import solo from '@/assets/kiosk/solo.webp';
import sprite from '@/assets/kiosk/sprite.webp';
import stratos from '@/assets/kiosk/stratos.webp';
import toppris from '@/assets/kiosk/toppris.webp';
import twix from '@/assets/kiosk/twix.webp';
import urge from '@/assets/kiosk/urge.webp';
import vepsebol from '@/assets/kiosk/vepsebol.webp';
import villa from '@/assets/kiosk/villa.webp';

const PRODUCT_IMAGES: Array<{ test: RegExp; src: string }> = [
  { test: /cola zero/i, src: colaZero },
  { test: /pepsi(?: max)?/i, src: pepsiMax },
  { test: /cola/i, src: cola },
  { test: /fanta/i, src: fanta },
  { test: /solo/i, src: solo },
  { test: /sprite/i, src: sprite },
  { test: /urge/i, src: urge },
  { test: /villa/i, src: villa },
  { test: /cheez|doodle/i, src: cheezDoodles },
  { test: /salt\s*crunch|havsalt/i, src: kimsSaltCrunchAsset.url },
  { test: /kims.*(?:sour|cream)|(?:sour|cream).*kims/i, src: kimsSourcream },
  { test: /kims.*paprika|paprika.*kims/i, src: kimsPaprika },
  { test: /gullchips|petters/i, src: gullchips },
  { test: /gott\s*(?:&|og)?\s*blandat/i, src: gottBlandat },
  { test: /knatt(?:ar|er)/i, src: knattar },
  { test: /bubs/i, src: bubs },
  { test: /fizzy/i, src: fizzypop },
  { test: /haribo|roulette/i, src: roulette },
  { test: /maoam/i, src: maoam },
  { test: /vepsebol/i, src: vepsebol },
  { test: /love hearts/i, src: loveHearts },
  { test: /kj[æa]rlighet|lollipop|pinne/i, src: lollipop },
  { test: /kvikk/i, src: kvikkLunsj },
  { test: /kinder bueno/i, src: kinderBueno },
  { test: /kinder(?: maxi)?/i, src: kinderMaxi },
  { test: /stratos/i, src: stratos },
  { test: /japp/i, src: japp },
  { test: /twix/i, src: twix },
  { test: /toppris/i, src: toppris },
  { test: /krokanrull/i, src: krokanrull },
  { test: /smil/i, src: smil },
  { test: /melkerull/i, src: melkerull },
];

/** Returns a transparent product cutout for the known Gomla catalog items. */
export function getKioskProductImage(productName: string): string | null {
  return PRODUCT_IMAGES.find(({ test }) => test.test(productName))?.src ?? null;
}
