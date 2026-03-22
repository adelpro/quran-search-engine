import quranData from '../data/quran.json';
import { Sura, QuranText } from '../types';

export const SURAS = (() => {
  const surasMap = new Map<number, Sura>();

  (quranData as QuranText[]).forEach((aya: QuranText) => {
    const suraId = aya.sura_id;

    if (!surasMap.has(suraId)) {
      surasMap.set(suraId, {
        id: suraId,
        sura_name: aya.sura_name,
        sura_name_en: aya.sura_name_en,
        sura_name_romanization: aya.sura_name_romanization,
        total_verses: 0,
        juz_ids: [],
        page_start: aya.page_id,
        page_end: aya.page_id,
      });
    }

    const sura = surasMap.get(suraId)!;
    sura.total_verses++;

    if (!sura.juz_ids.includes(aya.juz_id)) {
      sura.juz_ids.push(aya.juz_id);
    }

    if (aya.page_id < sura.page_start) {
      sura.page_start = aya.page_id;
    }
    if (!sura.page_end || aya.page_id > sura.page_end) {
      sura.page_end = aya.page_id;
    }
  });

  surasMap.forEach((sura) => {
    sura.juz_ids.sort((a, b) => a - b);
  });

  return Array.from(surasMap.values()).sort((a, b) => a.id - b.id);
})();
