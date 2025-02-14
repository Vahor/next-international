import { NextRequest, NextResponse } from 'next/server';

import { LOCALE_COOKIE, LOCALE_HEADER } from '../../common/constants';
import type { I18nMiddlewareConfig } from '../../types';
import { warn } from '../../helpers/log';

const DEFAULT_STRATEGY: NonNullable<I18nMiddlewareConfig<[]>['urlMappingStrategy']> = 'redirect';

export function createI18nMiddleware<Locales extends readonly string[]>(
  locales: Locales,
  defaultLocale: Locales[number],
  config?: I18nMiddlewareConfig<Locales>,
) {
  return function I18nMiddleware(request: NextRequest) {
    const requestUrl = request.nextUrl.clone();

    const locale = localeFromRequest(locales, request, config?.resolveLocaleFromRequest) ?? defaultLocale;

    if (noLocalePrefix(locales, requestUrl.pathname)) {
      const mappedUrl = requestUrl.clone();
      mappedUrl.pathname = `/${locale}${mappedUrl.pathname}`;

      const strategy = config?.urlMappingStrategy ?? DEFAULT_STRATEGY;

      if (strategy === 'rewrite') {
        const response = NextResponse.rewrite(mappedUrl);
        return addLocaleToResponse(response, locale);
      } else {
        if (strategy !== 'redirect') {
          warn(`Invalid urlMappingStrategy: ${strategy}. Defaulting to redirect.`);
        }

        const response = NextResponse.redirect(mappedUrl);
        return addLocaleToResponse(response, locale);
      }
    }

    const response = NextResponse.next();
    const requestLocale = request.nextUrl.pathname.split('/')?.[1];

    if (locales.includes(requestLocale) && config?.urlMappingStrategy === 'rewrite') {
      const newUrl = new URL(request.nextUrl.pathname.slice(requestLocale.length + 1), request.url);
      const response = NextResponse.redirect(newUrl);

      return addLocaleToResponse(response, requestLocale);
    }

    if (!requestLocale || locales.includes(requestLocale)) {
      return addLocaleToResponse(response, requestLocale ?? defaultLocale);
    }

    return response;
  };
}

function localeFromRequest<Locales extends readonly string[]>(
  locales: Locales,
  request: NextRequest,
  resolveLocaleFromRequest: NonNullable<
    I18nMiddlewareConfig<Locales>['resolveLocaleFromRequest']
  > = defaultResolveLocaleFromRequest,
) {
  let locale = request.cookies.get(LOCALE_COOKIE)?.value ?? null;

  if (!locale) {
    locale = resolveLocaleFromRequest(request);
  }

  if (!locale || !locales.includes(locale)) {
    locale = null;
  }

  return locale;
}

const defaultResolveLocaleFromRequest: NonNullable<I18nMiddlewareConfig<any>['resolveLocaleFromRequest']> = request => {
  const header = request.headers.get('Accept-Language');
  const locale = header?.split(',')?.[0]?.split('-')?.[0];
  return locale ?? null;
};

function noLocalePrefix(locales: readonly string[], pathname: string) {
  return locales.every(locale => {
    return !(pathname === `/${locale}` || pathname.startsWith(`/${locale}/`));
  });
}

function addLocaleToResponse(response: NextResponse, locale: string) {
  response.headers.set(LOCALE_HEADER, locale);
  response.cookies.set(LOCALE_COOKIE, locale);
  return response;
}
