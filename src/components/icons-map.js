// icons-map.js
// Mappatura semantica NodoSuite -> icone Solar (stile LineDuotone).
import {
  House,
  Buildings2,
  DocumentAdd,
  User,
  Settings,
  ChecklistMinimalistic,
  Screencast2,
  Translation2,
  DownloadMinimalistic,
  CloseSquare,
  Pen,
  PaperBin,
  MultipleForwardLeft,
  MultipleForwardRight,
  MapArrowLeft,
  MapArrowRight,
  Hourglass,
  CalendarDate,
  CallChatRounded,
  Letter,
  Phone,
  DangerSquare,
  CheckCircle,
  SmartphoneVibration,
  MenuDots,
} from '@solar-icons/react-perf/LineDuotone';

import {
  MoveToFolder,
  CheckSquare,
} from '@solar-icons/react-perf/BoldDuotone';

export const NAV_ICONS = {
  home: House,
  condomini: Buildings2,
  verbali: DocumentAdd,
  persone: User,
  impostazioni: Settings,
  incarichi: ChecklistMinimalistic,
  dashboard: Screencast2,
  fornitori: Translation2,
  integrazioni: DownloadMinimalistic,
  inbox: Letter,
};

export const NAV_LABELS = {
  home: 'Home',
  condomini: 'Condomini',
  verbali: 'Verbali',
  persone: 'Persone',
  impostazioni: 'Impostazioni',
  incarichi: 'Incarichi',
  dashboard: 'Dashboard',
  fornitori: 'Fornitori',
  integrazioni: 'Integrazioni',
  inbox: 'Inbox',
};

// Icone azione/utility riutilizzate in liste, modali e paginazione
export const ACTION_ICONS = {
  chiudi: CloseSquare,
  modifica: Pen,
  elimina: PaperBin,
  primaPagina: MultipleForwardLeft,
  ultimaPagina: MultipleForwardRight,
  paginaPrec: MapArrowLeft,
  paginaSucc: MapArrowRight,
};

// Icone di stato per flussi di import/caricamento (usate in ImportModal)
export const UTILITY_ICONS = {
  dragDrop: MoveToFolder,
  caricamento: Hourglass,
  successo: CheckSquare,
  scadenza: CalendarDate,
  whatsapp: CallChatRounded,
  email: Letter,
  telefono: Phone,
  pericolo: DangerSquare,
  approvato: CheckCircle,
  whatsappNumero: SmartphoneVibration,
  altro: MenuDots,
};
