import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { throwError, from, Observable, switchMap, catchError, filter } from 'rxjs';
import { AuthService } from '../services/auth.service';

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}> = [];

let isRedirectingToAccessDenied = false;
let navigationEndSubscriptionInitialized = false;

function processQueue(token: string | null, error: unknown = null): void {
  failedQueue.forEach((p) => {
    if (error) {
      p.reject(error);
    } else {
      p.resolve(token);
    }
  });
  failedQueue = [];
}

function ensureNavigationEndSubscription(router: Router): void {
  if (navigationEndSubscriptionInitialized) {
    return;
  }
  navigationEndSubscriptionInitialized = true;
  router.events
    .pipe(
      filter(
        (event): event is NavigationEnd | NavigationCancel | NavigationError =>
          event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError,
      ),
    )
    .subscribe(() => {
      isRedirectingToAccessDenied = false;
    });
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  ensureNavigationEndSubscription(router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        if (isRefreshing) {
          return new Observable<unknown>((subscriber) => {
            failedQueue.push({
              resolve: () => {
                const cloned = req.clone({
                  setHeaders: { Authorization: `Bearer ${authService.accessToken()}` },
                });
                next(cloned).subscribe({
                  next: (v) => subscriber.next(v),
                  error: (e) => subscriber.error(e),
                  complete: () => subscriber.complete(),
                });
              },
              reject: (e: unknown) => subscriber.error(e),
            });
          }) as ReturnType<typeof next>;
        }

        isRefreshing = true;

        return from(authService.refreshAuth()).pipe(
          switchMap((newToken) => {
            isRefreshing = false;
            processQueue(newToken, null);
            if (newToken) {
              const cloned = req.clone({
                setHeaders: { Authorization: `Bearer ${newToken}` },
              });
              return next(cloned);
            }
            return throwError(() => error);
          }),
          catchError((refreshError) => {
            isRefreshing = false;
            processQueue(null, refreshError);
            authService.logout();
            return throwError(() => refreshError);
          }),
        );
      }

      if (error.status === 403) {
        if (
          !isRedirectingToAccessDenied
          && authService.isAuthenticated()
          && router.url !== '/access-denied'
        ) {
          isRedirectingToAccessDenied = true;
          void router.navigate(['/access-denied']);
        }
      }

      return throwError(() => error);
    }),
  );
};
