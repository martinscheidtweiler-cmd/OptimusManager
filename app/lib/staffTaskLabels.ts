import type { Locale } from '@/app/lib/i18n'

type Translation = Record<Locale, string>
type Presentation = { icon: string; label: string }

const taskTranslations: Record<string, Translation> = {
  'Voer geven': {
    en: 'Give feed', nl: 'Voer geven', pt: 'Dar ração', ro: 'A da hrană',
    fr: 'Donner la ration', fa: 'خوراک دادن', ps: 'خوراک ورکول',
  },
  'Voer geven aan de boxen': {
    en: 'Feed the horses in the boxes', nl: 'Voer geven aan de paarden in de boxen',
    pt: 'Dar ração aos cavalos nas boxes', ro: 'Hrăniți caii din boxe',
    fr: 'Nourrir les chevaux dans les boxes', fa: 'به اسب‌های داخل باکس خوراک بدهید',
    ps: 'په بکسونو کې آسونو ته خوراک ورکړئ',
  },
  'Boxen uitmesten': {
    en: 'Clean the boxes', nl: 'Boxen uitmesten', pt: 'Limpar as boxes',
    ro: 'Curățați boxele', fr: 'Nettoyer les boxes', fa: 'باکس‌ها را پاک کنید',
    ps: 'بکسونه پاک کړئ',
  },
  'Stro geven in de boxen': {
    en: 'Put straw in the boxes', nl: 'Stro geven in de boxen',
    pt: 'Colocar palha nas boxes', ro: 'Puneți paie în boxe',
    fr: 'Mettre de la paille dans les boxes', fa: 'در باکس‌ها کاه بریزید',
    ps: 'په بکسونو کې بوس واچوئ',
  },
  'Hooi geven in de boxen': {
    en: 'Give hay in the boxes', nl: 'Hooi geven in de boxen',
    pt: 'Dar feno nas boxes', ro: 'Puneți fân în boxe',
    fr: 'Donner du foin dans les boxes', fa: 'در باکس‌ها علوفه بگذارید',
    ps: 'په بکسونو کې واښه واچوئ',
  },
  'Hooi geven': {
    en: 'Give hay', nl: 'Hooi geven', pt: 'Dar feno', ro: 'A da fân',
    fr: 'Donner du foin', fa: 'علوفه دادن', ps: 'واښه ورکول',
  },
  'Mest weghalen': {
    en: 'Remove manure', nl: 'Mest weghalen', pt: 'Retirar o estrume',
    ro: 'Îndepărtați gunoiul', fr: 'Enlever le fumier',
    fa: 'کود را جمع کنید', ps: 'سره لرې کړئ',
  },
  'Mest uithalen uit 7 bigboxen': {
    en: 'Remove manure from 7 large boxes', nl: 'Mest uithalen uit 7 bigboxen',
    pt: 'Retirar o estrume de 7 boxes grandes', ro: 'Curățați gunoiul din 7 boxe mari',
    fr: 'Retirer le fumier des 7 grandes boxes', fa: 'کود را از ۷ باکس بزرگ جمع کنید',
    ps: 'له ۷ لویو بکسونو څخه سره لرې کړئ',
  },
  'Mest uithalen uit winterpaddock': {
    en: 'Remove manure from the winter paddock', nl: 'Mest uithalen uit winterpaddock',
    pt: 'Retirar o estrume do paddock de inverno', ro: 'Curățați gunoiul din padocul de iarnă',
    fr: 'Retirer le fumier du paddock d’hiver', fa: 'کود را از پادوک زمستانی جمع کنید',
    ps: 'د ژمي له پډاک څخه سره لرې کړئ',
  },
  'Mest weghalen uit shelter 1': {
    en: 'Remove manure from shelter 1', nl: 'Mest weghalen uit shelter 1',
    pt: 'Retirar o estrume do abrigo 1', ro: 'Curățați shelterul 1',
    fr: 'Enlever le fumier de l’abri 1', fa: 'کود را از سرپناه ۱ جمع کنید',
    ps: 'له ۱ سرپناه څخه سره لرې کړئ',
  },
  'Mest weghalen uit shelter 2': {
    en: 'Remove manure from shelter 2', nl: 'Mest weghalen uit shelter 2',
    pt: 'Retirar o estrume do abrigo 2', ro: 'Curățați shelterul 2',
    fr: 'Enlever le fumier de l’abri 2', fa: 'کود را از سرپناه ۲ جمع کنید',
    ps: 'له ۲ سرپناه څخه سره لرې کړئ',
  },
  'Mest weghalen uit shelter 3': {
    en: 'Remove manure from shelter 3', nl: 'Mest weghalen uit shelter 3',
    pt: 'Retirar o estrume do abrigo 3', ro: 'Curățați shelterul 3',
    fr: 'Enlever le fumier de l’abri 3', fa: 'کود را از سرپناه ۳ جمع کنید',
    ps: 'له ۳ سرپناه څخه سره لرې کړئ',
  },
  'Mest weghalen uit shelter 4': {
    en: 'Remove manure from shelter 4', nl: 'Mest weghalen uit shelter 4',
    pt: 'Retirar o estrume do abrigo 4', ro: 'Curățați shelterul 4',
    fr: 'Enlever le fumier de l’abri 4', fa: 'کود را از سرپناه ۴ جمع کنید',
    ps: 'له ۴ سرپناه څخه سره لرې کړئ',
  },
  'Mest weghalen uit shelter 5': {
    en: 'Remove manure from shelter 5', nl: 'Mest weghalen uit shelter 5',
    pt: 'Retirar o estrume do abrigo 5', ro: 'Curățați shelterul 5',
    fr: 'Enlever le fumier de l’abri 5', fa: 'کود را از سرپناه ۵ جمع کنید',
    ps: 'له ۵ سرپناه څخه سره لرې کړئ',
  },
  'Mest weghalen uit shelter 6': {
    en: 'Remove manure from shelter 6', nl: 'Mest weghalen uit shelter 6',
    pt: 'Retirar o estrume do abrigo 6', ro: 'Curățați shelterul 6',
    fr: 'Enlever le fumier de l’abri 6', fa: 'کود را از سرپناه ۶ جمع کنید',
    ps: 'له ۶ سرپناه څخه سره لرې کړئ',
  },
  'Mest weghalen uit shelter 7': {
    en: 'Remove manure from shelter 7', nl: 'Mest weghalen uit shelter 7',
    pt: 'Retirar o estrume do abrigo 7', ro: 'Curățați shelterul 7',
    fr: 'Enlever le fumier de l’abri 7', fa: 'کود را از سرپناه ۷ جمع کنید',
    ps: 'له ۷ سرپناه څخه سره لرې کړئ',
  },
  'Paarden binnen zetten': {
    en: 'Bring the horses inside', nl: 'Paarden binnen zetten',
    pt: 'Recolher os cavalos', ro: 'Aduceți caii înăuntru',
    fr: 'Rentrer les chevaux', fa: 'اسب‌ها را به داخل بیاورید',
    ps: 'آسونه دننه کړئ',
  },
  'Paarden buiten zetten': {
    en: 'Turn the horses out', nl: 'Paarden buiten zetten',
    pt: 'Levar os cavalos para o exterior', ro: 'Scoateți caii afară',
    fr: 'Sortir les chevaux', fa: 'اسب‌ها را به بیرون ببرید',
    ps: 'آسونه بهر وباسئ',
  },
  Andere: {
    en: 'Other', nl: 'Andere', pt: 'Outra tarefa', ro: 'Altă sarcină',
    fr: 'Autre', fa: 'کار دیگر', ps: 'بله دنده',
  },
}

const taskIcon = (name: string) => {
  if (name.startsWith('Voer geven')) return '🥣'
  if (name.startsWith('Hooi geven')) return '🌾'
  if (name.startsWith('Stro geven')) return '🪵'
  if (name === 'Boxen uitmesten') return '🧹'
  if (name.startsWith('Mest ')) return '💩'
  if (name === 'Paarden binnen zetten') return '🏠'
  if (name === 'Paarden buiten zetten') return '🌳'
  if (name === 'Andere') return '➕'
  return '📋'
}

export function staffTaskPresentation(name: string, locale: Locale): Presentation {
  return { icon: taskIcon(name), label: taskTranslations[name]?.[locale] || name }
}

export function staffLocationPresentation(name: string, locale: Locale): Presentation {
  const names: Record<string, Translation> = {
    Serre: {
      en: 'Greenhouse', nl: 'Serre', pt: 'Estufa', ro: 'Seră',
      fr: 'Serre', fa: 'گلخانه', ps: 'شنه‌خونه',
    },
  }
  const icon = name === 'Serre' ? '🌱' : name === 'Paddock Paradise' ? '🌿' : '📍'
  return { icon, label: names[name]?.[locale] || name }
}
