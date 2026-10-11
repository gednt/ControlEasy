import { ApplicationConfig, APP_INITIALIZER, provideZoneChangeDetection, importProvidersFrom } from '@angular/core';
import { DATE_PIPE_DEFAULT_OPTIONS } from '@angular/common';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { DemoInfoService, demoInfoInitializer } from './core/services/demo-info.service';
import { BootstrapInfoService, bootstrapInfoInitializer } from './core/services/bootstrap-info.service';
import { CE_LUCIDE_ICONS } from './design-system/components/icon/icon.registry';
import { getRuntimeTimeZone } from './core/config/runtime-config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withInMemoryScrolling({ anchorScrolling: 'enabled' })),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    provideAnimationsAsync(),
    importProvidersFrom(CE_LUCIDE_ICONS),
    {
      provide: DATE_PIPE_DEFAULT_OPTIONS,
      useValue: { timezone: getRuntimeTimeZone() },
    },
    {
      provide: APP_INITIALIZER,
      useFactory: demoInfoInitializer,
      deps: [DemoInfoService],
      multi: true,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: bootstrapInfoInitializer,
      deps: [BootstrapInfoService],
      multi: true,
    },
  ],
};
