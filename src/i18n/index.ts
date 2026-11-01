import { LANG } from '@/constant'
import { language } from '@/store/settings'
import { createI18n } from 'vue-i18n'
import custom from './custom'
import en from './en'
import ru from './ru'
import zh from './zh'
import zhTW from './zh-tw'

export const i18n = createI18n({
  legacy: false,
  locale: language.value,
  fallbackLocale: LANG.EN_US,
  messages: {
    [LANG.EN_US]: { ...en, ...custom.en },
    [LANG.ZH_CN]: { ...zh, ...custom.zh },
    [LANG.ZH_TW]: { ...zhTW, ...custom.zhTW },
    [LANG.RU_RU]: ru,
  },
})
