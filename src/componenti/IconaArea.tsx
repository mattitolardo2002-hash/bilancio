import {
  IconArrowsExchange, IconBabyCarriage, IconBarbell, IconBolt, IconBook, IconBriefcase,
  IconBuildingBank, IconBus, IconCar, IconCash, IconChartLine, IconCoffee, IconCoins,
  IconCreditCard, IconDeviceGamepad2, IconDeviceMobile, IconDots, IconGasStation, IconGift,
  IconGlassFull, IconHeartbeat, IconHome, IconMedicalCross, IconMovie, IconMusic, IconPaw,
  IconPigMoney, IconPizza, IconPlane, IconReceipt, IconSchool, IconScissors, IconShieldCheck,
  IconShirt, IconShoppingCart, IconTool, IconToolsKitchen2, IconTrendingUp, IconWallet, IconWifi,
  type Icon,
} from '@tabler/icons-react';

// Catalogo delle icone che si possono dare a una macro-area.
// Le chiavi sono in italiano e restano salvate nei dati: non cambiarle.
export const ICONE_AREA: Record<string, Icon> = {
  valigetta: IconBriefcase,
  monete: IconCoins,
  contanti: IconCash,
  portafoglio: IconWallet,
  banca: IconBuildingBank,
  casa: IconHome,
  bolletta: IconBolt,
  wifi: IconWifi,
  carrello: IconShoppingCart,
  ristorante: IconToolsKitchen2,
  pizza: IconPizza,
  caffe: IconCoffee,
  auto: IconCar,
  benzina: IconGasStation,
  bus: IconBus,
  aereo: IconPlane,
  telefono: IconDeviceMobile,
  ricevuta: IconReceipt,
  carta: IconCreditCard,
  cuore: IconHeartbeat,
  farmacia: IconMedicalCross,
  palestra: IconBarbell,
  bicchiere: IconGlassFull,
  cinema: IconMovie,
  musica: IconMusic,
  giochi: IconDeviceGamepad2,
  maglietta: IconShirt,
  barbiere: IconScissors,
  regalo: IconGift,
  studio: IconSchool,
  libro: IconBook,
  bimbi: IconBabyCarriage,
  animali: IconPaw,
  attrezzi: IconTool,
  grafico: IconChartLine,
  crescita: IconTrendingUp,
  salvadanaio: IconPigMoney,
  scudo: IconShieldCheck,
  scambio: IconArrowsExchange,
  puntini: IconDots,
};

// Colori delle icone: tinte morbide che stanno bene sul fondo scuro.
// Il colore pieno è per l'icona, lo sfondo è la stessa tinta molto trasparente.
export const COLORI_AREA: Record<string, string> = {
  blu: '#5b9bf5',
  azzurro: '#4cc3e8',
  verde: '#3ccf91',
  ambra: '#e9b44c',
  arancio: '#f2994a',
  corallo: '#f07a62',
  rosa: '#e978a6',
  viola: '#9b8cf7',
  grigio: '#97a1b0',
};

/** Icona rotonda di una macro-area (o di un conto), nel suo colore. */
export function IconaArea({
  area,
  misura = 40,
}: {
  area: { icona?: string; colore?: string } | undefined;
  misura?: number;
}) {
  const Componente = (area?.icona && ICONE_AREA[area.icona]) || IconDots;
  const colore = (area?.colore && COLORI_AREA[area.colore]) || COLORI_AREA.grigio;
  return (
    <span
      className="icona-area"
      style={{
        width: misura,
        height: misura,
        color: colore,
        background: `color-mix(in srgb, ${colore} 15%, transparent)`,
      }}
      aria-hidden="true"
    >
      <Componente size={Math.round(misura * 0.5)} stroke={1.7} />
    </span>
  );
}
