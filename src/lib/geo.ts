// Countries: ISO 3166-1 alpha-2 code, international dial code, postal-code rule.
//   required: the courier needs it (FR, BE, GB, CA…)      optional: used there, but we do not insist
//   none:     the country has no postal-code system (BJ, CI, TG…), the field is hidden
// Same list in the API, the storefront and the admin: keep the three copies identical.
export type PostalRule = 'required' | 'optional' | 'none';
export interface Country { iso: string; dial: string; postal: PostalRule }

const RAW = 'AD:376:o,AE:971:n,AF:93:o,AG:1:n,AI:1:o,AL:355:o,AM:374:o,AO:244:n,AR:54:o,AS:1:o,AT:43:r,AU:61:r,AW:297:n,AX:358:o,AZ:994:o,BA:387:o,BB:1:o,BD:880:o,BE:32:r,BF:226:n,BG:359:o,BH:973:o,BI:257:n,BJ:229:n,BL:590:o,BM:1:o,BN:673:o,BO:591:n,BQ:599:o,BR:55:r,BS:1:n,BT:975:o,BW:267:n,BY:375:o,BZ:501:n,CA:1:r,CC:61:o,CD:243:n,CF:236:n,CG:242:n,CH:41:r,CI:225:n,CK:682:n,CL:56:o,CM:237:n,CN:86:r,CO:57:o,CR:506:o,CU:53:o,CV:238:o,CW:599:o,CX:61:o,CY:357:o,CZ:420:r,DE:49:r,DJ:253:n,DK:45:r,DM:1:n,DO:1:o,DZ:213:o,EC:593:o,EE:372:o,EG:20:o,EH:212:o,ER:291:n,ES:34:r,ET:251:o,FI:358:r,FJ:679:n,FK:500:o,FM:691:o,FO:298:o,FR:33:r,GA:241:n,GB:44:r,GD:1:n,GE:995:o,GF:594:o,GG:44:o,GH:233:n,GI:350:o,GL:299:o,GM:220:n,GN:224:o,GP:590:o,GQ:240:n,GR:30:r,GT:502:o,GU:1:o,GW:245:o,GY:592:n,HK:852:n,HN:504:o,HR:385:o,HT:509:o,HU:36:r,ID:62:o,IE:353:r,IL:972:o,IM:44:o,IN:91:r,IO:246:o,IQ:964:o,IR:98:o,IS:354:o,IT:39:r,JE:44:o,JM:1:o,JO:962:o,JP:81:r,KE:254:o,KG:996:o,KH:855:o,KI:686:n,KM:269:n,KN:1:n,KP:850:n,KR:82:r,KW:965:o,KY:1:o,KZ:7:o,LA:856:o,LB:961:o,LC:1:n,LI:423:o,LK:94:o,LR:231:o,LS:266:o,LT:370:o,LU:352:r,LV:371:o,LY:218:o,MA:212:o,MC:377:o,MD:373:o,ME:382:o,MF:590:o,MG:261:o,MH:692:o,MK:389:o,ML:223:n,MM:95:o,MN:976:o,MO:853:n,MP:1:o,MQ:596:o,MR:222:n,MS:1:o,MT:356:o,MU:230:o,MV:960:o,MW:265:n,MX:52:r,MY:60:o,MZ:258:o,NA:264:n,NC:687:o,NE:227:o,NF:672:o,NG:234:o,NI:505:o,NL:31:r,NO:47:r,NP:977:o,NR:674:n,NU:683:n,NZ:64:r,OM:968:o,PA:507:o,PE:51:o,PF:689:o,PG:675:o,PH:63:o,PK:92:o,PL:48:r,PM:508:o,PR:1:o,PS:970:o,PT:351:r,PW:680:o,PY:595:o,QA:974:n,RE:262:o,RO:40:r,RS:381:o,RU:7:r,RW:250:n,SA:966:o,SB:677:n,SC:248:n,SD:249:o,SE:46:r,SG:65:r,SH:290:o,SI:386:o,SJ:47:o,SK:421:o,SL:232:n,SM:378:o,SN:221:o,SO:252:n,SR:597:n,SS:211:o,ST:239:n,SV:503:o,SX:1:o,SY:963:n,SZ:268:o,TC:1:o,TD:235:n,TG:228:n,TH:66:o,TJ:992:o,TK:690:n,TL:670:n,TM:993:o,TN:216:o,TO:676:n,TR:90:r,TT:1:o,TV:688:n,TW:886:o,TZ:255:o,UA:380:o,UG:256:n,US:1:r,UY:598:o,UZ:998:o,VA:39:o,VC:1:o,VE:58:o,VG:1:o,VI:1:o,VN:84:o,VU:678:n,WF:681:o,WS:685:o,XK:383:o,YE:967:n,YT:262:o,ZA:27:r,ZM:260:o,ZW:263:n';

const RULE: Record<string, PostalRule> = { r: 'required', o: 'optional', n: 'none' };
export const COUNTRIES: Country[] = RAW.split(',').map((x) => {
  const [iso, dial, r] = x.split(':');
  return { iso, dial, postal: RULE[r] };
});
/** The shop's main markets, listed first in every country picker. */
export const PRIORITY_COUNTRIES = ['BJ', 'FR', 'BE', 'GB', 'CA'];

const BY_ISO = new Map(COUNTRIES.map((c) => [c.iso, c]));
export const isCountry = (iso: string | null | undefined): boolean => !!iso && BY_ISO.has(iso.toUpperCase());
export const postalRule = (iso: string | null | undefined): PostalRule => BY_ISO.get((iso ?? '').toUpperCase())?.postal ?? 'optional';
export const dialOf = (iso: string | null | undefined): string => BY_ISO.get((iso ?? '').toUpperCase())?.dial ?? '';

/** Country name in the page language, from the browser's own data (no translation table to maintain). */
export function countryName(iso: string, locale: string): string {
  try { return new Intl.DisplayNames([locale], { type: 'region' }).of(iso) ?? iso; } catch { return iso; }
}

/** Countries for a picker: the main markets first, then everything else A-Z in the page language. */
export function countryList(locale: string): Array<Country & { name: string }> {
  const all = COUNTRIES.map((c) => ({ ...c, name: countryName(c.iso, locale) }));
  const top = PRIORITY_COUNTRIES.map((i) => all.find((c) => c.iso === i)!).filter(Boolean);
  const rest = all.filter((c) => !PRIORITY_COUNTRIES.includes(c.iso)).sort((a, b) => a.name.localeCompare(b.name, locale));
  return [...top, ...rest];
}

/**
 * Number typed by the customer + the dial code picked next to it -> international form.
 * The leading 0 is NOT removed here: some countries need it (Benin: 01 XX XX XX XX), others
 * drop it (France: 06 -> 6). The API knows which, so it makes the final call.
 * A number typed with "+" or "00" already carries its own country code and is kept as is.
 */
export function buildPhone(dialCountry: string, raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  if (s.startsWith('+')) return '+' + s.replace(/\D/g, '');
  if (s.startsWith('00')) return '+' + s.replace(/\D/g, '').slice(2);
  return '+' + dialOf(dialCountry) + s.replace(/\D/g, '');
}
